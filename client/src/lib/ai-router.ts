// AI-powered file routing system for G2 Commesse

import { localStorageHelpers } from "./storage";

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
      console.log('AI Router Debug - Stored config:', storedConfig ? 'exists' : 'not found');
      
      if (storedConfig) {
        // The entire config is base64 encoded (by useEncryptedLocalStorage), decode it
        const decoded = atob(storedConfig);
        const config = JSON.parse(decoded);
        console.log('AI Router Debug - Parsed config keys:', Object.keys(config));
        console.log('AI Router Debug - Has API key:', !!config.apiKey);
        
        // The API key is stored directly without additional encoding
        this.apiKey = config.apiKey || null;
        
        if (this.apiKey) {
          console.log('AI Router Debug - API key loaded successfully');
        } else {
          console.log('AI Router Debug - No API key in config');
        }
      } else {
        console.log('AI Router Debug - No config found in localStorage');
        this.apiKey = null;
      }
    } catch (error) {
      console.error('AI Router Debug - Error loading config:', error);
      this.apiKey = null;
    }
    
    // Load learned patterns
    this.learnedPatterns = localStorageHelpers.loadLearnedPatterns();
    this.isInitialized = true;
  }

  // Test Claude API connection via backend proxy
  async testConnection(apiKey?: string): Promise<boolean> {
    const keyToTest = apiKey || this.apiKey;
    if (!keyToTest) {
      console.error('Claude API test failed: No API key provided');
      return false;
    }

    console.log('Testing Claude API connection via backend...');
    
    try {
      const response = await fetch('/api/test-claude', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: keyToTest,
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
      
      console.log('Claude API test successful:', data.message);
      return true;
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'UnknownError',
      };
      console.error('Claude API test failed with exception:', errorDetails);
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

    console.log('AI Router Debug - Starting file routing for:', file.name);
    console.log('AI Router Debug - Has API key:', !!this.apiKey);
    console.log('AI Router Debug - Project template:', projectTemplate);

    const analysis = await this.analyzeFile(file);
    console.log('AI Router Debug - File analysis:', analysis);
    
    // Try learned patterns first (highest priority)
    const learnedResult = this.checkLearnedPatterns(analysis);
    if (learnedResult.confidence > 0.9) {
      console.log('AI Router Debug - Using learned patterns');
      return { ...learnedResult, method: 'learned' };
    }

    // Try AI routing if available
    if (this.apiKey) {
      console.log('AI Router Debug - Attempting AI routing');
      try {
        const aiResult = await this.aiRouting(analysis, projectTemplate);
        console.log('AI Router Debug - AI routing result:', aiResult);
        if (aiResult.confidence > 0.7) {
          console.log('AI Router Debug - Using AI routing result');
          return { ...aiResult, method: 'ai' };
        } else {
          console.log('AI Router Debug - AI confidence too low, falling back to rules');
        }
      } catch (error) {
        console.warn('AI routing failed, falling back to rules:', error);
      }
    } else {
      console.log('AI Router Debug - No API key, skipping AI routing');
    }

    // Fallback to rules-based routing
    console.log('AI Router Debug - Using rules-based routing');
    const rulesResult = this.rulesBasedRouting(analysis, projectTemplate);
    console.log('AI Router Debug - Rules result:', rulesResult);
    return { ...rulesResult, method: 'rules' };
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

  // AI-powered routing using Claude via backend proxy
  private async aiRouting(
    analysis: FileAnalysis,
    template: string
  ): Promise<RoutingResult> {
    if (!this.apiKey) {
      throw new Error('API Key non configurata');
    }

    const prompt = this.buildAIPrompt(analysis, template);
    
    try {
      const response = await fetch('/api/ai-routing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: this.apiKey,
          prompt: prompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
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
      console.error('AI routing error:', error);
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

  // Build AI prompt
  private buildAIPrompt(analysis: FileAnalysis, template: string): string {
    const templateInfo = template === 'LUNGO' 
      ? 'progetto complesso con cartelle ARC, STR, IM, IE, IS, REL, CME, SIC'
      : 'progetto semplice con cartelle CONSEGNA, ELABORAZIONI, MATERIALE_RICEVUTO, SOPRALLUOGHI';

    return `Analizza questo file per un progetto di ingegneria civile.

File: ${analysis.fileName}
Tipo: ${analysis.fileType}
Estensione: ${analysis.extension}
Dimensione: ${Math.round(analysis.fileSize / 1024)}KB
Template: ${template} (${templateInfo})
${analysis.preview ? `Anteprima contenuto: ${analysis.preview.substring(0, 200)}...` : ''}

Suggerisci il percorso più appropriato per questo file nella struttura del progetto.

Rispondi SOLO con un JSON nel formato:
{
  "suggestedPath": "percorso/cartella/",
  "confidence": 0.0-1.0,
  "reasoning": "spiegazione breve",
  "alternatives": ["percorso1/", "percorso2/"]
}`;
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

// Export helper function for testing Claude connection
export const testClaudeConnection = async (apiKey: string): Promise<boolean> => {
  return aiRouter.testConnection(apiKey);
};

