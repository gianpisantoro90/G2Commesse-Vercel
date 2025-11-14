import { createTransport } from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

const transporter = createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

const mailOptions = {
  from: process.env.EMAIL_FROM,
  to: process.env.EMAIL_IMAP_USER,
  subject: 'Test Commessa 25ROSSI01 - Progetto Villa Treviso',
  text: `Gentile Ing. Rossi,

Facciamo seguito alla Vostra richiesta del 10/11/2025 relativa alla commessa 25ROSSI01 per il progetto strutturale della Villa in Via Roma 15, Treviso.

Vi confermiamo:
- Cliente: ROSSI SPA
- Sopralluogo previsto: 20/11/2025 ore 10:00
- Consegna elaborati preliminari: 30/11/2025
- Importo preventivato: € 15.000 + IVA
- Città: Treviso
- Indirizzo cantiere: Via Roma 15

Restiamo a disposizione per eventuali chiarimenti.

Cordiali saluti,
G2 Ingegneria S.T.P. s.r.l.`
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ Errore invio email:', error);
    process.exit(1);
  } else {
    console.log('✅ Email inviata con successo!');
    console.log('📧 Message ID:', info.messageId);
    console.log('⏱️  L\'email sarà processata dall\'AI entro 30 secondi');
    console.log('📍 Vai su "Revisione AI" per vedere i suggerimenti');
    process.exit(0);
  }
});
