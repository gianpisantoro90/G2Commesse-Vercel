// AI-powered file routing system for G2 Commesse
// All AI calls are routed through the server-side unified AI provider.

import { localStorageHelpers } from "./storage";
import { PROJECT_TEMPLATES } from "./file-system";

export interface FileAnalysis {
  fileName: string;
  fileType: string;
  fileSize: number;
  extension: string;
  preview?: string;
}

export interface RoutingResult {
  suggestedPath: string;
  confidence: number;
  reasoning: string;
  method: 'ai' | 'rules' | 'learned';
  alternatives?: string[];
}

export interface LearnedPattern {
  pattern: string;
  path: string;
  confidence: number;
  lastUsed: Date;
}

class AIFileRouter {
  private learnedPatterns: Record<string, string> = {};
  private isInitialized = false;

  constructor() {
    // Remove legacy localStorage API key (migrated to server-side storage)
    try { localStorage.removeItem('ai_config'); } catch { /* noop */ }
    this.learnedPatterns = localStorageHelpers.loadLearnedPatterns();
    this.isInitialized = true;
  }

  // Test AI API connection via backend
  async testConnection(apiKey?: string, model?: string): Promise<boolean> {
    try {
      const response = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({
          apiKey: apiKey || 'server-managed',
          model,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Main routing function
  async routeFile(
    file: File,
    projectTemplate: string = 'LUNGO',
    projectId?: string
  ): Promise<RoutingResult> {
    const analysis = await this.analyzeFile(file);

    // Try learned patterns first (highest priority)
    const learnedResult = this.checkLearnedPatterns(analysis);
    if (learnedResult.confidence > 0.9) {
      return { ...learnedResult, method: 'learned' };
    }

    // Route via server-side AI
    try {
      const prompt = this.buildAIPrompt(analysis, projectTemplate);
      const response = await fetch('/api/ai/file-routing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const result = this.parseAIResponse(data.content, projectTemplate);
      return { ...result, method: 'ai' };
    } catch (error) {
      console.error('AI routing failed:', error);
      throw new Error(`AI routing non disponibile: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  }

  // Analyze file properties
  private async analyzeFile(file: File): Promise<FileAnalysis> {
    const analysis: FileAnalysis = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extension: this.getFileExtension(file.name),
    };

    if ((file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.pdf')) && file.size < 10000) {
      try {
        analysis.preview = await this.getTextPreview(file);
      } catch { /* noop */ }
    }

    return analysis;
  }

  // Check learned patterns
  private checkLearnedPatterns(analysis: FileAnalysis): RoutingResult {
    const pattern = this.extractPattern(analysis);
    const learnedPath = this.learnedPatterns[pattern];

    if (learnedPath) {
      return {
        suggestedPath: learnedPath,
        confidence: 0.95,
        reasoning: 'Pattern appreso dalle correzioni precedenti',
        method: 'learned',
      };
    }

    return {
      suggestedPath: '',
      confidence: 0,
      reasoning: 'Nessun pattern appreso trovato',
      method: 'learned',
    };
  }

  // Learn from user corrections
  learnFromCorrection(file: File, actualPath: string): void {
    const analysis = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extension: this.getFileExtension(file.name),
    };

    const pattern = this.extractPattern(analysis);
    this.learnedPatterns[pattern] = actualPath;
    localStorageHelpers.saveLearnedPatterns(this.learnedPatterns);
  }

  // Extract pattern from file analysis
  private extractPattern(analysis: FileAnalysis): string {
    const ext = analysis.extension.toLowerCase();
    const keywords = analysis.fileName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(' ')
      .filter(w => w.length > 3)
      .slice(0, 3);

    return `${ext}:${keywords.join(',')}`;
  }

  // Build AI prompt
  private buildAIPrompt(analysis: FileAnalysis, template: string): string {
    const templateStructure = template === 'LUNGO' ? this.getLungoStructure() : this.getBreveStructure();
    const availableFolders = this.getAvailableFolders(template);

    return `You are an expert Italian structural engineer specializing in G2 Ingegneria project management and document classification.

ANALYZE THIS FILE:
- Filename: ${analysis.fileName}
- Extension: ${analysis.extension}
- MIME Type: ${analysis.fileType}
- Size: ${analysis.fileSize} bytes
${analysis.preview ? `- Content preview (first 200 chars): ${analysis.preview.substring(0, 200)}...` : ''}

PROJECT TEMPLATE: ${template}
${templateStructure}

AVAILABLE FOLDERS FOR ${template} TEMPLATE (CHOOSE ONLY FROM THIS EXACT LIST):
${availableFolders.map(folder => `• ${folder}`).join('\n')}

CLASSIFICATION INSTRUCTIONS:
1. Analyze filename, extension, and content semantically
2. Identify the engineering document type
3. Select EXACTLY ONE folder path from the available list above
4. Provide detailed technical reasoning
5. Suggest 2-3 alternative folder paths from the available list

STRICT JSON RESPONSE FORMAT - NO OTHER TEXT:
{
  "suggestedPath": "EXACT_FOLDER_FROM_LIST/",
  "confidence": 0.95,
  "reasoning": "Detailed analysis",
  "alternatives": ["ALTERNATIVE1/", "ALTERNATIVE2/"]
}

CRITICAL: Only use folders from the exact available list above. Confidence must be 0.0-1.0 decimal.`;
  }

  // Get available folders for template
  private getAvailableFolders(template: string): string[] {
    const folders: string[] = [];
    const structure = template === 'LUNGO' ? PROJECT_TEMPLATES.LUNGO.structure : PROJECT_TEMPLATES.BREVE.structure;

    const extractFolders = (obj: any, path: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}/${key}` : key;
        folders.push(currentPath);
        if (value && typeof value === 'object' && Object.keys(value).length > 0) {
          extractFolders(value, currentPath);
        }
      }
    };

    extractFolders(structure);
    return folders;
  }

  private getLungoStructure(): string {
    return `
1_CONSEGNA/ - Documenti cliente e brief progetto
2_PERMIT/ - Permessi e autorizzazioni
3_PROGETTO/ - Elaborati tecnici principali
  ├── ARC/ - Architettonici
  ├── CME/ - Cronoprogramma e materiali edili
  ├── CRONO_CAPITOLATI_MANUT/ - Cronoprogramma e capitolati
  ├── IE/ - Impianti elettrici
  ├── IM/ - Impianti meccanici
  ├── IS/ - Impianti speciali
  ├── REL/ - Relazioni tecniche
  ├── SIC/ - Sicurezza cantiere
  ├── STR/ - Strutturali
  └── X_RIF/ - Riferimenti e standard
4_MATERIALE_RICEVUTO/ - Documenti ricevuti da terzi
5_CANTIERE/ - Documentazione cantiere
6_VERBALI_NOTIFICHE_COMUNICAZIONI/ - Comunicazioni ufficiali
7_SOPRALLUOGHI/ - Report sopralluoghi
8_VARIANTI/ - Varianti progettuali
9_PARCELLA/ - Fatturazione e parcelle
10_INCARICO/ - Documenti incarico`;
  }

  private getBreveStructure(): string {
    return `
CONSEGNA/ - Documenti cliente e brief
ELABORAZIONI/ - Elaborati tecnici
MATERIALE_RICEVUTO/ - Documenti terzi
SOPRALLUOGHI/ - Report sopralluoghi`;
  }

  // Parse AI response and validate against template structure
  private parseAIResponse(response: string, template: string): RoutingResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const availableFolders = this.getAvailableFolders(template);

      const suggestedPath = parsed.suggestedPath || '';
      const cleanPath = suggestedPath.replace(/\/$/, '');
      const isValidPath = availableFolders.includes(cleanPath);

      if (!isValidPath && suggestedPath) {
        const closestMatch = this.findClosestPath(suggestedPath, availableFolders);
        return {
          suggestedPath: closestMatch,
          confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1) * 0.8,
          reasoning: `${parsed.reasoning || 'Analisi AI'} (Percorso corretto automaticamente)`,
          method: 'ai',
          alternatives: (parsed.alternatives || []).filter((alt: string) => availableFolders.includes(alt.replace(/\/$/, ''))),
        };
      }

      return {
        suggestedPath,
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
        reasoning: parsed.reasoning || 'Analisi AI',
        method: 'ai',
        alternatives: (parsed.alternatives || []).filter((alt: string) => availableFolders.includes(alt.replace(/\/$/, ''))),
      };
    } catch {
      const defaultPath = template === 'LUNGO' ? '1_CONSEGNA/' : 'CONSEGNA/';
      return {
        suggestedPath: defaultPath,
        confidence: 0.5,
        reasoning: 'Errore nell\'analisi AI - usando fallback',
        method: 'ai',
      };
    }
  }

  // Find closest matching path
  private findClosestPath(suggestedPath: string, availableFolders: string[]): string {
    const suggested = suggestedPath.toLowerCase().replace(/\/$/, '');

    for (const folder of availableFolders) {
      if (folder.toLowerCase() === suggested) {
        return folder + '/';
      }
    }

    const keyTerms = suggested.split(/[_\/]/).filter(term => term.length > 2);
    let bestMatch = availableFolders[0];
    let maxMatches = 0;

    for (const folder of availableFolders) {
      const folderLower = folder.toLowerCase();
      let matches = 0;
      for (const term of keyTerms) {
        if (folderLower.includes(term)) matches++;
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = folder;
      }
    }

    return bestMatch + '/';
  }

  private getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || '';
  }

  private async getTextPreview(file: File, maxChars: number = 500): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text.substring(0, maxChars));
      };
      reader.onerror = reject;
      reader.readAsText(file.slice(0, maxChars));
    });
  }

  // Get routing statistics
  getRoutingStats(): { learnedPatternsCount: number; totalRoutings: number } {
    return {
      learnedPatternsCount: Object.keys(this.learnedPatterns).length,
      totalRoutings: 0,
    };
  }

  // Clear learned patterns
  clearLearnedPatterns(): void {
    this.learnedPatterns = {};
    localStorageHelpers.saveLearnedPatterns({});
  }
}

// Export singleton instance
export const aiRouter = new AIFileRouter();

// Export helper function for testing AI connection
export const testClaudeConnection = async (apiKey: string, model?: string): Promise<boolean> => {
  return aiRouter.testConnection(apiKey, model);
};
