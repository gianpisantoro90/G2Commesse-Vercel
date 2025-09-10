import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Search, 
  Folder, 
  File, 
  FileText, 
  Image, 
  FileSpreadsheet, 
  FileArchive,
  ChevronRight,
  ChevronDown,
  Link,
  Eye,
  Download,
  Calendar,
  HardDrive,
  ExternalLink,
  RefreshCw,
  Home,
  FolderOpen
} from "lucide-react";
import oneDriveService, { OneDriveFile } from "@/lib/onedrive-service";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import { type Project } from '@shared/schema';

interface TreeNode {
  file: OneDriveFile;
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

export default function OneDriveBrowser() {
  const [currentPath, setCurrentPath] = useState("/");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [linkingFile, setLinkingFile] = useState<OneDriveFile | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/"]));

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected } = useOneDriveSync();

  // Get projects for linking
  const { data: projects } = useQuery({
    queryKey: ['projects']
  }) as { data: Project[] | undefined };

  // Get current folder files
  const { data: currentFiles, isLoading: isLoadingFiles, refetch: refetchFiles, error: browseError } = useQuery({
    queryKey: ['onedrive-browse', currentPath],
    queryFn: async () => {
      const response = await fetch(`/api/onedrive/browse?path=${encodeURIComponent(currentPath)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Errore ${response.status}: ${response.statusText}`);
      }
      return response.json() as Promise<OneDriveFile[]>;
    },
    enabled: isConnected,
    retry: (failureCount, error) => {
      // Retry up to 2 times for network errors, but not for 404/403
      if (failureCount >= 2) return false;
      const isNetworkError = !error.message.includes('4') && !error.message.includes('401') && !error.message.includes('403');
      return isNetworkError;
    }
  });

  // Search files
  const { data: searchResults, isLoading: isSearching, error: searchError } = useQuery({
    queryKey: ['onedrive-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/onedrive/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Errore ricerca ${response.status}`);
      }
      return response.json() as Promise<OneDriveFile[]>;
    },
    enabled: isConnected && searchQuery.length > 2,
    retry: false // Don't retry search queries
  });

  // Get folder hierarchy for tree view
  const { data: folderHierarchy, error: hierarchyError } = useQuery({
    queryKey: ['onedrive-hierarchy'],
    queryFn: async () => {
      const response = await fetch('/api/onedrive/hierarchy');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nel recupero cartelle');
      }
      return response.json() as Promise<OneDriveFile[]>;
    },
    enabled: isConnected,
    retry: 1
  });

  // Handle browse errors
  useEffect(() => {
    if (browseError) {
      console.error('OneDrive browse error:', browseError);
      toast({
        title: "Errore navigazione OneDrive",
        description: `Impossibile accedere alla cartella: ${browseError.message}`,
        variant: "destructive",
      });
    }
  }, [browseError, toast]);

  // Handle search errors
  useEffect(() => {
    if (searchError) {
      console.error('OneDrive search error:', searchError);
      toast({
        title: "Errore ricerca OneDrive",
        description: `Impossibile eseguire la ricerca: ${searchError.message}`,
        variant: "destructive",
      });
    }
  }, [searchError, toast]);

  // Handle hierarchy errors
  useEffect(() => {
    if (hierarchyError) {
      console.error('OneDrive hierarchy error:', hierarchyError);
      toast({
        title: "Errore struttura cartelle",
        description: `Impossibile caricare l'elenco delle cartelle: ${hierarchyError.message}`,
        variant: "destructive",
      });
    }
  }, [hierarchyError, toast]);

  // Initialize tree data
  useEffect(() => {
    if (folderHierarchy) {
      const rootNodes: TreeNode[] = folderHierarchy.map(folder => ({
        file: folder,
        children: [],
        expanded: expandedPaths.has(folder.parentPath + "/" + folder.name)
      }));
      setTreeData(rootNodes);
    }
  }, [folderHierarchy]);

  // Link project mutation
  const linkProjectMutation = useMutation({
    mutationFn: async ({ projectCode, folderId, folderName, folderPath }: { 
      projectCode: string; 
      folderId: string;
      folderName: string;
      folderPath: string;
    }) => {
      const response = await fetch('/api/onedrive/link-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectCode, 
          oneDriveFolderId: folderId,
          oneDriveFolderName: folderName,
          oneDriveFolderPath: folderPath
        })
      });
      
      if (!response.ok) throw new Error('Failed to link project');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Progetto collegato",
        description: "La cartella OneDrive è stata collegata al progetto",
      });
      setLinkingFile(null);
      setSelectedProject("");
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['onedrive-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: any) => {
      console.error('Project linking error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Errore sconosciuto';
      toast({
        title: "Errore collegamento",
        description: `Impossibile collegare il progetto: ${errorMessage}`,
        variant: "destructive",
      });
    }
  });

  // File icon helper
  const getFileIcon = (file: OneDriveFile) => {
    if (file.folder) return <Folder className="w-4 h-4 text-blue-500" />;
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'txt':
      case 'md':
      case 'doc':
      case 'docx':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return <Image className="w-4 h-4 text-green-600" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-green-700" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FileArchive className="w-4 h-4 text-orange-600" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Navigate to folder
  const navigateToFolder = (folderPath: string) => {
    setCurrentPath(folderPath);
    setSearchQuery("");
  };

  // Handle file click
  const handleFileClick = async (file: OneDriveFile) => {
    if (file.folder) {
      const newPath = file.parentPath === '/' ? `/${file.name}` : `${file.parentPath}/${file.name}`;
      navigateToFolder(newPath);
    } else {
      setSelectedFile(file);
      
      // Try to get file content for preview
      try {
        const response = await fetch(`/api/onedrive/content/${file.id}`);
        if (response.ok) {
          const data = await response.json();
          setPreviewContent(data.content);
        } else {
          setPreviewContent(null);
        }
      } catch (error) {
        setPreviewContent(null);
      }
    }
  };

  // Handle tree node expand/collapse
  const toggleTreeNode = async (node: TreeNode, path: string) => {
    const newExpandedPaths = new Set(expandedPaths);
    
    if (node.expanded) {
      newExpandedPaths.delete(path);
    } else {
      newExpandedPaths.add(path);
      
      // Load children if not loaded yet
      if (!node.children || node.children.length === 0) {
        try {
          const childPath = path === '/' ? `/${node.file.name}` : `${path}/${node.file.name}`;
          const response = await fetch(`/api/onedrive/browse?path=${encodeURIComponent(childPath)}`);
          if (response.ok) {
            const children = await response.json() as OneDriveFile[];
            const childNodes: TreeNode[] = children
              .filter(child => child.folder)
              .map(child => ({
                file: child,
                children: [],
                expanded: false
              }));
            
            // Update tree data
            const updateTree = (nodes: TreeNode[]): TreeNode[] => {
              return nodes.map(n => {
                if (n.file.id === node.file.id) {
                  return { ...n, children: childNodes, expanded: true };
                }
                if (n.children) {
                  return { ...n, children: updateTree(n.children) };
                }
                return n;
              });
            };
            
            setTreeData(updateTree(treeData));
          }
        } catch (error) {
          console.error('Failed to load tree children:', error);
        }
      }
    }
    
    setExpandedPaths(newExpandedPaths);
  };

  // Generate breadcrumb items
  const getBreadcrumbItems = () => {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }];
    
    const parts = currentPath.split('/').filter(Boolean);
    const items = [{ name: 'Root', path: '/' }];
    
    let currentBreadcrumbPath = '';
    parts.forEach(part => {
      currentBreadcrumbPath += `/${part}`;
      items.push({ name: part, path: currentBreadcrumbPath });
    });
    
    return items;
  };

  // Handle project linking
  const handleLinkProject = () => {
    if (!selectedProject || !linkingFile) return;
    
    const folderPath = linkingFile.parentPath === '/' 
      ? `/${linkingFile.name}` 
      : `${linkingFile.parentPath}/${linkingFile.name}`;
    
    linkProjectMutation.mutate({
      projectCode: selectedProject,
      folderId: linkingFile.id,
      folderName: linkingFile.name,
      folderPath: folderPath
    });
  };

  // Render tree node
  const renderTreeNode = (node: TreeNode, path: string, depth: number = 0) => {
    const nodePath = path === '/' ? `/${node.file.name}` : `${path}/${node.file.name}`;
    const isExpanded = expandedPaths.has(nodePath);
    
    return (
      <div key={node.file.id} style={{ marginLeft: `${depth * 16}px` }}>
        <div 
          className="flex items-center gap-2 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
          onClick={() => navigateToFolder(nodePath)}
          data-testid={`tree-node-${node.file.id}`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTreeNode(node, path);
            }}
            className="p-1"
            data-testid={`button-tree-toggle-${node.file.id}`}
          >
            {node.children && node.children.length > 0 ? (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : (
              <div className="w-3 h-3" />
            )}
          </button>
          <Folder className="w-4 h-4 text-blue-500" />
          <span className="text-sm truncate" data-testid={`text-tree-folder-${node.file.id}`}>
            {node.file.name}
          </span>
        </div>
        
        {isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, nodePath, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl" data-testid="onedrive-browser-disconnected">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">OneDrive Non Connesso</h3>
          <p className="text-yellow-700">
            Per utilizzare il browser OneDrive, è necessario configurare prima l'integrazione OneDrive nelle impostazioni.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6" data-testid="onedrive-browser">
      {/* Header with search */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">☁️ Browser OneDrive</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              refetchFiles();
              queryClient.invalidateQueries({ queryKey: ['onedrive-hierarchy'] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Aggiorna
          </Button>
        </div>
        
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Cerca file e cartelle in OneDrive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>

        {/* Breadcrumb navigation */}
        {!searchQuery && (
          <Breadcrumb>
            <BreadcrumbList>
              {getBreadcrumbItems().map((item, index, array) => (
                <div key={item.path} className="flex items-center">
                  <BreadcrumbItem>
                    {index === array.length - 1 ? (
                      <BreadcrumbPage data-testid={`text-breadcrumb-current-${item.name}`}>
                        {item.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink 
                        onClick={() => navigateToFolder(item.path)}
                        className="cursor-pointer"
                        data-testid={`link-breadcrumb-${item.name}`}
                      >
                        {item.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < array.length - 1 && <BreadcrumbSeparator />}
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tree navigation sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Cartelle
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-96 overflow-y-auto" data-testid="tree-navigation">
                {treeData.map(node => renderTreeNode(node, '/'))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content area */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {searchQuery ? (
                  <>
                    <Search className="w-4 h-4" />
                    Risultati ricerca: "{searchQuery}"
                  </>
                ) : (
                  <>
                    <Folder className="w-4 h-4" />
                    {currentPath === '/' ? 'Root' : currentPath.split('/').pop()}
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingFiles || isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                  <span className="text-gray-500">Caricamento...</span>
                </div>
              ) : (
                <div className="space-y-2" data-testid="file-list">
                  {(searchQuery ? searchResults : currentFiles)?.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleFileClick(file)}
                      data-testid={`file-item-${file.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {getFileIcon(file)}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{file.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(file.size)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(file.lastModified)}
                            </span>
                            {searchQuery && file.parentPath && (
                              <span className="text-blue-500">
                                📁 {file.parentPath}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!file.folder && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFile(file);
                                }}
                                data-testid={`button-preview-${file.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh]" data-testid={`dialog-preview-${file.id}`}>
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  {getFileIcon(file)}
                                  {file.name}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="mt-4">
                                {previewContent ? (
                                  <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap" data-testid={`text-preview-content-${file.id}`}>
                                    {previewContent}
                                  </pre>
                                ) : (
                                  <div className="text-center py-8 text-gray-500" data-testid={`text-preview-unavailable-${file.id}`}>
                                    <File className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p>Anteprima non disponibile per questo tipo di file</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        {file.folder && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkingFile(file);
                                }}
                                data-testid={`button-link-${file.id}`}
                              >
                                <Link className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent data-testid={`dialog-link-project-${file.id}`}>
                              <DialogHeader>
                                <DialogTitle>Collega cartella a progetto</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <div>
                                  <label className="text-sm font-medium">Cartella OneDrive:</label>
                                  <div className="mt-1 p-2 bg-gray-50 rounded flex items-center gap-2" data-testid={`text-selected-folder-${linkingFile?.id}`}>
                                    <Folder className="w-4 h-4 text-blue-500" />
                                    {linkingFile?.name}
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="text-sm font-medium">Seleziona progetto:</label>
                                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                                    <SelectTrigger data-testid={`select-project-${linkingFile?.id}`}>
                                      <SelectValue placeholder="Scegli un progetto..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {projects?.map((project: Project) => (
                                        <SelectItem key={project.id} value={project.code} data-testid={`option-project-${project.code}`}>
                                          {project.code} - {project.object}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <Button
                                  onClick={handleLinkProject}
                                  disabled={!selectedProject || linkProjectMutation.isPending}
                                  className="w-full"
                                  data-testid={`button-confirm-link-${linkingFile?.id}`}
                                >
                                  {linkProjectMutation.isPending ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                      Collegamento...
                                    </>
                                  ) : (
                                    <>
                                      <Link className="w-4 h-4 mr-2" />
                                      Collega progetto
                                    </>
                                  )}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(file.webUrl, '_blank');
                          }}
                          data-testid={`button-external-${file.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {(searchQuery ? searchResults : currentFiles)?.length === 0 && (
                    <div className="text-center py-8 text-gray-500" data-testid={searchQuery ? "text-empty-search" : "text-empty-folder"}>
                      <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>
                        {searchQuery 
                          ? `Nessun risultato trovato per "${searchQuery}"`
                          : "Questa cartella è vuota"
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}