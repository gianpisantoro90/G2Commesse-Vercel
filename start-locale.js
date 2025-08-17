// Script di avvio in modalità locale per Windows
// Questo file JavaScript gestisce correttamente le variabili d'ambiente

console.log('');
console.log('================================================');
console.log('  G2 INGEGNERIA - AVVIO IN MODALITA LOCALE');
console.log('================================================');
console.log('');

// Imposta modalità locale
process.env.NODE_ENV = 'local';
process.env.PORT = process.env.PORT || '5000';

console.log('✅ Modalità locale attivata');
console.log('📁 I dati saranno salvati in:', process.cwd() + '\\data');
console.log('🌐 Applicazione disponibile su: http://localhost:' + process.env.PORT);
console.log('');
console.log('⚠️  Per fermare: premi Ctrl+C');
console.log('');
console.log('================================================');
console.log('');

// Avvia il server
require('./server/index.ts');