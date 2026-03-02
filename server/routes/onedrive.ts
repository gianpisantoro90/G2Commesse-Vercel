import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertOneDriveMappingSchema } from "@shared/schema";
import serverOneDriveService, { ONEDRIVE_DEFAULT_FOLDERS } from "../lib/onedrive-service";

// OneDrive endpoint validation schemas
const setRootFolderSchema = z.object({
  folderPath: z.string().min(1, "Folder path is required"),
  folderId: z.string().optional(),
});

const createProjectFolderSchema = z.object({
  projectCode: z.string().min(1, "Project code is required"),
  template: z.enum(["LUNGO", "BREVE"], { required_error: "Template must be LUNGO or BREVE" }),
  object: z.string().optional(), // Project description for folder naming
});

const scanFilesSchema = z.object({
  folderPath: z.string().optional(),
  projectCode: z.string().optional(),
  includeSubfolders: z.boolean().default(true),
}).refine(data => data.folderPath || data.projectCode, {
  message: "Either folderPath or projectCode must be provided"
});

export function registerOneDriveRoutes(app: Express): void {
  // OneDrive integration endpoints
  app.get("/api/onedrive/test", async (req, res) => {
    try {
      const isConnected = await serverOneDriveService.testConnection();
      res.json({ connected: isConnected });
    } catch (error) {
      console.error('OneDrive test failed:', error);
      res.status(500).json({ error: 'Failed to test OneDrive connection' });
    }
  });

  app.get("/api/onedrive/user", async (req, res) => {
    try {
      const userInfo = await serverOneDriveService.getUserInfo();
      res.json(userInfo);
    } catch (error) {
      console.error('OneDrive user info failed:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  app.get("/api/onedrive/files", async (req, res) => {
    try {
      // Use only the URL query parameter; ignore Vercel rewrite capture params
      const rawPath = req.query.path;
      const folderPath = (typeof rawPath === 'string' && rawPath.startsWith('/')) ? rawPath : '/';

      // Input validation
      if (folderPath.length > 500) {
        return res.status(400).json({ error: 'Invalid folder path parameter' });
      }

      const files = await serverOneDriveService.listFiles(folderPath as any);
      res.json(files);
    } catch (error: any) {
      console.error('OneDrive list files failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const statusCode = isAuthError ? 401 : 500;
      const errorMessage = isAuthError ? 'OneDrive access denied or expired' : 'Failed to list files';
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.post("/api/onedrive/map-project", async (req, res) => {
    try {
      const { projectCode } = req.body;

      if (!projectCode) {
        return res.status(400).json({ error: 'Project code is required' });
      }

      // Get root folder configuration
      const rootConfig = await storage.getSystemConfig('onedrive_root_folder');

      if (!rootConfig || !rootConfig.value || !(rootConfig.value as any).folderPath) {
        console.error('❌ OneDrive root folder not configured');
        return res.status(400).json({
          error: 'OneDrive root folder not configured. Please configure the root folder in system settings.',
          found: false,
          mapped: false
        });
      }

      const rootPath = (rootConfig.value as any).folderPath;

      // Search for folder matching project code in root path
      try {
        const files = await serverOneDriveService.listFiles(rootPath);
        const matchingFolder = files.find(file =>
          file.folder &&
          (file.name === projectCode || file.name.startsWith(`${projectCode}_`))
        );

        if (matchingFolder) {

          // Create or update mapping
          const existingMapping = await storage.getOneDriveMapping(projectCode);

          if (existingMapping) {
          } else {
            await storage.createOneDriveMapping({
              projectCode,
              oneDriveFolderId: matchingFolder.id,
              oneDriveFolderPath: `${rootPath}/${matchingFolder.name}`,
              oneDriveFolderName: matchingFolder.name,
            });
          }

          return res.json({
            found: true,
            mapped: true,
            folderPath: `${rootPath}/${matchingFolder.name}`,
            folderName: matchingFolder.name
          });
        } else {
          return res.json({
            found: false,
            mapped: false,
            message: `No folder found matching project code ${projectCode} in ${rootPath}`
          });
        }
      } catch (error) {
        console.error(`❌ Error searching for folder:`, error);
        return res.status(500).json({
          found: false,
          mapped: false,
          error: 'Failed to search OneDrive folders'
        });
      }
    } catch (error) {
      console.error('OneDrive map project failed:', error);
      res.status(500).json({ error: 'Failed to map project to OneDrive folder' });
    }
  });

  app.post("/api/onedrive/sync-project", async (req, res) => {
    try {
      const { projectCode, projectDescription } = req.body;

      if (!projectCode) {
        return res.status(400).json({ error: 'Project code is required' });
      }

      const success = await serverOneDriveService.syncProjectFolder(projectCode, projectDescription || '');

      // If sync was successful, create or update the mapping
      if (success) {
        try {
          // Use default root folder path from constants
          const rootPath = ONEDRIVE_DEFAULT_FOLDERS.ROOT_FOLDER;
          const folderPath = `${rootPath}/${projectCode}`;

          // Check if mapping already exists
          const existingMapping = await storage.getOneDriveMapping(projectCode);

          if (!existingMapping) {
            // Create new mapping
            await storage.createOneDriveMapping({
              projectCode,
              oneDriveFolderId: '', // Will be populated when we have the folder ID
              oneDriveFolderPath: folderPath,
              oneDriveFolderName: projectCode,
            });
          }
        } catch (mappingError) {
          // Don't fail the sync operation if mapping creation fails
          // Don't fail the sync operation if mapping creation fails
        }
      }

      res.json({ success });
    } catch (error) {
      console.error('OneDrive sync project failed:', error);
      res.status(500).json({ error: 'Failed to sync project folder' });
    }
  });

  // OneDrive Mappings Management API
  app.get("/api/onedrive/mappings", async (req, res) => {
    try {
      const mappings = await storage.getAllOneDriveMappings();
      res.json(mappings);
    } catch (error) {
      console.error('Failed to get OneDrive mappings:', error);
      res.status(500).json({ error: 'Failed to retrieve OneDrive mappings' });
    }
  });

  app.get("/api/onedrive/mappings/:projectCode", async (req, res) => {
    try {
      const { projectCode } = req.params;

      if (!projectCode) {
        return res.status(400).json({ error: 'Project code is required' });
      }

      const mapping = await storage.getOneDriveMapping(projectCode);

      if (!mapping) {
        return res.status(404).json({ error: 'OneDrive mapping not found for this project' });
      }

      res.json(mapping);
    } catch (error) {
      console.error('Failed to get OneDrive mapping:', error);
      res.status(500).json({ error: 'Failed to retrieve OneDrive mapping' });
    }
  });

  app.post("/api/onedrive/mappings", async (req, res) => {
    try {
      const validatedData = insertOneDriveMappingSchema.parse(req.body);

      // Check if mapping already exists
      const existingMapping = await storage.getOneDriveMapping(validatedData.projectCode);
      if (existingMapping) {
        return res.status(400).json({ error: 'OneDrive mapping already exists for this project' });
      }

      // Automatically extract the folder ID from the path (same system used for project creation)
      let folderId = validatedData.oneDriveFolderId;
      if (!folderId && validatedData.oneDriveFolderPath) {
        folderId = await serverOneDriveService.getFolderIdFromPath(validatedData.oneDriveFolderPath) ?? '';
        if (folderId) {
          validatedData.oneDriveFolderId = folderId;
        }
      }

      const mapping = await storage.createOneDriveMapping(validatedData);
      res.status(201).json(mapping);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Failed to create OneDrive mapping:', error);
      res.status(500).json({ error: 'Failed to create OneDrive mapping' });
    }
  });

  app.delete("/api/onedrive/mappings/:projectCode", async (req, res) => {
    try {
      const { projectCode } = req.params;

      if (!projectCode) {
        return res.status(400).json({ error: 'Project code is required' });
      }

      const success = await storage.deleteOneDriveMapping(projectCode);

      if (!success) {
        return res.status(404).json({ error: 'OneDrive mapping not found for this project' });
      }

      res.json({ message: 'OneDrive mapping deleted successfully' });
    } catch (error) {
      console.error('Failed to delete OneDrive mapping:', error);
      res.status(500).json({ error: 'Failed to delete OneDrive mapping' });
    }
  });

  app.get("/api/onedrive/download/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;

      // Input validation
      if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'File ID is required and must be a string' });
      }

      if (fileId.length > 200) {
        return res.status(400).json({ error: 'File ID too long' });
      }

      const fileBuffer = await serverOneDriveService.downloadFile(fileId);

      if (!fileBuffer) {
        return res.status(404).json({ error: 'File not found or could not be downloaded' });
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('OneDrive download failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isNotFound = error.message?.includes('404') || error.message?.includes('not found');
      const isBadRequest = error.message?.includes('Invalid') || error.message?.includes('invalid characters');
      const statusCode = isAuthError ? 401 : (isNotFound ? 404 : (isBadRequest ? 400 : 500));
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isNotFound ? 'File not found' : (isBadRequest ? 'Invalid file ID' : 'Failed to download file'));
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  // Extended OneDrive API for full navigation
  app.get("/api/onedrive/browse", async (req, res) => {
    try {
      // Use only the URL query parameter; ignore Vercel rewrite capture params
      const rawPath = req.query.path;
      const folderPath = (typeof rawPath === 'string' && rawPath.startsWith('/')) ? rawPath : '/';

      // Input validation
      if (folderPath.length > 500) {
        return res.status(400).json({ error: 'Invalid folder path parameter' });
      }

      const files = await serverOneDriveService.listFiles(folderPath as any);
      res.json(files);
    } catch (error: any) {
      console.error('OneDrive browse failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isNotFound = error.message?.includes('404') || error.message?.includes('not found');
      const statusCode = isAuthError ? 401 : (isNotFound ? 404 : 500);
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isNotFound ? 'Folder not found' : 'Failed to browse OneDrive');
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.get("/api/onedrive/hierarchy", async (req, res) => {
    try {
      const folders = await serverOneDriveService.getFolderHierarchy();
      res.json(folders);
    } catch (error) {
      console.error('OneDrive hierarchy failed:', error);
      res.status(500).json({ error: 'Failed to get folder hierarchy' });
    }
  });

  app.get("/api/onedrive/search", async (req, res) => {
    try {
      const query = req.query.q as string;

      // Input validation
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required and must be a string' });
      }

      if (query.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }

      if (query.length > 255) {
        return res.status(400).json({ error: 'Search query too long (max 255 characters)' });
      }

      const files = await serverOneDriveService.searchFiles(query);
      res.json(files);
    } catch (error: any) {
      console.error('OneDrive search failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isBadRequest = error.message?.includes('Invalid') || error.message?.includes('too long');
      const statusCode = isAuthError ? 401 : (isBadRequest ? 400 : 500);
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isBadRequest ? 'Invalid search request' : 'Failed to search OneDrive');
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.get("/api/onedrive/content/:fileId", async (req, res) => {
    try {
      const fileId = req.params.fileId;

      // Input validation
      if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'File ID is required and must be a string' });
      }

      if (fileId.length > 200) {
        return res.status(400).json({ error: 'File ID too long' });
      }

      const content = await serverOneDriveService.getFileContent(fileId);

      if (content === null) {
        return res.status(422).json({ error: 'File content not available (binary or unsupported type)' });
      }

      res.json({ content });
    } catch (error: any) {
      console.error('OneDrive file content failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isNotFound = error.message?.includes('404') || error.message?.includes('not found');
      const isBadRequest = error.message?.includes('Invalid') || error.message?.includes('invalid characters');
      const statusCode = isAuthError ? 401 : (isNotFound ? 404 : (isBadRequest ? 400 : 500));
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isNotFound ? 'File not found' : (isBadRequest ? 'Invalid file ID' : 'Failed to get file content'));
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.post("/api/onedrive/link-project", async (req, res) => {
    try {
      // Validate request body with Zod
      const validatedData = insertOneDriveMappingSchema.parse(req.body);
      const { projectCode, oneDriveFolderId, oneDriveFolderName, oneDriveFolderPath } = validatedData;

      // Check if project exists
      const project = await storage.getProjectByCode(projectCode);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if mapping already exists
      const existingMapping = await storage.getOneDriveMapping(projectCode);

      // Validate OneDrive folder exists
      const success = await serverOneDriveService.linkProjectToFolder(projectCode, oneDriveFolderId, oneDriveFolderName, oneDriveFolderPath);

      if (success) {
        // If mapping exists, delete it first to replace with new one
        if (existingMapping) {
          await storage.deleteOneDriveMapping(projectCode);
        }

        // Save new mapping to database
        const mapping = await storage.createOneDriveMapping(validatedData);
        res.json({
          success: true,
          mapping,
          updated: !!existingMapping
        });
      } else {
        res.status(400).json({ error: 'Failed to validate OneDrive folder' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('OneDrive project link failed:', error);
      res.status(500).json({ error: 'Failed to link project to OneDrive folder' });
    }
  });

  // OneDrive-centric system endpoints
  app.post("/api/onedrive/set-root-folder", async (req, res) => {
    try {
      const validatedData = setRootFolderSchema.parse(req.body);
      const { folderPath, folderId } = validatedData;

      // Validate folder exists on OneDrive
      const isValid = await serverOneDriveService.validateFolder(folderId || folderPath);
      if (!isValid) {
        return res.status(400).json({ error: 'OneDrive folder not found or inaccessible' });
      }

      // Extract folder name from path
      const folderName = folderPath.split('/').pop() || 'Root';

      // Save root folder configuration with correct field names
      const configData = {
        folderPath: folderPath,
        folderId: folderId || null,
        folderName: folderName,
        lastUpdated: new Date().toISOString()
      };

      const config = await storage.setSystemConfig('onedrive_root_folder', configData);

      res.json({ success: true, config: { ...config, value: configData } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error('Set root folder failed:', error);
      res.status(500).json({ error: 'Failed to set OneDrive root folder' });
    }
  });

  app.get("/api/onedrive/root-folder", async (req, res) => {
    try {
      const systemConfig = await storage.getSystemConfig('onedrive_root_folder');

      if (systemConfig && systemConfig.value) {
        const rawConfig = systemConfig.value;

        // Transform the data to match frontend interface format
        const rawConfigAny = rawConfig as any;
        const transformedConfig = {
          folderPath: rawConfigAny.folderPath || rawConfigAny.path || '',
          folderId: rawConfigAny.folderId || '',
          folderName: rawConfigAny.folderName || (rawConfigAny.folderPath || rawConfigAny.path || '').split('/').pop() || 'Root',
          lastUpdated: rawConfigAny.lastUpdated || rawConfigAny.configuredAt || new Date().toISOString()
        };

        res.json({
          config: transformedConfig,
          configured: true
        });
      } else {
        // Auto-save default config with real folderId from OneDrive
        const folderPath = ONEDRIVE_DEFAULT_FOLDERS.ROOT_FOLDER;
        let folderId = '';
        try {
          const items = await serverOneDriveService.listFiles('/');
          const match = items.find((f: any) => f.name === folderPath.replace('/', ''));
          if (match) folderId = match.id;
        } catch { /* OneDrive not connected yet, save without ID */ }

        const defaultConfig = {
          folderPath,
          folderId,
          folderName: folderPath.split('/').pop() || 'LAVORO_CORRENTE',
          lastUpdated: new Date().toISOString()
        };

        await storage.setSystemConfig('onedrive_root_folder', defaultConfig);

        res.json({
          config: defaultConfig,
          configured: true
        });
      }
    } catch (error) {
      console.error('Get root folder failed:', error);
      res.status(500).json({ error: 'Failed to get root folder configuration' });
    }
  });

  // Reset root folder configuration
  app.delete("/api/onedrive/root-folder", async (req, res) => {
    try {
      await storage.setSystemConfig('onedrive_root_folder', null);
      res.json({ message: "Configurazione cartella radice rimossa" });
    } catch (error) {
      console.error('Error deleting root folder config:', error);
      res.status(500).json({ message: "Errore nella rimozione della configurazione" });
    }
  });

  // OneDrive Mappings CRUD endpoints
  app.post("/api/onedrive/validate-folder", async (req, res) => {
    try {
      const { folderIdOrPath } = req.body;
      if (!folderIdOrPath) {
        return res.status(400).json({ error: 'Folder ID or path is required' });
      }

      const isValid = await serverOneDriveService.validateFolder(folderIdOrPath);
      res.json({ valid: isValid });
    } catch (error) {
      console.error('OneDrive folder validation failed:', error);
      res.status(500).json({ error: 'Failed to validate OneDrive folder' });
    }
  });

  app.post("/api/onedrive/create-project-folder", async (req, res) => {
    try {
      const validatedData = createProjectFolderSchema.parse(req.body);
      const { projectCode, template } = validatedData;

      // Get root folder configuration
      const rootConfig = await storage.getSystemConfig('onedrive_root_folder');
      if (!rootConfig || !rootConfig.value || !(rootConfig.value as any).folderPath) {
        console.error('❌ OneDrive root folder not configured');
        return res.status(400).json({
          success: false,
          error: 'OneDrive root folder not configured. Please configure the root folder in system settings.'
        });
      }

      const rootPath = (rootConfig.value as any).folderPath;
      const folderInfo = await serverOneDriveService.createProjectWithTemplate(
        rootPath,
        projectCode,
        template,
        req.body.object // Pass project object (description) for folder naming
      );

      if (folderInfo) {
        // Save OneDrive mapping
        const mapping = await storage.createOneDriveMapping({
          projectCode,
          oneDriveFolderId: folderInfo.id,
          oneDriveFolderName: folderInfo.name,
          oneDriveFolderPath: folderInfo.path
        });

        res.json({
          success: true,
          folder: folderInfo,
          mapping,
          message: `Project folder created successfully at ${folderInfo.path}`
        });
      } else {
        console.error('❌ OneDrive folder creation returned null');
        res.status(500).json({
          success: false,
          error: 'Failed to create OneDrive project folder. Check server logs for details.'
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error('❌ Validation error:', error.errors);
        return res.status(400).json({
          success: false,
          error: "Invalid request data",
          details: error.errors
        });
      }

      console.error('❌ Create project folder failed:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        statusCode: error.statusCode,
        requestId: error.requestId
      });

      // Enhanced error classification based on Microsoft Graph errors
      let statusCode = 500;
      let errorMessage = 'Failed to create project folder on OneDrive';
      let errorCode = 'FOLDER_CREATION_FAILED';

      const errorText = (error.message || '').toLowerCase();

      // Microsoft Graph specific errors
      if (errorText.includes('status: 400')) {
        statusCode = 400;
        if (errorText.includes('invalidrequest') || errorText.includes('badrequest')) {
          errorMessage = 'Invalid folder name or path. Please use only letters, numbers, hyphens, and underscores.';
          errorCode = 'INVALID_FOLDER_NAME';
        } else if (errorText.includes('conflictingitemname') || errorText.includes('nameconflict')) {
          errorMessage = 'A folder with this name already exists. Please choose a different project code.';
          errorCode = 'FOLDER_EXISTS';
        } else if (errorText.includes('quotaexceeded') || errorText.includes('insufficientstorage')) {
          errorMessage = 'OneDrive storage quota exceeded. Please free up space or contact administrator.';
          errorCode = 'STORAGE_QUOTA_EXCEEDED';
        } else {
          errorMessage = 'Invalid request to OneDrive. Please check the project code and try again.';
          errorCode = 'BAD_REQUEST';
        }
      } else if (errorText.includes('status: 401') || errorText.includes('authentication')) {
        statusCode = 401;
        errorMessage = 'OneDrive authentication expired. Please reconnect OneDrive in system settings.';
        errorCode = 'AUTHENTICATION_FAILED';
      } else if (errorText.includes('status: 403') || errorText.includes('forbidden')) {
        statusCode = 403;
        errorMessage = 'Insufficient permissions to create folders in OneDrive. Please check OneDrive permissions.';
        errorCode = 'PERMISSIONS_DENIED';
      } else if (errorText.includes('status: 404') || errorText.includes('not found')) {
        statusCode = 404;
        errorMessage = 'OneDrive root folder not found. Please reconfigure the OneDrive root folder.';
        errorCode = 'ROOT_FOLDER_NOT_FOUND';
      } else if (errorText.includes('status: 429') || errorText.includes('throttled')) {
        statusCode = 429;
        errorMessage = 'OneDrive API rate limit exceeded. Please wait a moment and try again.';
        errorCode = 'RATE_LIMITED';
      } else if (errorText.includes('template structure creation failed')) {
        errorMessage = 'Project folder created but template structure failed. Some subfolders may be missing.';
        errorCode = 'TEMPLATE_STRUCTURE_FAILED';
      } else if (errorText.includes('invalid characters')) {
        statusCode = 400;
        errorMessage = 'Project code contains invalid characters. Please use only letters, numbers, hyphens, and underscores.';
        errorCode = 'INVALID_PROJECT_CODE';
      } else if (errorText.includes('root folder') && errorText.includes('not configured')) {
        statusCode = 400;
        errorMessage = 'OneDrive root folder not configured. Please configure it in system settings.';
        errorCode = 'ROOT_FOLDER_NOT_CONFIGURED';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode,
        details: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/onedrive/scan-files", async (req, res) => {
    try {
      const validatedData = scanFilesSchema.parse(req.body);
      const { folderPath, projectCode, includeSubfolders } = validatedData;

      let targetPath = folderPath;

      // If projectCode is provided, resolve to its mapped folder
      if (projectCode && !folderPath) {
        const mapping = await storage.getOneDriveMapping(projectCode);
        if (!mapping) {
          return res.status(404).json({
            error: `No OneDrive mapping found for project ${projectCode}. Please configure OneDrive for this project first.`
          });
        }
        targetPath = mapping.oneDriveFolderPath;
      } else if (!targetPath) {
        return res.status(400).json({
          error: 'Either folderPath or projectCode must be provided'
        });
      }


      // Scan OneDrive folder
      const files = await serverOneDriveService.scanFolderRecursive(targetPath, {
        includeSubfolders,
        maxDepth: includeSubfolders ? 5 : 1
      });

      // Index files in database
      const indexed = [];
      for (const file of files) {
        try {
          const fileIndex = await storage.createOrUpdateFileIndex({
            driveItemId: file.id,
            name: file.name,
            path: file.path || folderPath + '/' + file.name,
            size: file.size || 0,
            mimeType: file.mimeType || 'application/octet-stream',
            lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
            projectCode: projectCode || null,
            parentFolderId: file.parentFolderId || null,
            isFolder: file.folder || false,
            webUrl: file.webUrl || null,
            downloadUrl: file.downloadUrl || null
          });
          indexed.push(fileIndex);
        } catch (indexError) {
          console.error('Failed to index file:', file.name, indexError);
        }
      }

      res.json({
        success: true,
        scanned: files.length,
        indexed: indexed.length,
        files: files, // Return original OneDrive files with driveId, not database records
        path: targetPath,
        projectCode: projectCode || null
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error('Scan files failed:', error);
      res.status(500).json({ error: 'Failed to scan OneDrive files' });
    }
  });

  app.post("/api/onedrive/move-file", async (req, res) => {
    try {
      const { fileId, targetFolderId, targetPath, fileName } = req.body;

      if (!fileId || (!targetFolderId && !targetPath)) {
        return res.status(400).json({ error: 'File ID and target folder ID or path required' });
      }

      // Move file on OneDrive (with optional renaming)
      const result = await serverOneDriveService.moveFile(fileId, targetFolderId || targetPath, fileName);

      if (result) {
        // Update file index
        const updated = await storage.updateFileIndex(fileId, {
          path: result.path,
          parentFolderId: result.parentFolderId
        });

        res.json({ success: true, file: result, updated });
      } else {
        res.status(400).json({ error: 'Failed to move file on OneDrive' });
      }
    } catch (error) {
      console.error('Move file failed:', error);
      res.status(500).json({ error: 'Failed to move OneDrive file' });
    }
  });

  // Bulk rename files endpoint
  app.post("/api/onedrive/bulk-rename", async (req, res) => {
    try {
      const { operations } = req.body;

      if (!operations || !Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({ error: 'Operations array is required' });
      }

      if (operations.length > 100) {
        return res.status(400).json({ error: 'Too many operations. Maximum 100 files per request.' });
      }


      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const operation of operations) {
        const { fileId, driveId, originalName, newName } = operation;

        if (!fileId || !newName || !driveId) {
          results.push({
            original: originalName || 'Unknown',
            renamed: newName || 'Unknown',
            success: false,
            error: 'Missing required fields: fileId, driveId, or newName'
          });
          errorCount++;
          continue;
        }

        try {
          const client = await serverOneDriveService.getClient();
          const originalName = operation.originalName || `file_${fileId.substring(0, 8)}`;
          const driveId = operation.driveId;

          // Use proper drive-scoped API endpoint
          const updatePayload = { name: newName };
          let result;

          if (driveId) {
            // Use drive-specific endpoint for files in non-default drives
            result = await client.api(`/drives/${driveId}/items/${fileId}`).patch(updatePayload);
          } else {
            // Fallback to default drive
            const userId = process.env.MICROSOFT_USER_ID;
            const driveBase = userId ? `/users/${userId}/drive` : '/me/drive';
            result = await client.api(`${driveBase}/items/${fileId}`).patch(updatePayload);
          }

          if (result && result.name === newName) {
            // Update file index with new name
            await storage.updateFileIndex(fileId, {
              name: newName,
              path: result.parentReference?.path ? `${result.parentReference.path}/${newName}` : `/${newName}`
            });

            results.push({
              original: originalName,
              renamed: newName,
              success: true
            });
            successCount++;
          } else {
            results.push({
              original: originalName,
              renamed: newName,
              success: false,
              error: 'OneDrive API did not confirm the rename operation'
            });
            errorCount++;
          }
        } catch (error: any) {
          console.error(`❌ Failed to rename file ${fileId.substring(0, 8)}:`, error.message);

          // Handle specific error types
          if (error.message?.includes('File not found') || error.message?.includes('404')) {
            results.push({
              original: `File_${fileId.substring(0, 8)}`,
              renamed: newName,
              success: false,
              error: 'File not found - may have been moved or deleted from OneDrive'
            });
          } else {
            results.push({
              original: `File_${fileId.substring(0, 8)}`,
              renamed: newName,
              success: false,
              error: error.message || 'Unknown error'
            });
          }
          errorCount++;
        }

        // Add small delay to avoid rate limiting
        if (operations.indexOf(operation) < operations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const overallSuccess = errorCount === 0;

      res.json({
        success: overallSuccess,
        results: results,
        summary: {
          total: operations.length,
          successful: successCount,
          failed: errorCount
        }
      });
    } catch (error) {
      console.error('Bulk rename failed:', error);
      res.status(500).json({ error: 'Failed to perform bulk rename operation' });
    }
  });

  // Upload file to OneDrive endpoint
  app.post("/api/onedrive/upload-file", async (req, res) => {
    try {
      const { fileName, fileBuffer, targetPath, projectCode } = req.body;

      if (!fileName || !fileBuffer || !targetPath || !projectCode) {
        return res.status(400).json({
          error: 'File name, file buffer, target path, and project code are required'
        });
      }

      // Convert base64 file buffer to Buffer
      let buffer: Buffer;
      try {
        buffer = Buffer.from(fileBuffer, 'base64');
      } catch (error) {
        console.error('❌ Failed to decode file buffer:', error);
        return res.status(400).json({ error: 'Invalid file buffer format' });
      }

      // Create filename with project code prefix
      const createFileNameWithPrefix = (originalFileName: string, projectCode: string): string => {
        if (originalFileName.startsWith(`${projectCode}_`)) {
          return originalFileName;
        }
        return `${projectCode}_${originalFileName}`;
      };

      const renamedFileName = createFileNameWithPrefix(fileName, projectCode);

      // Upload file using OneDrive service
      const result = await serverOneDriveService.uploadFile(buffer, renamedFileName, targetPath);

      res.json({ success: true, file: result });

    } catch (error) {
      console.error('Upload file failed:', error);
      res.status(500).json({ error: 'Failed to upload file to OneDrive' });
    }
  });

  // OneDrive reconciliation endpoint
  app.post("/api/onedrive/reconcile", async (req, res) => {
    try {
      // Get orphaned projects (projects without OneDrive mappings)
      const orphanedProjects = await storage.getOrphanedProjects();

      if (orphanedProjects.length === 0) {
        return res.json({
          success: true,
          message: 'No orphaned projects found. All projects have OneDrive mappings.',
          processed: 0,
          results: []
        });
      }

      // Get root folder configuration
      const rootConfig = await storage.getSystemConfig('onedrive_root_folder');
      if (!rootConfig || !rootConfig.value || !(rootConfig.value as any).folderPath) {
        console.error('❌ OneDrive root folder not configured');
        return res.status(400).json({
          success: false,
          error: 'OneDrive root folder not configured. Please configure the root folder in system settings.'
        });
      }

      const rootPath = (rootConfig.value as any).folderPath;

      const results = [];

      for (const project of orphanedProjects) {

        try {
          // Try to find existing OneDrive folder for this project
          const folderPath = `${rootPath}/${project.code}`;
          // const existingFolder = await serverOneDriveService.findFolderByPath(folderPath); // Method not available
          const existingFolder = null; // Skipping folder lookup for now

          if (existingFolder) {
            // Folder exists - create mapping
            const mapping = await storage.createOneDriveMapping({
              projectCode: project.code,
              oneDriveFolderId: (existingFolder as any).id,
              oneDriveFolderName: (existingFolder as any).name,
              oneDriveFolderPath: folderPath
            });

            results.push({
              projectCode: project.code,
              status: 'mapped_existing',
              message: `Mapped to existing folder: ${folderPath}`,
              folderId: (existingFolder as any).id
            });
          } else {
            // Folder doesn't exist - create it with template
            const folderInfo = await serverOneDriveService.createProjectWithTemplate(
              rootPath,
              project.code,
              project.template,
              project.object // Pass project object (description) for folder naming
            );

            if (folderInfo) {
              // Create mapping for new folder
              const mapping = await storage.createOneDriveMapping({
                projectCode: project.code,
                oneDriveFolderId: folderInfo.id,
                oneDriveFolderName: folderInfo.name,
                oneDriveFolderPath: folderInfo.path
              });

              results.push({
                projectCode: project.code,
                status: 'created_new',
                message: `Created new folder with ${project.template} template: ${folderInfo.path}`,
                folderId: folderInfo.id
              });
            } else {
              results.push({
                projectCode: project.code,
                status: 'error',
                message: 'Failed to create OneDrive folder'
              });
            }
          }
        } catch (error: any) {
          console.error(`❌ Error processing project ${project.code}:`, error);
          results.push({
            projectCode: project.code,
            status: 'error',
            message: error.message || 'Unknown error occurred'
          });
        }
      }

      const successCount = results.filter(r => r.status !== 'error').length;

      res.json({
        success: true,
        message: `Reconciliation completed: ${successCount}/${results.length} projects processed successfully`,
        processed: results.length,
        results
      });
    } catch (error: any) {
      console.error('❌ OneDrive reconciliation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Reconciliation failed. Check server logs for details.',
        details: error.message
      });
    }
  });

  // Files Index management
  app.get("/api/files-index/stats", async (req, res) => {
    try {
      const files = await storage.getFilesIndex({ limit: 10000 });
      const totalFiles = files.length;
      const lastIndexed = files.length > 0
        ? files.reduce((latest, f) => {
            const d = (f as any).lastScanned ? new Date((f as any).lastScanned).getTime() : 0;
            return d > latest ? d : latest;
          }, 0)
        : null;
      res.json({
        totalFiles,
        indexedFiles: totalFiles,
        lastIndexed: lastIndexed ? new Date(lastIndexed).toISOString() : null,
      });
    } catch (error) {
      res.status(500).json({ totalFiles: 0, indexedFiles: 0, lastIndexed: null });
    }
  });

  app.get("/api/files-index", async (req, res) => {
    try {
      const { projectCode, path, limit = 100 } = req.query;
      const files = await storage.getFilesIndex({
        projectCode: projectCode as string,
        path: path as string,
        limit: parseInt(limit as string) || 100
      });
      res.json(files);
    } catch (error) {
      console.error('Get files index failed:', error);
      res.status(500).json({ error: 'Failed to get files index' });
    }
  });

  app.delete("/api/files-index/:driveItemId", async (req, res) => {
    try {
      const { driveItemId } = req.params;
      const deleted = await storage.deleteFileIndex(driveItemId);
      res.json({ success: !!deleted, deleted });
    } catch (error) {
      console.error('Delete file index failed:', error);
      res.status(500).json({ error: 'Failed to delete file index' });
    }
  });

  // OneDrive Integration Setup endpoint
  app.post("/api/integration/setup-onedrive", async (req, res) => {
    try {
      // Check if OneDrive is already configured (handle errors gracefully)
      let isConfigured = false;
      try {
        isConfigured = await serverOneDriveService.testConnection();
      } catch (connectionError) {
        // Expected when OneDrive is not configured - not an error for setup
        isConfigured = false;
      }

      if (isConfigured) {
        return res.json({
          success: true,
          message: "OneDrive is already configured and connected",
          alreadyConfigured: true
        });
      }

      // Return instructions for manual setup
      res.json({
        success: true,
        message: "OneDrive setup instructions",
        alreadyConfigured: false,
        instructions: {
          title: "Configura OneDrive",
          steps: [
            "1. Registra un'app su Azure AD (portal.azure.com > App Registrations)",
            "2. Configura i permessi Application: Files.ReadWrite.All, Sites.ReadWrite.All",
            "3. Imposta MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID nelle variabili d'ambiente",
            "4. Torna qui e clicca 'Ricarica Dati' per verificare la connessione"
          ],
          setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
          note: "L'integrazione OneDrive permette di sincronizzare automaticamente i tuoi progetti con il cloud storage Microsoft."
        }
      });
    } catch (error) {
      console.error('OneDrive setup endpoint failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check OneDrive integration status'
      });
    }
  });

  // OneDrive Archive Folder Configuration
  app.get("/api/onedrive/archive-folder", async (req, res) => {
    try {
      const config = await storage.getSystemConfig('onedrive_archive_folder');
      if (!config || !config.value) {
        // Auto-save default config with real folderId from OneDrive
        const folderPath = ONEDRIVE_DEFAULT_FOLDERS.ARCHIVE_FOLDER;
        let folderId = '';
        try {
          const items = await serverOneDriveService.listFiles('/');
          const match = items.find((f: any) => f.name === folderPath.replace('/', ''));
          if (match) folderId = match.id;
        } catch { /* OneDrive not connected yet, save without ID */ }

        const defaultConfig = {
          folderPath,
          folderId,
          folderName: folderPath.split('/').pop() || 'LAVORI_CONCLUSI',
          lastUpdated: new Date().toISOString()
        };

        await storage.setSystemConfig('onedrive_archive_folder', defaultConfig);

        return res.json({
          config: defaultConfig,
          configured: true
        });
      }
      res.json({ config: config.value, configured: true });
    } catch (error) {
      console.error('Error fetching archive folder config:', error);
      res.status(500).json({ message: "Errore nel recupero della configurazione archivio" });
    }
  });

  app.post("/api/onedrive/set-archive-folder", async (req, res) => {
    try {
      const { folderId, folderPath } = setRootFolderSchema.parse(req.body);
      const config = await storage.setSystemConfig('onedrive_archive_folder', {
        folderId,
        folderPath,
        folderName: folderPath.split('/').pop() || folderPath,
        lastUpdated: new Date().toISOString()
      });
      res.json({ config: config.value });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      console.error('Error setting archive folder:', error);
      res.status(500).json({ message: "Errore nella configurazione della cartella archivio" });
    }
  });

  app.delete("/api/onedrive/archive-folder", async (req, res) => {
    try {
      await storage.setSystemConfig('onedrive_archive_folder', null);
      res.json({ message: "Configurazione archivio rimossa" });
    } catch (error) {
      console.error('Error deleting archive folder config:', error);
      res.status(500).json({ message: "Errore nella rimozione della configurazione archivio" });
    }
  });
}
