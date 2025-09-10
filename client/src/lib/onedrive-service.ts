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
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/onedrive/test');
      const data = await response.json();
      
      if (response.ok && data.connected) {
        console.log('✅ OneDrive connection test successful');
        return true;
      } else {
        console.log('❌ OneDrive not connected');
        return false;
      }
    } catch (error) {
      console.error('❌ OneDrive connection test failed:', error);
      return false;
    }
  }

  async getUserInfo(): Promise<{ name: string; email: string } | null> {
    try {
      const response = await fetch('/api/onedrive/user');
      
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.error('❌ Failed to get user info:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to get user info:', error);
      return null;
    }
  }

  async listFiles(folderPath = '/G2_Progetti'): Promise<OneDriveFile[]> {
    try {
      const response = await fetch(`/api/onedrive/files?path=${encodeURIComponent(folderPath)}`);
      
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.error('❌ Failed to list OneDrive files:', response.statusText);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to list OneDrive files:', error);
      return [];
    }
  }

  async createFolder(folderName: string, parentPath = '/G2_Progetti'): Promise<boolean> {
    // This method is now handled server-side through sync-project endpoint
    console.log(`📝 Folder creation delegated to server: ${parentPath}/${folderName}`);
    return true;
  }

  async uploadFile(
    file: File, 
    projectCode: string, 
    targetFolder?: string
  ): Promise<OneDriveUploadResult | null> {
    // TODO: Implement file upload through server-side API
    console.log(`📝 File upload not yet implemented: ${file.name} to ${projectCode}/${targetFolder || ''}`);
    return null;
  }

  async downloadFile(fileId: string): Promise<Blob | null> {
    try {
      const response = await fetch(`/api/onedrive/download/${fileId}`);
      
      if (response.ok) {
        return await response.blob();
      } else {
        console.error('❌ Failed to download file from OneDrive:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to download file from OneDrive:', error);
      return null;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    // TODO: Implement file deletion through server-side API
    console.log(`📝 File deletion not yet implemented: ${fileId}`);
    return false;
  }

  async syncProjectFolder(projectCode: string, projectDescription: string): Promise<boolean> {
    try {
      const response = await fetch('/api/onedrive/sync-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectCode, projectDescription }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Synced project folder to OneDrive: ${projectCode}`);
        }
        return data.success;
      } else {
        console.error('❌ Failed to sync project folder:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to sync project folder:', error);
      return false;
    }
  }

  async getStatus(): Promise<{ connected: boolean; initialized: boolean }> {
    const connected = await this.testConnection();
    return {
      connected,
      initialized: connected
    };
  }
}

// Export singleton instance
export const oneDriveService = new OneDriveService();
export default oneDriveService;