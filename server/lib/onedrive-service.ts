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
}

// Export singleton instance
export const serverOneDriveService = new ServerOneDriveService();
export default serverOneDriveService;