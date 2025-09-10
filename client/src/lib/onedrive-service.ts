import { Client } from '@microsoft/microsoft-graph-client';

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

class OneDriveService {
  private client: Client | null = null;
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    try {
      // Use the integration client from the blueprint
      const { getUncachableOneDriveClient } = await import('./onedrive-client');
      this.client = await getUncachableOneDriveClient();
      this.isInitialized = true;
      console.log('✅ OneDrive service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize OneDrive service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.client) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('OneDrive service not available. Please check your connection.');
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      if (!this.client) return false;
      
      // Test by getting user profile
      await this.client.api('/me').get();
      console.log('✅ OneDrive connection test successful');
      return true;
    } catch (error) {
      console.error('❌ OneDrive connection test failed:', error);
      return false;
    }
  }

  async getUserInfo(): Promise<{ name: string; email: string } | null> {
    try {
      await this.ensureInitialized();
      if (!this.client) return null;

      const user = await this.client.api('/me').get();
      return {
        name: user.displayName || 'Unknown User',
        email: user.mail || user.userPrincipalName || 'No email'
      };
    } catch (error) {
      console.error('❌ Failed to get user info:', error);
      return null;
    }
  }

  async listFiles(folderPath = '/G2_Progetti'): Promise<OneDriveFile[]> {
    try {
      await this.ensureInitialized();
      if (!this.client) return [];

      // Create G2_Progetti folder if it doesn't exist
      await this.ensureG2ProjectsFolder();

      const response = await this.client
        .api(`/me/drive/root:${folderPath}:/children`)
        .get();

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
      console.error('❌ Failed to list OneDrive files:', error);
      return [];
    }
  }

  async createFolder(folderName: string, parentPath = '/G2_Progetti'): Promise<boolean> {
    try {
      await this.ensureInitialized();
      if (!this.client) return false;

      await this.ensureG2ProjectsFolder();

      const folderData = {
        name: folderName,
        folder: {}
      };

      await this.client
        .api(`/me/drive/root:${parentPath}:/children`)
        .post(folderData);

      console.log(`✅ Created OneDrive folder: ${parentPath}/${folderName}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to create OneDrive folder:', error);
      return false;
    }
  }

  async uploadFile(
    file: File, 
    projectCode: string, 
    targetFolder?: string
  ): Promise<OneDriveUploadResult | null> {
    try {
      await this.ensureInitialized();
      if (!this.client) return null;

      // Ensure project folder structure exists
      const projectPath = `/G2_Progetti/${projectCode}`;
      await this.createFolder(projectCode);
      
      if (targetFolder) {
        await this.createFolder(targetFolder, projectPath);
      }

      const uploadPath = targetFolder 
        ? `${projectPath}/${targetFolder}/${file.name}`
        : `${projectPath}/${file.name}`;

      let uploadResponse;

      // Use different upload methods based on file size
      if (file.size < 4 * 1024 * 1024) { // 4MB
        // Simple upload for small files
        uploadResponse = await this.client
          .api(`/me/drive/root:${uploadPath}:/content`)
          .put(file);
      } else {
        // Resumable upload for larger files
        const uploadSession = await this.client
          .api(`/me/drive/root:${uploadPath}:/createUploadSession`)
          .post({});

        uploadResponse = await this.client
          .api(uploadSession.uploadUrl)
          .put(file);
      }

      console.log(`✅ Uploaded file to OneDrive: ${uploadPath}`);
      return {
        id: uploadResponse.id,
        name: uploadResponse.name,
        size: uploadResponse.size,
        webUrl: uploadResponse.webUrl,
        downloadUrl: uploadResponse['@microsoft.graph.downloadUrl'] || ''
      };
    } catch (error) {
      console.error('❌ Failed to upload file to OneDrive:', error);
      return null;
    }
  }

  async downloadFile(fileId: string): Promise<Blob | null> {
    try {
      await this.ensureInitialized();
      if (!this.client) return null;

      const response = await this.client
        .api(`/me/drive/items/${fileId}/content`)
        .get();

      return response;
    } catch (error) {
      console.error('❌ Failed to download file from OneDrive:', error);
      return null;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      if (!this.client) return false;

      await this.client.api(`/me/drive/items/${fileId}`).delete();
      console.log(`✅ Deleted file from OneDrive: ${fileId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete file from OneDrive:', error);
      return false;
    }
  }

  async syncProjectFolder(projectCode: string, projectName: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      if (!this.client) return false;

      // Create project folder structure in OneDrive
      const folderName = `${projectCode}_${projectName.replace(/\s+/g, '_')}`;
      const success = await this.createFolder(folderName);
      
      if (success) {
        console.log(`✅ Synced project folder to OneDrive: ${folderName}`);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to sync project folder:', error);
      return false;
    }
  }

  private async ensureG2ProjectsFolder(): Promise<void> {
    try {
      if (!this.client) return;

      // Check if G2_Progetti folder exists
      await this.client.api('/me/drive/root:/G2_Progetti').get();
    } catch (error) {
      // Folder doesn't exist, create it
      try {
        const folderData = {
          name: 'G2_Progetti',
          folder: {}
        };

        await this.client!.api('/me/drive/root/children').post(folderData);
        console.log('✅ Created G2_Progetti folder in OneDrive');
      } catch (createError) {
        console.error('❌ Failed to create G2_Progetti folder:', createError);
      }
    }
  }

  getStatus(): { connected: boolean; initialized: boolean } {
    return {
      connected: !!this.client,
      initialized: this.isInitialized
    };
  }
}

// Export singleton instance
export const oneDriveService = new OneDriveService();
export default oneDriveService;