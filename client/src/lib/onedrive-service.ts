import { Client } from '@microsoft/microsoft-graph-client';
import { oneDriveRetry, fetchWithRetry } from './retry-utils';

export interface OneDriveFile {
  id: string;
  driveId?: string; // Drive ID for proper Graph API calls
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
      const response = await oneDriveRetry(() =>
        fetchWithRetry('/api/onedrive/test', undefined, { maxAttempts: 2 })
      );
      const data = await response.json();

      if (response.ok && data.connected) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('❌ OneDrive connection test failed:', error);
      return false;
    }
  }

  async getUserInfo(): Promise<{ name: string; email: string } | null> {
    try {
      const response = await fetch('/api/onedrive/user', { credentials: "include" });
      
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
      const response = await fetch(`/api/onedrive/files?path=${encodeURIComponent(folderPath)}`, { credentials: "include" });
      
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
    return true;
  }

  async uploadFile(
    file: File,
    projectCode: string,
    targetPath: string
  ): Promise<OneDriveUploadResult | null> {
    try {

      // Convert file to base64 for transmission
      const fileBuffer = await this.fileToBase64(file);

      const response = await oneDriveRetry(() =>
        fetchWithRetry('/api/onedrive/upload-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileBuffer: fileBuffer,
            targetPath: targetPath,
            projectCode: projectCode
          }),
        })
      );

      const data = await response.json();
      if (data.success) {
        return data.file;
      } else {
        console.error('❌ Upload failed - server response:', data);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to upload file to OneDrive:', error);
      return null;
    }
  }

  // Helper method to convert File to base64
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      // Cleanup function to prevent memory leaks
      const cleanup = () => {
        reader.onload = null;
        reader.onerror = null;
        reader.onabort = null;
      };

      reader.onload = () => {
        cleanup();
        if (reader.result) {
          const arrayBuffer = reader.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convert to base64 in chunks to avoid stack overflow
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }

          const base64String = btoa(binary);
          resolve(base64String);
        } else {
          reject(new Error('Failed to read file'));
        }
      };

      reader.onerror = () => {
        cleanup();
        reject(reader.error || new Error('FileReader error'));
      };

      reader.onabort = () => {
        cleanup();
        reject(new Error('FileReader aborted'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  async downloadFile(fileId: string): Promise<Blob | null> {
    try {
      const response = await fetch(`/api/onedrive/download/${fileId}`, { credentials: "include" });
      
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
    return false;
  }

  async syncProjectFolder(projectCode: string, projectDescription: string): Promise<boolean> {
    try {
      const response = await oneDriveRetry(() =>
        fetchWithRetry('/api/onedrive/sync-project', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectCode, projectDescription }),
        })
      );

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('❌ Failed to sync project folder:', error);
      return false;
    }
  }

  async mapProjectToFolder(projectCode: string): Promise<{found: boolean; mapped: boolean; folderPath?: string}> {
    try {
      const response = await fetch('/api/onedrive/map-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({ projectCode }),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.error('❌ Failed to map project:', response.statusText);
        return { found: false, mapped: false };
      }
    } catch (error) {
      console.error('❌ Failed to map project:', error);
      return { found: false, mapped: false };
    }
  }

  async getAllFiles(): Promise<OneDriveFile[]> {
    try {
      // Get all folders from root
      const rootResponse = await fetch('/api/onedrive/browse?path=/', { credentials: "include" });
      if (!rootResponse.ok) {
        console.error('❌ Failed to get root folders:', rootResponse.statusText);
        return [];
      }
      
      const rootItems = await rootResponse.json() as OneDriveFile[];
      const allFiles: OneDriveFile[] = [];
      
      // For each folder, get its contents recursively
      for (const item of rootItems) {
        if (item.folder) {
          const folderFiles = await this.getFilesFromFolder(`/${item.name}`, item.name, 1);
          allFiles.push(...folderFiles);
        } else {
          // If it's a file in root, add it
          allFiles.push({
            ...item,
            parentPath: '/'
          });
        }
      }
      
      return allFiles;
    } catch (error) {
      console.error('❌ Failed to get all OneDrive files:', error);
      return [];
    }
  }

  private async getFilesFromFolder(folderPath: string, displayPath: string, depth: number): Promise<OneDriveFile[]> {
    try {
      // Limit recursion depth to avoid infinite loops and API limits
      if (depth > 3) {
        return [];
      }
      
      const response = await fetch(`/api/onedrive/browse?path=${encodeURIComponent(folderPath)}`, { credentials: "include" });
      if (!response.ok) {
        console.error(`❌ Failed to browse folder ${displayPath}:`, response.statusText);
        return [];
      }
      
      const items = await response.json() as OneDriveFile[];
      const files: OneDriveFile[] = [];
      
      for (const item of items) {
        if (item.folder) {
          // Recursively get files from subfolders
          const subFiles = await this.getFilesFromFolder(`${folderPath}/${item.name}`, `${displayPath}/${item.name}`, depth + 1);
          files.push(...subFiles);
        } else {
          // Add file with updated parent path
          files.push({
            ...item,
            parentPath: displayPath
          });
        }
      }
      
      return files;
    } catch (error) {
      console.error(`❌ Failed to browse folder ${displayPath}:`, error);
      return [];
    }
  }

  async browseFolder(folderPath: string): Promise<OneDriveFile[]> {
    try {
      const response = await fetch(`/api/onedrive/browse?path=${encodeURIComponent(folderPath)}`, { credentials: "include" });
      
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.error('❌ Failed to browse OneDrive folder:', response.statusText);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to browse OneDrive folder:', error);
      return [];
    }
  }

  async scanFolderRecursive(folderPath: string, includeSubfolders: boolean = true): Promise<OneDriveFile[]> {
    try {
      const response = await fetch('/api/onedrive/scan-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({
          folderPath: folderPath,
          includeSubfolders: includeSubfolders
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data.files;
        } else {
          console.error('❌ Scan failed - server response:', data);
          return [];
        }
      } else {
        console.error('❌ Failed to scan OneDrive folder:', response.statusText);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to scan OneDrive folder:', error);
      return [];
    }
  }

  async bulkRenameFiles(operations: Array<{fileId: string, driveId: string, originalName: string, newName: string}>): Promise<{success: boolean, results: Array<{original: string, renamed: string, success: boolean}>}> {
    try {
      const response = await oneDriveRetry(() =>
        fetchWithRetry('/api/onedrive/bulk-rename', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operations }),
        })
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Failed to bulk rename files:', error);
      return {
        success: false,
        results: []
      };
    }
  }

  async moveFile(fileId: string, targetPath: string, newFileName?: string): Promise<{name: string, path: string} | null> {
    try {
      const response = await fetch('/api/onedrive/move-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({
          fileId: fileId,
          targetPath: targetPath,
          newFileName: newFileName
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data.file;
        } else {
          console.error('❌ Move failed - server response:', data);
          return null;
        }
      } else {
        console.error('❌ Failed to move file:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to move file:', error);
      return null;
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