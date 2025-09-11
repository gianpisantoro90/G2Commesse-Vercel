import { Client } from '@microsoft/microsoft-graph-client';
import { getUncachableOneDriveClient } from './onedrive-client';

// Enhanced utility to read GraphError body content with better debugging
async function readGraphErrorBody(error: any): Promise<{ body: string; bodyType: string; rawError: any }> {
  console.log('🔍 Reading GraphError body. Error properties:', {
    hasBody: !!error.body,
    bodyType: error.body ? typeof error.body : 'undefined',
    bodyConstructor: error.body?.constructor?.name,
    isReadableStream: error.body && typeof error.body.getReader === 'function',
    statusCode: error.statusCode || error.status,
    message: error.message,
    code: error.code
  });

  try {
    if (error.body && typeof error.body.getReader === 'function') {
      console.log('📖 Attempting to read ReadableStream body...');
      const reader = error.body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      
      let done = false;
      let chunkCount = 0;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunkCount++;
          const chunk = decoder.decode(value, { stream: !done });
          result += chunk;
          console.log(`📄 Read chunk ${chunkCount}: ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
        }
      }
      
      console.log(`✅ Successfully read ReadableStream body (${result.length} characters):`, result);
      return { body: result, bodyType: 'ReadableStream', rawError: error };
    } else if (error.body && typeof error.body === 'string') {
      console.log('📄 String body found:', error.body);
      return { body: error.body, bodyType: 'string', rawError: error };
    } else if (error.body && typeof error.body === 'object') {
      const jsonBody = JSON.stringify(error.body);
      console.log('📄 Object body found:', jsonBody);
      return { body: jsonBody, bodyType: 'object', rawError: error };
    } else {
      console.log('⚠️ No readable body found. Error object:', JSON.stringify({
        message: error.message,
        statusCode: error.statusCode || error.status,
        code: error.code,
        name: error.name
      }, null, 2));
      return { body: `No readable body. Message: ${error.message}`, bodyType: 'none', rawError: error };
    }
  } catch (readError) {
    console.error('❌ Failed to read GraphError body:', {
      readErrorMessage: readError.message,
      readErrorStack: readError.stack,
      originalError: {
        message: error.message,
        statusCode: error.statusCode,
        code: error.code
      }
    });
    return { 
      body: `Failed to read error body: ${readError.message}`, 
      bodyType: 'error', 
      rawError: { originalError: error, readError } 
    };
  }
}

// Enhanced error handler for Microsoft Graph API calls
async function handleGraphError(error: any, operation: string, details: any = {}): Promise<never> {
  console.log(`🚨 Handling Microsoft Graph API Error [${operation}] - Initial error object:`, {
    name: error.name,
    message: error.message,
    statusCode: error.statusCode || error.status,
    code: error.code,
    requestId: error.requestId,
    date: error.date
  });

  const errorResult = await readGraphErrorBody(error);
  const { body: errorBody, bodyType, rawError } = errorResult;
  
  const errorDetails = {
    operation,
    statusCode: error.statusCode || error.status,
    code: error.code,
    requestId: error.requestId,
    date: error.date,
    message: error.message,
    body: errorBody,
    bodyType: bodyType,
    details,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  console.error(`❌ Microsoft Graph API Error [${operation}]:`, JSON.stringify(errorDetails, null, 2));
  
  // Parse error body to extract specific error information
  let specificError = error.message || 'Microsoft Graph API error';
  let errorCode = error.code;
  
  try {
    const parsedBody = JSON.parse(errorBody);
    if (parsedBody.error) {
      if (parsedBody.error.message) {
        specificError = parsedBody.error.message;
        console.log(`🔍 Parsed error message: ${specificError}`);
      }
      if (parsedBody.error.code) {
        errorCode = parsedBody.error.code;
        specificError = `[${parsedBody.error.code}] ${specificError}`;
        console.log(`🔍 Parsed error code: ${errorCode}`);
      }
      if (parsedBody.error.innerError) {
        console.log(`🔍 Inner error details:`, parsedBody.error.innerError);
      }
    }
  } catch (parseError) {
    console.log(`⚠️ Failed to parse error body as JSON:`, parseError.message);
    // If body is not JSON, use the raw body
    if (errorBody && errorBody !== 'Unable to read error body' && errorBody !== 'Failed to read error body') {
      specificError = errorBody;
    }
  }

  console.log(`🚨 Final error details for ${operation}:`, {
    specificError,
    errorCode,
    statusCode: error.statusCode || error.status,
    operation,
    details
  });
  
  throw new Error(`${operation} failed: ${specificError} (Status: ${error.statusCode || error.status})`);
}

// Enhanced Microsoft Graph API request/response logging
function logGraphRequest(operation: string, apiPath: string, method: string = 'GET', body?: any, headers?: any) {
  console.log(`🚀 Microsoft Graph API Request [${operation}]:`, {
    method: method.toUpperCase(),
    path: apiPath,
    fullUrl: `https://graph.microsoft.com/v1.0${apiPath}`,
    body: body ? JSON.stringify(body, null, 2) : undefined,
    hasBody: !!body,
    headers: headers ? JSON.stringify(headers, null, 2) : 'default',
    timestamp: new Date().toISOString()
  });
}

function logGraphResponse(operation: string, response: any, error?: any) {
  if (error) {
    console.error(`❌ Microsoft Graph API Response Error [${operation}]:`, {
      hasError: true,
      errorType: error.constructor?.name,
      statusCode: error.statusCode || error.status,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });
  } else {
    console.log(`✅ Microsoft Graph API Response Success [${operation}]:`, {
      hasError: false,
      responseType: response?.constructor?.name || typeof response,
      hasData: !!response,
      dataSize: response ? (Array.isArray(response.value) ? response.value.length : 'single-item') : 'no-data',
      timestamp: new Date().toISOString()
    });
  }
}

// Validate OneDrive folder name according to Microsoft Graph API restrictions
function validateOneDriveFolderName(name: string): { isValid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Folder name is required' };
  }

  // Microsoft Graph/OneDrive restrictions
  const invalidChars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  
  // Check length (OneDrive has 256 character limit for names)
  if (name.length > 256) {
    return { isValid: false, error: 'Folder name cannot exceed 256 characters' };
  }
  
  // Check for empty or whitespace-only names
  if (name.trim().length === 0) {
    return { isValid: false, error: 'Folder name cannot be empty or contain only whitespace' };
  }
  
  // Check for invalid characters
  const foundInvalidChar = invalidChars.find(char => name.includes(char));
  if (foundInvalidChar) {
    return { isValid: false, error: `Folder name cannot contain "${foundInvalidChar}" character` };
  }
  
  // Check for reserved names (case-insensitive)
  const upperName = name.toUpperCase();
  if (reservedNames.includes(upperName)) {
    return { isValid: false, error: `"${name}" is a reserved name and cannot be used` };
  }
  
  // Check for names that end with a period or space (not allowed)
  if (name.endsWith('.') || name.endsWith(' ')) {
    return { isValid: false, error: 'Folder name cannot end with a period or space' };
  }
  
  // Check for names that start with a period (not recommended)
  if (name.startsWith('.')) {
    return { isValid: false, error: 'Folder name cannot start with a period' };
  }
  
  return { isValid: true };
}

// Validate OneDrive path according to Microsoft Graph API restrictions
function validateOneDrivePath(path: string): { isValid: boolean; error?: string } {
  if (!path || typeof path !== 'string') {
    return { isValid: false, error: 'Path is required' };
  }

  // OneDrive has a 400 character limit for full paths
  if (path.length > 400) {
    return { isValid: false, error: 'Path cannot exceed 400 characters' };
  }
  
  // Validate each segment of the path
  const segments = path.split('/').filter(segment => segment.length > 0);
  
  for (const segment of segments) {
    const validation = validateOneDriveFolderName(segment);
    if (!validation.isValid) {
      return { isValid: false, error: `Invalid path segment "${segment}": ${validation.error}` };
    }
  }
  
  return { isValid: true };
}

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

      logGraphRequest('List Files', apiUrl, 'GET');
      
      let response;
      try {
        response = await client.api(apiUrl).get();
        logGraphResponse('List Files', response);
      } catch (apiError: any) {
        logGraphResponse('List Files', null, apiError);
        await handleGraphError(apiError, 'List Files', {
          folderPath: sanitizedPath,
          apiUrl,
          operation: 'GET /me/drive/root:path:/children'
        });
      }

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

      const apiUrl = `/me/drive/root:${parentPath}:/children`;
      logGraphRequest('Create Folder', apiUrl, 'POST', folderData);

      try {
        const response = await client.api(apiUrl).post(folderData);
        logGraphResponse('Create Folder', response);
        console.log(`✅ Created OneDrive folder (Server): ${parentPath}/${folderName}`);
        return true;
      } catch (apiError: any) {
        logGraphResponse('Create Folder', null, apiError);
        await handleGraphError(apiError, 'Create Folder', {
          folderName,
          parentPath,
          folderData,
          apiUrl,
          operation: 'POST /me/drive/root:parentPath:/children'
        });
      }
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
      const checkUrl = '/me/drive/root:/G2_Progetti';
      logGraphRequest('Check G2_Progetti Folder', checkUrl, 'GET');
      
      try {
        const checkResponse = await client.api(checkUrl).get();
        logGraphResponse('Check G2_Progetti Folder', checkResponse);
        console.log('✅ G2_Progetti folder already exists (Server)');
      } catch (checkError: any) {
        logGraphResponse('Check G2_Progetti Folder', null, checkError);
        
        // Folder doesn't exist, create it
        console.log('📁 G2_Progetti folder does not exist, creating it...');
        const client = await this.getClient();
        const folderData = {
          name: 'G2_Progetti',
          folder: {}
        };

        const createUrl = '/me/drive/root/children';
        logGraphRequest('Create G2_Progetti Folder', createUrl, 'POST', folderData);
        
        try {
          const createResponse = await client.api(createUrl).post(folderData);
          logGraphResponse('Create G2_Progetti Folder', createResponse);
          console.log('✅ Created G2_Progetti folder in OneDrive (Server)');
        } catch (createError: any) {
          logGraphResponse('Create G2_Progetti Folder', null, createError);
          await handleGraphError(createError, 'Create G2_Progetti Folder', {
            folderData,
            createUrl,
            operation: 'POST /me/drive/root/children'
          });
        }
      }
    } catch (outerError) {
      console.error('❌ Failed in ensureG2ProjectsFolder (Server):', outerError);
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
      
      console.log(`🚀 Starting project creation with template:`, { rootPath, projectCode, template });
      
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
      
      console.log(`🔧 After sanitization:`, { 
        originalRootPath: rootPath, 
        sanitizedRootPath, 
        originalProjectCode: projectCode, 
        sanitizedProjectCode 
      });
      
      if (sanitizedRootPath !== rootPath || sanitizedProjectCode !== projectCode) {
        throw new Error('Invalid characters in parameters');
      }
      
      // Create project folder
      const projectFolderData = {
        name: sanitizedProjectCode,
        folder: {}
      };
      
      const apiPath = `/me/drive/root:${sanitizedRootPath}:/children`;
      logGraphRequest('Create Project Folder', apiPath, 'POST', projectFolderData);
      
      let projectFolder;
      try {
        projectFolder = await client
          .api(apiPath)
          .post(projectFolderData);
          
        console.log(`✅ Successfully created project folder:`, {
          id: projectFolder.id,
          name: projectFolder.name,
          size: projectFolder.size,
          webUrl: projectFolder.webUrl
        });
      } catch (error: any) {
        await handleGraphError(error, 'Create Project Folder', {
          rootPath: sanitizedRootPath,
          projectCode: sanitizedProjectCode,
          template,
          apiPath
        });
      }
      
      // Copy template structure based on template type
      const projectPath = `${sanitizedRootPath}/${sanitizedProjectCode}`;
      
      try {
        // Create basic folder structure based on template
        await this.copyTemplateStructure(projectPath, template);
      } catch (templateError: any) {
        console.warn('⚠️ Template structure copy failed, project folder created without template:', {
          error: templateError.message || templateError,
          projectPath,
          template
        });
      }
      
      console.log(`✅ Created OneDrive project folder with ${template} template:`, projectPath);
      return {
        id: projectFolder.id,
        name: projectFolder.name,
        path: projectPath
      };
    } catch (error: any) {
      console.error('❌ Failed to create OneDrive project folder:', {
        message: error.message,
        stack: error.stack,
        rootPath,
        projectCode,
        template
      });
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
    console.log(`🔄 Creating ${template} template structure at: ${projectPath}`);
    
    // Create basic folder structure based on template type
    const client = await this.getClient();
    const errors: string[] = [];
    
    if (template === 'LUNGO') {
      const lungoFolders = [
        '1_CONSEGNA', '2_PERMIT', '3_PROGETTO', '4_MATERIALE_RICEVUTO',
        '5_CANTIERE', '6_VERBALI_NOTIFICHE_COMUNICAZIONI', '7_SOPRALLUOGHI',
        '8_VARIANTI', '9_PARCELLA', '10_INCARICO'
      ];
      
      console.log(`📁 Creating ${lungoFolders.length} LUNGO template folders...`);
      
      for (const folderName of lungoFolders) {
        const folderData = { name: folderName, folder: {} };
        const apiPath = `/me/drive/root:${projectPath}:/children`;
        
        logGraphRequest('Create Template Folder (LUNGO)', apiPath, 'POST', folderData);
        
        try {
          const response = await client
            .api(apiPath)
            .post(folderData);
            
          console.log(`✅ Successfully created template folder: ${folderName}`, {
            id: response.id,
            name: response.name,
            webUrl: response.webUrl
          });
        } catch (error: any) {
          try {
            await handleGraphError(error, `Create Template Folder (LUNGO) - ${folderName}`, {
              projectPath,
              folderName,
              template: 'LUNGO',
              apiPath
            });
          } catch (handledError: any) {
            const errorMsg = `Failed to create folder ${folderName}: ${handledError.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      }
    } else if (template === 'BREVE') {
      const breveFolders = ['CONSEGNA', 'ELABORAZIONI', 'MATERIALE_RICEVUTO', 'SOPRALLUOGHI'];
      
      console.log(`📁 Creating ${breveFolders.length} BREVE template folders...`);
      
      for (const folderName of breveFolders) {
        const folderData = { name: folderName, folder: {} };
        const apiPath = `/me/drive/root:${projectPath}:/children`;
        
        logGraphRequest('Create Template Folder (BREVE)', apiPath, 'POST', folderData);
        
        try {
          const response = await client
            .api(apiPath)
            .post(folderData);
            
          console.log(`✅ Successfully created template folder: ${folderName}`, {
            id: response.id,
            name: response.name,
            webUrl: response.webUrl
          });
        } catch (error: any) {
          try {
            await handleGraphError(error, `Create Template Folder (BREVE) - ${folderName}`, {
              projectPath,
              folderName,
              template: 'BREVE',
              apiPath
            });
          } catch (handledError: any) {
            const errorMsg = `Failed to create folder ${folderName}: ${handledError.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      }
    } else {
      throw new Error(`Unknown template type: ${template}`);
    }
    
    if (errors.length > 0) {
      console.warn(`⚠️  Template structure partially failed. Errors:`, errors);
      throw new Error(`Template structure creation failed: ${errors.join(', ')}`);
    }
    
    console.log(`✅ Successfully created all ${template} template folders`);
  }
}

// Export singleton instance
export const serverOneDriveService = new ServerOneDriveService();
export default serverOneDriveService;