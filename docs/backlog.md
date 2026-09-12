# Implementation backlog

Stato aggiornato al 12 settembre 2026. Una milestone è "completa" solo quando esiste
il codice, non quando esiste la migration.

## Milestone 0 — completa

- Documentazione di fondazione, invarianti di prodotto, modello dati, architettura
  delle regole e baseline di sicurezza.
- Template di ambiente e policy esplicita di revisione legale.
- `docs/master-prompt.md`: specifica di riferimento del prodotto.

## Milestone 1 — completa

- Scaffold Next.js/TypeScript/Tailwind/Prisma, migration riproducibili, quality gate.
- Autenticazione, organizzazioni, campagne, profilo candidato, RBAC di campagna,
  repository scopati e audit log append-only.
- Shell di dashboard responsive e test di isolamento fra tenant.

## Milestone 2 — elezioni e Rules Engine (parziale)

Fatto:

- Schema di `LegalSource`, `RulesetVersion`, `RuleParameter`, `ComplianceRule`,
  `ComplianceFinding`, `Task`, `Deadline`.
- DSL dichiarativa delle condizioni e motore di calcolo in aritmetica Decimal, come
  funzioni pure testabili.

Da fare:

- `Election` e `Territory` popolati e collegati alla campagna.
- Servizio di valutazione persistente: dal contesto di campagna alle regole applicabili,
  con provenance (ruleset, regola, hash degli input, versione del valutatore).
- Generazione e ciclo di vita di finding, task e deadline; stato
  `EVALUATION_INCOMPLETE` in caso di errore.
- Caricamento dei seed `prisma/seeds/initial-ruleset-drafts.json` in stato bozza.
- Console legale di amministrazione e rule tester, che devono usare lo stesso servizio
  di valutazione e mai una seconda implementazione.
- Suite di regressione sui confini normativi.

## Milestone 3 — wizard e mandatario (parziale)

Fatto:

- `MandataryProfile` con upsert e audit; invito di un mandatario già registrato.
- Funzione pura di determinazione del regime e bozza di template documentale.

Da fare:

- Wizard di onboarding: elezione, territorio, ruolo, anagrafica, questionario
  finanziario.
- Determinazione del regime tramite Rules Engine anziché input precalcolato.
- Rivalutazione automatica quando cambiano le condizioni di fatto (per esempio un
  contributo di terzi in un regime dichiarato autofinanziato).
- Invito di un mandatario non ancora registrato, che oggi fallisce con
  `INVITATION_DELIVERY_NOT_CONFIGURED` perché manca il provider email.

## Milestone 4 — finance (parziale)

Fatto:

- Creazione di contributi e spese con transazione e audit; riepilogo aggregato.

Da fare:

- `Donor` e `Supplier` come anagrafiche riutilizzabili, con relativi servizi.
- Aggregazione per finanziatore e periodo, come proiezione di dominio ricalcolata
  transazionalmente.
- Calcolo del limite di spesa tramite il motore di calcolo e i parametri versionati.
- `CorporateContributionDetails`: requisiti documentali generati come finding.
- `InKindContribution` ed `ExpenseAllocation`.
- Obbligazioni residue e budget previsionale.

## Milestone 5–10

5. Documenti sicuri, analisi asincrona e verifica umana.
   - Dalla schermata Finanze: inserimento manuale oppure foto/caricamento di fattura o scontrino.
   - OCR e classificazione propongono i campi della spesa; l'utente li verifica prima della registrazione autorevole.
6. Import bancario, riconciliazione e porta del provider Open Banking.
7. Compliance inbox, trasparenza, privacy e timeline.
8. Report con snapshot, template PDF, fascicolo e tracciamento del deposito.
9. Assistente con citazione delle fonti e simulatore dell'operazione.
10. OpenAPI, bulk onboarding ed export, MFA, osservabilità, hardening di sicurezza e staging.

## Milestone 11 — commercializzazione: abbonamenti e back-office

Non presente nel Master Prompt originale, che assume l'esistenza di organizzazioni
già create. Serve per vendere il prodotto.

- Pagina pubblica di presentazione e listino.
- Registrazione self-service che crea utente, organizzazione e campagna.
- `Plan`, `Subscription`, `SubscriptionEvent`: stato dell'abbonamento come fatto
  autorevole nel database, aggiornato dai webhook del gestore dei pagamenti.
- Controllo degli entitlement: cosa può fare un account senza abbonamento attivo.
  I dati già inseriti restano leggibili ed esportabili anche dopo la scadenza.
- Ruolo `PLATFORM_ADMIN`, separato dalle organizzazioni, con back-office: elenco
  abbonati, stato dei pagamenti, supporto agli accessi.
- Impersonificazione di supporto: consentita solo con motivazione, durata limitata,
  traccia in `AuditLog` e visibilità all'utente interessato.
- Verifica email, recupero password e sblocco account.

Sequenza consigliata: dopo il completamento della Milestone 3, così che il percorso
"mi abbono → entro → completo l'onboarding → so se mi serve il mandatario" sia
dimostrabile end-to-end prima di costruire il resto.

## Decisioni bloccanti

- Approvazione di un revisore legale e fonti ufficiali prima di attivare i seed.
- Scelta dei fornitori di hosting, database gestito, object storage, email, OCR/AI,
  antimalware, Open Banking e incasso pagamenti prima di abilitare gli adapter di
  produzione. Tutti devono offrire trattamento dei dati in UE e un accordo ex art. 28
  GDPR: la piattaforma tratta opinioni politiche, dati finanziari e documenti di identità.
- Politiche di hosting, backup, retention e risposta agli incidenti prima del rilascio.
