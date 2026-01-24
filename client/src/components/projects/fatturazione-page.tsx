/**
 * Fatturazione Page - Unified Billing Flow
 *
 * Pagina unificata per la gestione completa di prestazioni e fatturazione.
 * Visualizza tutte le commesse con il loro flusso completo:
 * - Prestazioni con stato workflow (da_iniziare -> in_corso -> completata -> fatturata -> pagata)
 * - Fatture inline collegate alle prestazioni
 * - Alert automatici per prestazioni da fatturare, fatture scadute, pagamenti in ritardo
 * - Configurazione soglie alert
 */

import BillingFlow from "./billing-flow";

export default function FatturazionePage() {
  return <BillingFlow />;
}
