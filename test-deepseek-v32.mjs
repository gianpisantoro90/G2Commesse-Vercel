import { analyzeEmail } from './server/lib/ai-email-analyzer.js';

const testEmail = {
  subject: "Richiesta informazioni progetto ristrutturazione",
  from: { name: "Mario Rossi", email: "mario.rossi@example.com" },
  text: "Buongiorno,\n\nVolevo avere un aggiornamento sul progetto di ristrutturazione dell'edificio residenziale in Via Roma.\n\nGrazie\nMario Rossi"
};

const projects = [
  { id: 1, code: "25GUAROM01", client: "Guardia di Finanza - RETLA", object: "Rifacimento Pavimentazione in Via Boglione, 84" },
  { id: 2, code: "24AGOVIT01", client: "Agostino Lupoli", object: "Ristrutturazione Armeria" },
  { id: 3, code: "24LUCFRA01", client: "Luciano Vitale", object: "Valutazione Impatto acustico officina" }
];

const aiConfig = {
  provider: 'deepseek',
  model: 'deepseek-v3.2-exp',
  apiKey: process.env.DEEPSEEK_API_KEY,
  autoRouting: true,
  contentAnalysis: true,
  learningMode: true
};

console.log('🧪 Testing DeepSeek V3.2-exp with thinking enabled...');
console.log('Provider:', aiConfig.provider);
console.log('Model:', aiConfig.model);
console.log('API Key present:', !!aiConfig.apiKey);
console.log('');

try {
  const result = await analyzeEmail({ email: testEmail, projects, config: aiConfig });
  console.log('✅ Analysis completed successfully!');
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('❌ Analysis failed:', error.message);
  if (error.cause) console.error('Cause:', error.cause);
  process.exit(1);
}
