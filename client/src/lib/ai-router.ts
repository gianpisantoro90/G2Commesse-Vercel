// AI-powered file routing system for G2 Commesse

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
  private apiKey: string | null = null;
  private learnedPatterns: Record<string, string> = {};
  private isInitialized = false;

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    // Load AI configuration from encrypted localStorage
    try {
      const storedConfig = localStorage.getItem('ai_config');
      
      if (storedConfig) {
        let config;
        
        // Check if it's base64 encoded or plain JSON
        if (storedConfig.startsWith('{')) {
          // It's already JSON, parse directly
          config = JSON.parse(storedConfig);
        } else {
          try {
            // It's base64 encoded, decode first
            const decoded = atob(storedConfig);
            config = JSON.parse(decoded);
          } catch (error) {
            console.warn('Config decoding failed, trying as JSON:', error);
            // Fallback: try parsing as JSON directly
            config = JSON.parse(storedConfig);
          }
        }
        
        // The API key might be base64 encoded within the config
        if (config.apiKey) {
          try {
            // Check if API key itself is base64 encoded
            if (config.apiKey.startsWith('c2stYW50LWFwaTA')) {
              // It's base64 encoded, decode it
              this.apiKey = atob(config.apiKey);
            } else {
              // It's already plain text
              this.apiKey = config.apiKey;
            }
          } catch (error) {
            console.warn('API Key decoding failed in ai-router, using as-is:', error);
            this.apiKey = config.apiKey;
          }
        } else {
          this.apiKey = null;
        }
        
        if (!this.apiKey) {
          this.apiKey = null;
        }
      } else {
        this.apiKey = null;
      }
    } catch (error) {
      console.error('Error loading AI config:', error);
      this.apiKey = null;
    }
    
    // Load learned patterns
    this.learnedPatterns = localStorageHelpers.loadLearnedPatterns();
    this.isInitialized = true;
  }

  // Test AI API connection via backend proxy
  async testConnection(apiKey?: string, model?: string): Promise<boolean> {
    const keyToTest = apiKey || this.apiKey;
    if (!keyToTest) {
      console.error('AI API test failed: No API key provided');
      return false;
    }

    console.log('Testing AI API connection via backend...');
    
    // Get current model from localStorage if not provided
    let modelToTest = model;
    if (!modelToTest) {
      try {
        const storedConfig = localStorage.getItem('ai_config');
        if (storedConfig) {
          const config = JSON.parse(storedConfig);
          modelToTest = config.model || 'claude-sonnet-4-20250514';
        }
      } catch (error) {
        console.warn('Could not load model from config:', error);
        modelToTest = 'claude-sonnet-4-20250514';
      }
    }
    
    try {
      const response = await fetch('/api/test-claude', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: keyToTest,
          model: modelToTest,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Claude API test failed:', {
          status: response.status,
          message: data.message,
          details: data.details
        });
        return false;
      }
      
      console.log('AI API test successful:', data.message);
      return true;
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'UnknownError',
      };
      console.error('AI API test failed with exception:', errorDetails);
      return false;
    }
  }

  // Main routing function
  async routeFile(
    file: File,
    projectTemplate: string = 'LUNGO',
    projectId?: string
  ): Promise<RoutingResult> {
    if (!this.isInitialized) {
      this.loadConfiguration();
    }

    console.log('🤖 AI-ONLY ROUTING: Starting file analysis...');
    const analysis = await this.analyzeFile(file);
    
    // Try learned patterns first (highest priority)
    const learnedResult = this.checkLearnedPatterns(analysis);
    if (learnedResult.confidence > 0.9) {
      console.log('✅ Using learned pattern with high confidence');
      return { ...learnedResult, method: 'learned' };
    }

    // Force AI routing - use environment API key if available
    const environmentApiKey = await this.getEnvironmentApiKey();
    const activeApiKey = environmentApiKey || this.apiKey;
    
    if (activeApiKey) {
      try {
        console.log('🧠 Using AI routing with environment API key');
        const aiResult = await this.aiRouting(analysis, projectTemplate, activeApiKey);
        console.log('✅ AI routing successful:', aiResult);
        return { ...aiResult, method: 'ai' };
      } catch (error) {
        console.error('❌ AI routing failed:', error);
        throw new Error(`AI routing non disponibile: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      }
    }

    // No fallback - require AI
    throw new Error('Configurazione AI richiesta: nessuna API key disponibile per il routing intelligente');
  }

  // Analyze file properties
  private async analyzeFile(file: File): Promise<FileAnalysis> {
    const analysis: FileAnalysis = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extension: this.getFileExtension(file.name),
    };

    // Add text preview for small text files
    if (file.type.startsWith('text/') || 
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf')) {
      if (file.size < 10000) { // 10KB limit for preview
        try {
          analysis.preview = await this.getTextPreview(file);
        } catch (error) {
          console.warn('Could not extract text preview:', error);
        }
      }
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

  // Get API key from environment variables via backend
  private async getEnvironmentApiKey(): Promise<string | null> {
    try {
      const response = await fetch('/api/get-env-api-key');
      if (response.ok) {
        const data = await response.json();
        return data.apiKey || null;
      }
    } catch (error) {
      console.log('No environment API key available');
    }
    return null;
  }

  // AI-powered routing using multiple providers via backend proxy
  private async aiRouting(
    analysis: FileAnalysis,
    template: string,
    apiKeyOverride?: string
  ): Promise<RoutingResult> {
    const activeApiKey = apiKeyOverride || this.apiKey;
    if (!activeApiKey) {
      throw new Error('API Key non configurata');
    }

    // Get current model from localStorage
    let currentModel = 'claude-sonnet-4-20250514';
    try {
      const storedConfig = localStorage.getItem('ai_config');
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        currentModel = config.model || currentModel;
      }
    } catch (error) {
      console.warn('Could not load model from config:', error);
    }

    const prompt = this.buildAIPrompt(analysis, template);
    
    console.log('🌐 Making AI routing request...');
    try {
      const response = await fetch('/api/ai-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: activeApiKey,
          prompt: prompt,
          model: currentModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ AI routing API error:', errorData);
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const result = this.parseAIResponse(data.content);
      
      return {
        suggestedPath: result.suggestedPath,
        confidence: result.confidence,
        reasoning: result.reasoning,
        method: 'ai',
        alternatives: result.alternatives,
      };
    } catch (error) {
      console.error('❌ AI routing error:', error);
      throw error;
    }
  }

  // Rules-based routing
  private rulesBasedRouting(
    analysis: FileAnalysis,
    template: string
  ): RoutingResult {
    const fileName = analysis.fileName.toLowerCase();
    const extension = analysis.extension.toLowerCase();
    
    const rules = template === 'LUNGO' ? this.getLungoRules() : this.getBreveRules();
    
    // Check extension-based rules
    for (const [extPattern, config] of Object.entries(rules)) {
      const extRegex = new RegExp(extPattern);
      if (extRegex.test(extension)) {
        // Check for keyword matches
        for (const pattern of config.patterns) {
          const hasKeyword = pattern.keywords.some(keyword => 
            fileName.includes(keyword.toLowerCase())
          );
          
          if (hasKeyword) {
            return {
              suggestedPath: pattern.folder,
              confidence: 0.8,
              reasoning: `File ${extension} con keyword "${pattern.keywords.find(k => fileName.includes(k.toLowerCase()))}"`,
              method: 'rules',
              alternatives: [config.default],
            };
          }
        }
        
        // Use default for extension
        return {
          suggestedPath: config.default,
          confidence: 0.6,
          reasoning: `Cartella di default per file ${extension}`,
          method: 'rules',
          alternatives: [],
        };
      }
    }

    // Final fallback
    const fallbackPath = template === 'LUNGO' 
      ? '04_ELABORATI_GRAFICI/' 
      : 'MATERIALE_RICEVUTO/';
    
    return {
      suggestedPath: fallbackPath,
      confidence: 0.4,
      reasoning: 'Fallback - tipologia file non riconosciuta',
      method: 'rules',
      alternatives: [],
    };
  }

  // Learn from user corrections
  learnFromCorrection(
    file: File,
    actualPath: string,
    confidence: number = 1.0
  ): void {
    const analysis = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      extension: this.getFileExtension(file.name),
    };
    
    const pattern = this.extractPattern(analysis);
    this.learnedPatterns[pattern] = actualPath;
    
    // Save to localStorage
    localStorageHelpers.saveLearnedPatterns(this.learnedPatterns);
    
    console.log(`Learned: ${pattern} -> ${actualPath}`);
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

  // Build AI prompt with detailed template structure optimized for Claude 4.0 Sonnet
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

G2 INGEGNERIA PROJECT TEMPLATE ${template}:
${templateStructure}

AVAILABLE FOLDERS (CHOOSE ONLY FROM THIS EXACT LIST):
${availableFolders.map(folder => `• ${folder}`).join('\n')}

CLASSIFICATION INSTRUCTIONS:
1. Analyze filename, extension, and content semantically
2. Identify the engineering document type (drawings, reports, calculations, communications, permits, etc.)
3. Select EXACTLY ONE folder path from the available list above
4. Provide detailed technical reasoning based on Italian engineering best practices
5. Suggest 2-3 alternative folder paths from the available list

STRICT JSON RESPONSE FORMAT - NO OTHER TEXT:
{
  "suggestedPath": "EXACT_FOLDER_FROM_LIST/",
  "confidence": 0.95,
  "reasoning": "Detailed analysis: document type, content evaluation, logical placement in engineering workflow",
  "alternatives": ["ALTERNATIVE1/", "ALTERNATIVE2/"]
}

CRITICAL: Only use folders from the exact available list above. Never create new folder names. Confidence must be 0.0-1.0 decimal.`;
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

  // Get template structure as text
  private getLungoStructure(): string {
    return `
1_CONSEGNA/ - Documenti cliente e brief progetto
2_PERMIT/ - Permessi e autorizzazioni
3_PROGETTO/ - Elaborati tecnici principali
  ├── ARC/ - Architettonici (piante, prospetti, sezioni)
  ├── CME/ - Cronoprogramma e materiali edili
  ├── CRONO_CAPITOLATI_MANUT/ - Cronoprogramma e capitolati
  ├── IE/ - Impianti elettrici
  ├── IM/ - Impianti meccanici
  ├── IS/ - Impianti speciali
  ├── REL/ - Relazioni tecniche
  ├── SIC/ - Sicurezza cantiere
  ├── STR/ - Strutturali (calcoli, carpenteria)
  └── X_RIF/ - Riferimenti e standard
4_MATERIALE_RICEVUTO/ - Documenti ricevuti da terzi
5_CANTIERE/ - Documentazione cantiere
  ├── 0_PSC_FE/ - Piano sicurezza cantiere
  └── IMPRESA/ - Documentazione impresa
      ├── CONTRATTO/ - Contratti
      ├── CONTROLLI/ - Controlli qualità
      └── DOCUMENTI/ - Altri documenti impresa
6_VERBALI_NOTIFICHE_COMUNICAZIONI/ - Comunicazioni ufficiali
  ├── COMUNICAZIONI/ - Comunicazioni generali
  ├── NP/ - Note e promemoria
  ├── ODS/ - Ordini di servizio
  └── VERBALI/ - Verbali riunioni
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

  // Parse AI response
  private parseAIResponse(response: string): {
    suggestedPath: string;
    confidence: number;
    reasoning: string;
    alternatives?: string[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        suggestedPath: parsed.suggestedPath || '',
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
        reasoning: parsed.reasoning || 'Analisi AI',
        alternatives: parsed.alternatives || [],
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        suggestedPath: '04_ELABORATI_GRAFICI/',
        confidence: 0.5,
        reasoning: 'Errore nell\'analisi AI - usando fallback',
      };
    }
  }

  // Get routing rules for LUNGO template
  private getLungoRules() {
    return {
      'dwg|dxf|skp': {
        patterns: [
          { keywords: ['pianta', 'planimetria', 'plan'], folder: '02_PROGETTAZIONE/ARC/01_PIANTE/' },
          { keywords: ['prospetto', 'prospetti'], folder: '02_PROGETTAZIONE/ARC/02_PROSPETTI/' },
          { keywords: ['sezione', 'sezioni'], folder: '02_PROGETTAZIONE/ARC/03_SEZIONI/' },
          { keywords: ['struttura', 'strutturale', 'trave', 'pilastro'], folder: '02_PROGETTAZIONE/STR/' },
          { keywords: ['impianto', 'idraulico', 'termico'], folder: '02_PROGETTAZIONE/IM/' },
          { keywords: ['elettrico', 'illuminazione'], folder: '02_PROGETTAZIONE/IE/' },
        ],
        default: '04_ELABORATI_GRAFICI/01_TAVOLE_PROGETTO/',
      },
      'pdf|doc|docx': {
        patterns: [
          { keywords: ['relazione', 'relaz', 'tecnica'], folder: '02_PROGETTAZIONE/REL/01_TECNICHE/' },
          { keywords: ['calcolo', 'calcoli'], folder: '03_CALCOLI/' },
          { keywords: ['computo', 'metrico', 'capitolato'], folder: '02_PROGETTAZIONE/CME/' },
          { keywords: ['verbale', 'riunione'], folder: '06_VERBALI/01_RIUNIONI/' },
          { keywords: ['corrispondenza', 'lettera'], folder: '05_CORRISPONDENZA/' },
          { keywords: ['contratto', 'incarico'], folder: '10_INCARICO/' },
          { keywords: ['sicurezza', 'psc'], folder: '02_PROGETTAZIONE/SIC/' },
        ],
        default: '01_DOCUMENTI_GENERALI/',
      },
      'jpg|jpeg|png|tiff|bmp': {
        patterns: [
          { keywords: ['sopralluogo', 'foto', 'cantiere'], folder: '07_SOPRALLUOGHI/01_FOTOGRAFICI/' },
          { keywords: ['rilievo', 'survey'], folder: '07_SOPRALLUOGHI/02_RILIEVI/' },
        ],
        default: '07_SOPRALLUOGHI/01_FOTOGRAFICI/',
      },
      'xls|xlsx|csv': {
        patterns: [
          { keywords: ['computo', 'metrico', 'cme'], folder: '02_PROGETTAZIONE/CME/01_COMPUTI/' },
          { keywords: ['parcella', 'fattura', 'preventivo'], folder: '09_PARCELLA/' },
        ],
        default: '02_PROGETTAZIONE/CME/01_COMPUTI/',
      },
    };
  }

  // Get routing rules for BREVE template
  private getBreveRules() {
    return {
      'pdf|doc|docx|dwg|dxf': {
        patterns: [
          { keywords: ['relazione', 'calcolo', 'progetto'], folder: 'ELABORAZIONI/' },
          { keywords: ['consegna', 'richiesta'], folder: 'CONSEGNA/' },
        ],
        default: 'ELABORAZIONI/',
      },
      'jpg|jpeg|png|tiff': {
        patterns: [
          { keywords: ['sopralluogo', 'foto'], folder: 'SOPRALLUOGHI/' },
        ],
        default: 'SOPRALLUOGHI/',
      },
      'xls|xlsx': {
        patterns: [],
        default: 'ELABORAZIONI/',
      },
    };
  }

  // Utility functions
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
  getRoutingStats(): {
    learnedPatternsCount: number;
    aiEnabled: boolean;
    totalRoutings: number;
  } {
    return {
      learnedPatternsCount: Object.keys(this.learnedPatterns).length,
      aiEnabled: !!this.apiKey,
      totalRoutings: 0, // Could be tracked in future
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

// Export helper function for testing AI connection (supports multiple providers)
export const testClaudeConnection = async (apiKey: string, model?: string): Promise<boolean> => {
  return aiRouter.testConnection(apiKey, model);
};

