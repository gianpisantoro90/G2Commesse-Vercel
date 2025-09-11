import { Client } from '@microsoft/microsoft-graph-client';
import { getUncachableOneDriveClient } from './onedrive-client';

export interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  downloadUrl: string;
  lastModified: string;
  webUrl: string;
  folder?: boolean;
  parentPath?: string;
  // Additional properties added by scanFolderRecursive
  path?: string;
  mimeType?: string;
  parentFolderId?: string;
}

export interface OneDriveUploadResult {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  downloadUrl: string;
}

class ServerOneDriveService {
  private client: Client | null = null;

  async getClient(): Promise<Client> {
    this.client = await getUncachableOneDriveClient();
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.getClient();
      
      // Test by getting user profile
      await client.api('/me').get();
      console.log('✅ OneDrive connection test successful (Server)');
      return true;
    } catch (error) {
      console.error('❌ OneDrive connection test failed (Server):', error);
      return false;
    }
  }

  async getUserInfo(): Promise<{ name: string; email: string } | null> {
    try {
      const client = await this.getClient();

      const user = await client.api('/me').get();
      return {
        name: user.displayName || 'Unknown User',
        email: user.mail || user.userPrincipalName || 'No email'
      };
    } catch (error) {
      console.error('❌ Failed to get user info (Server):', error);
      return null;
    }
  }

  async listFiles(folderPath = '/G2_Progetti'): Promise<OneDriveFile[]> {
    try {
      const client = await this.getClient();

      // Security: Validate and sanitize folder path
      if (!folderPath || typeof folderPath !== 'string') {
        throw new Error('Invalid folder path provided');
      }
      
      // Prevent path traversal attacks
      const sanitizedPath = folderPath.replace(/\.\./g, '').replace(/\/+/g, '/');
      if (sanitizedPath !== folderPath) {
        throw new Error('Invalid characters in folder path');
      }

      // Only create G2_Progetti folder if we're accessing it specifically
      if (sanitizedPath === '/G2_Progetti') {
        await this.ensureG2ProjectsFolder();
      }

      let apiUrl;
      if (sanitizedPath === '/' || sanitizedPath === '') {
        // Root directory
        apiUrl = '/me/drive/root/children';
      } else {
        // Specific folder path - already sanitized
        apiUrl = `/me/drive/root:${sanitizedPath}:/children`;
      }

      const response = await client.api(apiUrl).get();

      return response.value.map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size || 0,
        downloadUrl: item['@microsoft.graph.downloadUrl'] || '',
        lastModified: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        folder: !!item.folder,
        parentPath: folderPath
      }));
    } catch (error) {
      console.error('❌ Failed to list OneDrive files (Server):', error);
      return [];
    }
  }

  async createFolder(folderName: string, parentPath = '/G2_Progetti'): Promise<boolean> {
    try {
      const client = await this.getClient();

      await this.ensureG2ProjectsFolder();

      const folderData = {
        name: folderName,
        folder: {}
      };

      await client
        .api(`/me/drive/root:${parentPath}:/children`)
        .post(folderData);

      console.log(`✅ Created OneDrive folder (Server): ${parentPath}/${folderName}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to create OneDrive folder (Server):', error);
      return false;
    }
  }

  async syncProjectFolder(projectCode: string, projectDescription: string): Promise<boolean> {
    try {
      // Ensure main G2_Progetti folder exists
      await this.ensureG2ProjectsFolder();

      // Create project folder
      const success = await this.createFolder(projectCode);
      
      if (success) {
        console.log(`✅ Synced project folder to OneDrive (Server): ${projectCode}`);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to sync project folder (Server):', error);
      return false;
    }
  }

  private async ensureG2ProjectsFolder(): Promise<void> {
    try {
      const client = await this.getClient();

      // Check if G2_Progetti folder exists
      await client.api('/me/drive/root:/G2_Progetti').get();
    } catch (error) {
      // Folder doesn't exist, create it
      try {
        const client = await this.getClient();
        const folderData = {
          name: 'G2_Progetti',
          folder: {}
        };

        await client.api('/me/drive/root/children').post(folderData);
        console.log('✅ Created G2_Progetti folder in OneDrive (Server)');
      } catch (createError) {
        console.error('❌ Failed to create G2_Progetti folder (Server):', createError);
      }
    }
  }

  async downloadFile(fileId: string): Promise<Buffer | null> {
    try {
      const client = await this.getClient();
      
      // Security: Validate fileId parameter
      if (!fileId || typeof fileId !== 'string') {
        throw new Error('Invalid file ID provided');
      }
      
      // Basic fileId format validation
      if (!/^[a-zA-Z0-9!\-_\.~]+$/.test(fileId)) {
        throw new Error('File ID contains invalid characters');
      }

      const response = await client
        .api(`/me/drive/items/${fileId}/content`)
        .get();

      return response;
    } catch (error) {
      console.error('❌ Failed to download file from OneDrive (Server):', error);
      return null;
    }
  }

  async getFolderHierarchy(): Promise<OneDriveFile[]> {
    try {
      const client = await this.getClient();
      
      // Get root folders first
      const response = await client.api('/me/drive/root/children').get();
      
      return response.value
        .filter((item: any) => !!item.folder)
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          size: 0,
          downloadUrl: '',
          lastModified: item.lastModifiedDateTime,
          webUrl: item.webUrl,
          folder: true,
          parentPath: '/'
        }));
    } catch (error) {
      console.error('❌ Failed to get OneDrive folder hierarchy (Server):', error);
      return [];
    }
  }

  async searchFiles(query: string): Promise<OneDriveFile[]> {
    try {
      const client = await this.getClient();
      
      // Security: Validate and sanitize search query
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Invalid search query provided');
      }
      
      if (query.length > 255) {
        throw new Error('Search query too long');
      }
      
      // Use proper parameter encoding to prevent injection
      const response = await client
        .api('/me/drive/root/search(q=@q)')
        .query({ '@q': query.trim() })
        .get();

      return response.value.map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size || 0,
        downloadUrl: item['@microsoft.graph.downloadUrl'] || '',
        lastModified: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        folder: !!item.folder,
        parentPath: item.parentReference?.path?.replace('/drive/root:', '') || '/'
      }));
    } catch (error) {
      console.error('❌ Failed to search OneDrive files (Server):', error);
      return [];
    }
  }

  async getFileContent(fileId: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      
      // Security: Validate fileId parameter
      if (!fileId || typeof fileId !== 'string') {
        throw new Error('Invalid file ID provided');
      }
      
      // Basic fileId format validation (OneDrive IDs are alphanumeric with some special chars)
      if (!/^[a-zA-Z0-9!\-_\.~]+$/.test(fileId)) {
        throw new Error('File ID contains invalid characters');
      }
      
      // Get file info first
      const fileInfo = await client.api(`/me/drive/items/${fileId}`).get();
      const mimeType = fileInfo.file?.mimeType || '';
      
      // Only try to get text content for text files
      if (!mimeType.startsWith('text/') && !mimeType.includes('json') && !mimeType.includes('xml')) {
        return null;
      }
      
      const content = await client.api(`/me/drive/items/${fileId}/content`).get();
      return content.toString('utf-8');
    } catch (error) {
      console.error('❌ Failed to get file content (Server):', error);
      return null;
    }
  }

  async linkProjectToFolder(projectCode: string, oneDriveFolderId: string, folderName: string, folderPath: string): Promise<boolean> {
    try {
      // Security: Validate parameters
      if (!projectCode || !oneDriveFolderId || !folderName || !folderPath) {
        throw new Error('Missing required parameters for project linking');
      }
      
      if (typeof projectCode !== 'string' || typeof oneDriveFolderId !== 'string') {
        throw new Error('Invalid parameter types for project linking');
      }
      
      // Validate OneDrive folder exists by getting its info
      const client = await this.getClient();
      await client.api(`/me/drive/items/${oneDriveFolderId}`).get();
      
      console.log(`🔗 Linking project ${projectCode} to OneDrive folder ${oneDriveFolderId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to link project to OneDrive folder (Server):', error);
      return false;
    }
  }

  async validateFolder(folderIdOrPath: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      
      // Security: Validate parameter
      if (!folderIdOrPath || typeof folderIdOrPath !== 'string') {
        throw new Error('Invalid folder ID or path provided');
      }
      
      // Check if it's a path or ID
      if (folderIdOrPath.startsWith('/')) {
        // It's a path
        const sanitizedPath = folderIdOrPath.replace(/\.\./g, '').replace(/\/+/g, '/');
        if (sanitizedPath !== folderIdOrPath) {
          throw new Error('Invalid characters in folder path');
        }
        await client.api(`/me/drive/root:${sanitizedPath}`).get();
      } else {
        // It's an ID
        if (!/^[a-zA-Z0-9!\-_\.~]+$/.test(folderIdOrPath)) {
          throw new Error('Folder ID contains invalid characters');
        }
        await client.api(`/me/drive/items/${folderIdOrPath}`).get();
      }
      
      console.log('✅ OneDrive folder validation successful:', folderIdOrPath);
      return true;
    } catch (error) {
      console.error('❌ OneDrive folder validation failed:', error);
      return false;
    }
  }

  async createProjectWithTemplate(rootPath: string, projectCode: string, template: string): Promise<{id: string, name: string, path: string} | null> {
    try {
      const client = await this.getClient();
      
      // Security: Validate parameters
      if (!rootPath || !projectCode || !template) {
        throw new Error('Missing required parameters for project creation');
      }
      
      if (!['LUNGO', 'BREVE'].includes(template)) {
        throw new Error('Invalid template specified. Must be LUNGO or BREVE');
      }
      
      // Sanitize inputs
      const sanitizedRootPath = rootPath.replace(/\.\./g, '').replace(/\/+/g, '/');
      const sanitizedProjectCode = projectCode.replace(/[^a-zA-Z0-9_-]/g, '');
      
      if (sanitizedRootPath !== rootPath || sanitizedProjectCode !== projectCode) {
        throw new Error('Invalid characters in parameters');
      }
      
      // Create project folder
      const projectFolderData = {
        name: sanitizedProjectCode,
        folder: {}
      };
      
      const projectFolder = await client
        .api(`/me/drive/root:${sanitizedRootPath}:/children`)
        .post(projectFolderData);
      
      // Copy template structure based on template type
      const projectPath = `${sanitizedRootPath}/${sanitizedProjectCode}`;
      
      try {
        // Create basic folder structure based on template
        await this.copyTemplateStructure(projectPath, template);
      } catch (templateError) {
        console.warn('⚠️ Template structure copy failed, project folder created without template:', templateError);
      }
      
      console.log(`✅ Created OneDrive project folder with ${template} template:`, projectPath);
      return {
        id: projectFolder.id,
        name: projectFolder.name,
        path: projectPath
      };
    } catch (error) {
      console.error('❌ Failed to create OneDrive project folder:', error);
      return null;
    }
  }

  async scanFolderRecursive(folderPath: string, options: {includeSubfolders: boolean, maxDepth: number}): Promise<OneDriveFile[]> {
    try {
      const client = await this.getClient();
      
      // Security: Validate parameters
      if (!folderPath || typeof folderPath !== 'string') {
        throw new Error('Invalid folder path provided');
      }
      
      const maxDepth = Math.min(options.maxDepth || 3, 10); // Limit max depth to prevent infinite recursion
      const sanitizedPath = folderPath.replace(/\.\./g, '').replace(/\/+/g, '/');
      
      if (sanitizedPath !== folderPath) {
        throw new Error('Invalid characters in folder path');
      }
      
      return await this.scanFolderRecursiveInternal(sanitizedPath, 0, maxDepth, options.includeSubfolders);
    } catch (error) {
      console.error('❌ Failed to scan OneDrive folder recursively:', error);
      return [];
    }
  }

  async moveFile(fileId: string, targetFolderIdOrPath: string): Promise<{name: string, path: string, parentFolderId: string} | null> {
    try {
      const client = await this.getClient();
      
      // Security: Validate parameters
      if (!fileId || !targetFolderIdOrPath) {
        throw new Error('Missing required parameters for file move');
      }
      
      if (!/^[a-zA-Z0-9!\-_\.~]+$/.test(fileId)) {
        throw new Error('File ID contains invalid characters');
      }
      
      // Get target folder info
      let targetFolderId: string;
      let targetPath: string;
      
      if (targetFolderIdOrPath.startsWith('/')) {
        // It's a path
        const sanitizedPath = targetFolderIdOrPath.replace(/\.\./g, '').replace(/\/+/g, '/');
        if (sanitizedPath !== targetFolderIdOrPath) {
          throw new Error('Invalid characters in target path');
        }
        
        const targetFolder = await client.api(`/me/drive/root:${sanitizedPath}`).get();
        targetFolderId = targetFolder.id;
        targetPath = sanitizedPath;
      } else {
        // It's an ID
        if (!/^[a-zA-Z0-9!\-_\.~]+$/.test(targetFolderIdOrPath)) {
          throw new Error('Target folder ID contains invalid characters');
        }
        
        const targetFolder = await client.api(`/me/drive/items/${targetFolderIdOrPath}`).get();
        targetFolderId = targetFolder.id;
        targetPath = targetFolder.parentReference?.path?.replace('/drive/root:', '') + '/' + targetFolder.name || '/';
      }
      
      // Move the file
      const moveData = {
        parentReference: {
          id: targetFolderId
        }
      };
      
      const movedFile = await client
        .api(`/me/drive/items/${fileId}`)
        .patch(moveData);
      
      console.log('✅ Moved OneDrive file:', movedFile.name);
      return {
        name: movedFile.name,
        path: targetPath + '/' + movedFile.name,
        parentFolderId: targetFolderId
      };
    } catch (error) {
      console.error('❌ Failed to move OneDrive file:', error);
      return null;
    }
  }

  private async scanFolderRecursiveInternal(folderPath: string, currentDepth: number, maxDepth: number, includeSubfolders: boolean): Promise<OneDriveFile[]> {
    const client = await this.getClient();
    const allFiles: OneDriveFile[] = [];
    
    // Get items in current folder
    let apiUrl: string;
    if (folderPath === '/' || folderPath === '') {
      apiUrl = '/me/drive/root/children';
    } else {
      apiUrl = `/me/drive/root:${folderPath}:/children`;
    }
    
    const response = await client.api(apiUrl).get();
    
    for (const item of response.value) {
      const fileInfo: OneDriveFile = {
        id: item.id,
        name: item.name,
        size: item.size || 0,
        downloadUrl: item['@microsoft.graph.downloadUrl'] || '',
        lastModified: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        folder: !!item.folder,
        parentPath: folderPath
      };
      
      // Add additional properties for better indexing
      if (item.file) {
        (fileInfo as any).mimeType = item.file.mimeType;
      }
      if (item.parentReference) {
        (fileInfo as any).parentFolderId = item.parentReference.id;
      }
      (fileInfo as any).path = folderPath === '/' ? `/${item.name}` : `${folderPath}/${item.name}`;
      
      allFiles.push(fileInfo);
      
      // Recursively scan subfolders if enabled and within depth limit
      if (item.folder && includeSubfolders && currentDepth < maxDepth) {
        const subFolderPath = folderPath === '/' ? `/${item.name}` : `${folderPath}/${item.name}`;
        const subFiles = await this.scanFolderRecursiveInternal(subFolderPath, currentDepth + 1, maxDepth, includeSubfolders);
        allFiles.push(...subFiles);
      }
    }
    
    return allFiles;
  }

  private async copyTemplateStructure(projectPath: string, template: string): Promise<void> {
    // Create basic folder structure based on template type
    const client = await this.getClient();
    
    if (template === 'LUNGO') {
      const lungoFolders = [
        '1_CONSEGNA', '2_PERMIT', '3_PROGETTO', '4_MATERIALE_RICEVUTO',
        '5_CANTIERE', '6_VERBALI_NOTIFICHE_COMUNICAZIONI', '7_SOPRALLUOGHI',
        '8_VARIANTI', '9_PARCELLA', '10_INCARICO'
      ];
      
      for (const folderName of lungoFolders) {
        try {
          await client
            .api(`/me/drive/root:${projectPath}:/children`)
            .post({ name: folderName, folder: {} });
        } catch (error) {
          console.warn(`⚠️ Failed to create folder ${folderName}:`, error);
        }
      }
    } else if (template === 'BREVE') {
      const breveFolders = ['CONSEGNA', 'ELABORAZIONI', 'MATERIALE_RICEVUTO', 'SOPRALLUOGHI'];
      
      for (const folderName of breveFolders) {
        try {
          await client
            .api(`/me/drive/root:${projectPath}:/children`)
            .post({ name: folderName, folder: {} });
        } catch (error) {
          console.warn(`⚠️ Failed to create folder ${folderName}:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const serverOneDriveService = new ServerOneDriveService();
export default serverOneDriveService;