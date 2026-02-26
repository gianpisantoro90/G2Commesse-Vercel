import { useQuery } from "@tanstack/react-query";
import { useOneDriveSync } from "@/hooks/use-onedrive-sync";
import oneDriveService from "@/lib/onedrive-service";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Database, 
  Folder, 
  FileText, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  RotateCw
} from "lucide-react";

export default function OneDriveSyncStatsCard() {
  const { 
    isConnected, 
    getOverallSyncStats,
    autoSyncEnabled 
  } = useOneDriveSync();

  // Get all OneDrive files for indexing stats
  const { data: allFiles = [] } = useQuery({
    queryKey: ['onedrive-all-files'],
    queryFn: () => oneDriveService.getAllFiles(),
    enabled: isConnected,
    refetchInterval: false, // No polling - minimize compute units
    staleTime: Infinity // Keep data indefinitely
  });

  // Get files index statistics
  const { data: indexStats } = useQuery({
    queryKey: ['files-index-stats'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/files-index/stats', { credentials: "include" });
        if (response.ok) {
          return await response.json();
        }
        return { totalFiles: 0, indexedFiles: 0, lastIndexed: null };
      } catch (error) {
        console.warn('Files index stats not available:', error);
        return { totalFiles: 0, indexedFiles: 0, lastIndexed: null };
      }
    },
    enabled: isConnected,
    refetchInterval: false // No polling - minimize compute units
  });

  const syncStats = getOverallSyncStats();
  
  // Calculate additional metrics
  const totalFiles = allFiles.length;
  const indexedFiles = indexStats?.indexedFiles || 0;
  const indexingProgress = totalFiles > 0 ? Math.round((indexedFiles / totalFiles) * 100) : 0;
  const syncProgress = syncStats.total > 0 ? Math.round((syncStats.synced / syncStats.total) * 100) : 0;
  
  // Calculate health score based on various factors
  const getHealthScore = () => {
    if (!isConnected) return 0;
    
    let score = 50; // Base score for being connected
    
    // Project sync score (30 points max)
    if (syncStats.total > 0) {
      score += Math.round((syncStats.synced / syncStats.total) * 30);
    }
    
    // Error penalty (-20 points max)
    if (syncStats.errors > 0) {
      const errorPenalty = Math.min(20, syncStats.errors * 5);
      score -= errorPenalty;
    }
    
    // Auto-sync bonus (10 points)
    if (autoSyncEnabled) {
      score += 10;
    }
    
    // File indexing bonus (10 points max)
    if (totalFiles > 0) {
      score += Math.round((indexedFiles / totalFiles) * 10);
    }
    
    return Math.max(0, Math.min(100, score));
  };

  const healthScore = getHealthScore();
  
  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { label: "Ottimo", color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" };
    if (score >= 60) return { label: "Buono", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300" };
    if (score >= 40) return { label: "Attenzione", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300" };
    return { label: "Critico", color: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" };
  };

  if (!isConnected) {
    return (
      <div className="card-g2" data-testid="onedrive-sync-stats-card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📊 Statistiche Sincronizzazione
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Database className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
          <p className="text-lg font-medium">OneDrive Disconnesso</p>
          <p className="text-sm">Connetti OneDrive per visualizzare le statistiche</p>
        </div>
      </div>
    );
  }

  const healthBadge = getHealthBadge(healthScore);

  return (
    <div className="card-g2" data-testid="onedrive-sync-stats-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          📊 Statistiche Sincronizzazione
        </h3>
        <Badge className={healthBadge.color}>
          {healthBadge.label}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Overall Health Score */}
        <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-lg">
          <div className={`text-3xl font-bold mb-1 ${getHealthColor(healthScore)}`} data-testid="health-score">
            {healthScore}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Salute Generale Sistema</div>
          <Progress value={healthScore} className="mt-2 h-2" />
        </div>

        {/* Project Sync Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Folder className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400" data-testid="projects-synced">
              {syncStats.synced}
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">di {syncStats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Progetti Sincronizzati</div>
          </div>

          <div className="text-center p-3 bg-green-50 dark:bg-green-950/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="files-indexed">
              {totalFiles.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">File Totali</div>
          </div>
        </div>

        {/* Sync Progress */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Progetti Sincronizzati</span>
              <span className="font-medium text-gray-900 dark:text-white">{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
          </div>

          {indexingProgress > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">File Indicizzati</span>
                <span className="font-medium text-gray-900 dark:text-white">{indexingProgress}%</span>
              </div>
              <Progress value={indexingProgress} className="h-2" />
            </div>
          )}
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="flex items-center justify-center mb-1">
              {syncStats.pending > 0 ? (
                <RotateCw className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {syncStats.pending} Pending
            </div>
          </div>

          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="flex items-center justify-center mb-1">
              {syncStats.errors > 0 ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {syncStats.errors} Errori
            </div>
          </div>

          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="flex items-center justify-center mb-1">
              {autoSyncEnabled ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Auto-Sync
            </div>
          </div>
        </div>

        {/* Last Activity */}
        {indexStats?.lastIndexed && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <Clock className="h-3 w-3 inline mr-1" />
            Ultimo aggiornamento: {new Date(indexStats.lastIndexed).toLocaleString('it-IT')}
          </div>
        )}

        {/* Warning Messages */}
        {syncStats.errors > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2 text-red-800 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {syncStats.errors} progett{syncStats.errors === 1 ? 'o' : 'i'} con errori di sincronizzazione
              </span>
            </div>
          </div>
        )}

        {!autoSyncEnabled && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-300">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Auto-sincronizzazione disattivata
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}