# Implementation backlog

Stato aggiornato al 14 settembre 2026. Una milestone è "completa" solo quando esiste
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

## Milestone 2 — elezioni e Rules Engine (quasi completa)

Fatto:

- Calendario legale: `P3M` e `P90D` sono termini distinti, con troncamento a fine
  mese, anni bisestili e termini che precedono l'evento.
- Costruttore del contesto di valutazione: superficie dichiarata e whitelistata,
  importi come stringhe decimali, dato assente che resta assente.
- Schemi tipizzati degli effetti; un `effectPayload` malformato rende la regola non
  valutabile invece di essere interpretato con indulgenza.
- Valutatore deterministico come funzione pura, con esito per regola
  (`MATCHED` / `NOT_MATCHED` / `NOT_EVALUABLE`), stato di conformita' e
  `readyToFile`.
- Servizio di valutazione persistente: rilievi, attivita' e scadenze generati e
  riconciliati fra un'esecuzione e l'altra, senza cancellare fatti storici e senza
  toccare i rilievi derogati.
- Provenienza di ogni esecuzione in `AuditLog`: ruleset, versione del valutatore,
  impronta del contesto ed esito regola per regola.
- Deroga professionale con motivazione, autore e data.
- Caricatore dei seed e 23 regole di bozza per Comunali e Politiche, con fonti
  normative, parametri versionati ed effetti completi. Il caricatore non attiva
  mai nulla.
- Lettura dello stato di conformita' ed endpoint `/compliance`.
- Anagrafica territoriale: gerarchia Regione/Provincia/Comune caricata da CSV,
  ricerca dei comuni per il wizard e collegamento della campagna al comune.
- Risolutore dei dati demografici: popolazione ed elettori iscritti risolti fra
  elezione e territorio dichiarando da quale fonte viene ciascun valore, con la
  fonte registrata nell'impronta della valutazione.

Da fare:

- Console legale di amministrazione e rule tester come interfaccia. Il servizio
  `testRuleset` esiste gia' e usa lo stesso valutatore del percorso di produzione;
  manca la pagina. Va costruita insieme al ruolo di amministratore di piattaforma
  della Milestone 11, perche' oggi non esiste un ruolo a cui riservarla.
- Elettori iscritti nelle liste elettorali. L'anagrafica comunale e' caricata
  (7.896 comuni con popolazione residente, 734 sopra i 15.000 abitanti), quindi la
  soglia demografica e' calcolabile. I limiti di spesa no: sono parametrati agli
  elettori iscritti, che il file non contiene. Il dato va acquisito per singola
  consultazione con la propria fonte, nel wizard della Milestone 3.
- Verifica dell'anagrafica territoriale su fonte ufficiale: provenienza e data di
  rilevazione del file caricato non sono note, quindi nessun territorio e' marcato
  come verificato e la regola di sistema lo segnala.
- Anagrafica di `Election`: la campagna puo' collegarsi a un'elezione, ma non
  esiste ancora il percorso per crearla con le proprie date ufficiali.
- Tabella dedicata alla provenienza delle valutazioni, oggi registrata in
  `AuditLog`. Richiede una migration.
- `Campaign.proclamationDate`: il contesto dichiara il campo ma lo schema non ha la
  colonna, quindi le scadenze del rendiconto restano inerti. Richiede una migration
  e arriva con la Milestone 3.

## Milestone 3 — wizard e mandatario (completa)

- Questionario iniziale (`CampaignSetup`) con migration dedicata, piu'
  `Campaign.proclamationDate` e il regime del mandatario memorizzato insieme alle
  regole che lo hanno prodotto e al momento della determinazione.
- La determinazione del regime viene dalle regole, non dal codice: una regola lo
  dichiara con `determinesMandatary` e porta con se' la propria fonte. Il modulo
  si limita a raccogliere e a rifiutare di concludere quando le regole sono in
  conflitto, quando una non e' valutabile o quando nessuna si e' pronunciata.
- Le regole di determinazione leggono sia le dichiarazioni sia i fatti gia'
  registrati: un contributo di terzi incassato da chi si era dichiarato
  autofinanziato ribalta il regime subito.
- Rivalutazione automatica alla registrazione di un contributo. Se fallisce, il
  contributo resta comunque registrato e il chiamante lo viene a sapere.
- Anagrafica territoriale collegabile alla campagna, con ricerca dei comuni.
- Data di proclamazione: registrarla ricalcola le scadenze e produce il termine
  del rendiconto.
- Stato del wizard con i passaggi mancanti e chiusura dell'apertura campagna.
- Test end-to-end sul database reale: comune, questionario, ribaltamento del
  regime, rilievo bloccante, attivita', registro delle operazioni e termine a tre
  mesi calcolato sul giorno giusto.

Da fare in seguito:

- Invito di un mandatario non ancora registrato, che oggi fallisce con
  `INVITATION_DELIVERY_NOT_CONFIGURED` perche' manca il provider email.
- Generazione del documento di nomina: oggi esiste solo una bozza di template.
- Interfaccia del wizard: esistono i servizi e le rotte API, non le pagine.

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
