# GUIDA AL POPOLAMENTO TAVOLE DM 17/06/2016

## File da modificare
`client/src/lib/dm2016-tavole-ufficiali.ts`

## Come popolare la Tavola Z-1 (Categorie Opere)

Guardando il PDF ufficiale (https://www.bosettiegatti.eu/info/norme/statali/2016_dm_17_06_tariffe_allegato.pdf),
per ogni categoria aggiungi una voce seguendo questo formato:

```typescript
{
  id: 'E.15',  // Codice dalla tabella
  categoria: 'E',  // Lettera principale (E, S, IM, IA, V, ICT, P, U)
  descrizione: 'Edifici per lo sport',  // Descrizione breve
  destinazioneFunzionale: 'Palestre, piscine, impianti sportivi',  // Descrizione completa dal PDF
  G: 0.95  // Valore G dalla colonna "Grado di complessità"
}
```

### Categorie da completare:

#### EDILIZIA (E)
- [ ] E.01 ✅ (già inserito)
- [ ] E.02 ✅ (già inserito)
- [ ] E.03 ✅ (già inserito)
- [ ] E.04 ✅ (già inserito)
- [ ] E.05 (da completare)
- [ ] E.06 (da completare)
- [ ] E.07 (da completare)
- [ ] E.08 (da completare)
- [ ] E.09 ✅ (già inserito)
- [ ] E.10-E.25 (da completare)

#### STRUTTURE (S)
- [ ] S.01-S.XX (da completare)

#### IMPIANTI (IM)
- [ ] IM.01-IM.XX (da completare)

#### INFRASTRUTTURE VIARIE (IA)
- [ ] IA.01-IA.XX (da completare)

#### OPERE IDRAULICHE (V)
- [ ] V.01-V.XX (da completare)

#### TECNOLOGIE ICT
- [ ] ICT.01-ICT.XX (da completare)

#### PAESAGGIO (P)
- [ ] P.01-P.XX (da completare)

#### TERRITORIO E URBANISTICA (U)
- [ ] U.01-U.XX (da completare)

## Come popolare la Tavola Z-2 (Prestazioni)

Per ogni prestazione:

```typescript
{
  codice: 'QbI.06',  // Codice dalla tabella
  fase: 'progettazione',  // Fase: progettazione | direzione | sicurezza | collaudo | altro
  descrizione: 'Descrizione completa prestazione',  // Dal PDF
  Q: 0.15  // Valore Q dalla colonna "Parametro di incidenza"
}
```

### Prestazioni da completare:

#### PROGETTAZIONE (QbI)
- [ ] QbI.01-QbI.05 ✅ (già inseriti)
- [ ] QbI.06-QbI.XX (da completare)

#### DIREZIONE LAVORI (QcI)
- [ ] QcI.01-QcI.04 ✅ (già inseriti)
- [ ] QcI.05-QcI.XX (da completare)

#### SICUREZZA
- [ ] QcI.10-QcI.11 ✅ (già inseriti)
- [ ] Altri codici (da completare)

#### COLLAUDI (QdI)
- [ ] QdI.01-QdI.03 ✅ (già inseriti)
- [ ] Altri codici (da completare)

#### ALTRE PRESTAZIONI (QeI)
- [ ] QeI.01-QeI.02 ✅ (già inseriti)
- [ ] QeI.03-QeI.XX (da completare)

## Priorità

1. **ALTA**: Categorie Edilizia E.01-E.25 (le più usate)
2. **ALTA**: Prestazioni progettazione e direzione lavori complete
3. **MEDIA**: Altre categorie (S, IM, IA, V)
4. **BASSA**: Categorie speciali (ICT, P, U)

## Note

- I valori con "// VALORE DA VERIFICARE" sono stime e devono essere sostituiti
- Ogni valore G e Q deve corrispondere ESATTAMENTE alla tabella ufficiale
- Le descrizioni devono essere complete e chiare per l'utente finale
