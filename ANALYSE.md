# ANALYSE — Ist-Zustand LV-Tool (Block 0)

Stand: 2026-07-25. Reine Bestandsaufnahme, keine Codeänderung. Grundlage für die
Freigabe von Block 1 bis 9.

---

## 1. Stack und Ordnerstruktur

**Frontend:** React 18 + Vite 5 (Single-Page-App, kein Router — Ansichtswechsel
über einen `view`-State in `App.jsx`). Kein TypeScript. Kein Tailwind — Styling
liegt vollständig in einer einzigen Datei `src/index.css` (~2100 Zeilen) mit
CSS-Custom-Properties als Token-Ansatz.

**Backend:** Node.js + Express 4, ein einziger Prozess (`server/index.js`,
~1425 Zeilen). Liefert im Produktionsbetrieb sowohl die API unter `/api/*` als
auch das gebaute Frontend aus `dist/` (SPA-Fallback auf `index.html`).

**Tests:** Vitest + Supertest. Server-Endpoint-Tests (`server/index.test.js`,
31 Tests) plus einige Unit-Tests (`crmKeys`, `templates`, `checklistAreas`,
`WeekdaySelector`). `server/index.js` exportiert `app` und ruft `listen()` nur
beim Direktstart, damit Supertest ohne offenen Port testen kann.

**Deployment:** Railway, Builder Nixpacks, Start `npm start`. **Kein
GitHub-Autodeploy** — Deploy erfolgt manuell per `railway up` aus dem Ordner
(siehe README). Ein Railway-Volume `lv-tool-volume` ist unter `/data` gemountet
(`DATA_DIR=/data`). Node-Version nirgends gepinnt (kein `engines`, kein `.nvmrc`).

```
lv-tool/
  index.html, vite.config.js, railway.json, package.json
  .env.example                 dokumentiert alle Env-Variablen
  dist/                        Build-Output (nicht in git; .gitignore)
  public/logo.svg
  server/
    index.js                   GESAMTE Server-Logik (Proxy, KI, CRM, Kalender, Persistenz)
    index.test.js
  src/
    main.jsx, App.jsx          App.jsx = zentraler Zustand + Ansichts-Routing
    index.css                  komplettes Design in einer Datei
    assets/logo.js             Logo als Data-URI
    components/                LVEditor, SectionBlock, RowEditor, Header, PrintView,
                               SevDeskModal, CustomerModal, QuickSetup, InspectionMode,
                               AICheckupModal, AIStatusBadge, LvFromFileModal, Overview,
                               ExportedPdfsList, MiniGame, ErrorBoundary,
                               Crm* (CustomerList, CustomerProfile, AllAuftraege,
                               Mitarbeiter, MitarbeiterProfile, AllObjekte, DashboardWidget),
                               WeekdaySelector
    lib/                       documents.js, crm.js, sevdesk.js, crmKeys.js,
                               lvFromImage.js, lvPdfs.js, lvPdfExport.js
    templates/                 checklistAreas.js (aktive Bereichsvorlagen für Quick-Setup),
                               templates.js (nur noch winterdienst + optionalServices aktiv),
                               inspectionTasks.js, suggestions.js
```

**Wichtiger Architektur-Fund:** Der **Vertragsgenerator ist ein separates Repo**
(`/Users/machee/vertragsgenerator`, eigenes Railway-Deployment, React 19 + `docx`).
Der Vertragstext wird dort in `src/lib/build_docs_v17.js` (~640 Zeilen) als DOCX
mit festen Klauseln erzeugt, inkl. DSGVO-Varianten und einer zuschaltbaren
Arztpraxis-Verschwiegenheitsklausel (`contractFields.js`). Das LV-Tool verlinkt
nur dorthin (Button auf der Übersicht + Vertragsliste im Kundenprofil via
Cross-Origin-`GET /api/contracts`). **Block 8 („Vertrag") existiert damit fachlich
schon — aber im falschen Repo und ohne gemeinsame Datenbank.** Siehe offene
Entscheidung D1.

---

## 2. Aktuelle Datenhaltung — wo liegen Kunden, LVs und Dokumente heute

**Keine Datenbank.** Alles sind einzelne JSON-Dateien auf dem Railway-Volume unter
`DATA_DIR` (`/data`). Eine Datei pro Datensatz, UUID als Dateiname. Verzeichnis-
struktur (aus `server/index.js`):

```
/data/
  documents/            <uuid>.json     LVs UND Angebote (das Kern-Objekt)
  Leistungsverzeichnisse/ <name>.pdf    exportierte LV-PDFs (Ablage/Wiederabruf)
  crm/
    customers/          <key>.json      NUR Notizen pro Kunde (Stammdaten NICHT hier)
    auftraege/          <uuid>.json     Aufträge (Status-Tracking + Kalender-Verknüpfung)
    mitarbeiter/        <uuid>.json     Mitarbeiter-Stammdaten
    objekte/            <uuid>.json     Objekte/Liegenschaften mit Adresse
    calendar-token.json                 Google-OAuth-Refresh-Token (unverschlüsselt!)
    last-digest.json                    Datum des letzten E-Mail-Digests
```

**Kunden haben KEINE eigene Stammdaten-Tabelle.** Der „Kunde" lebt eingebettet im
`customer`-Feld jedes `documents/<uuid>.json`. Die Kundenliste
(`GET /api/crm/customers`) wird **zur Laufzeit aggregiert**, indem alle Dokumente
gelesen und nach `customerKeyFor(customer)` gruppiert werden. Der Schlüssel ist
`sevdesk-<id>` wenn eine sevDesk-Kontakt-ID vorliegt, sonst
`name-<slug-des-namens>` (`src/lib/crmKeys.js`). Unter `crm/customers/<key>.json`
liegen **nur die CRM-Notizen**, nicht die Adress-/Kontaktdaten.

Folgen dieses Modells (für die Migration relevant):
- Ein Kunde ohne Dokument „existiert" nur, wenn er noch einen Auftrag oder ein
  Objekt hat — dafür gibt es die Sonderbehandlung `findOrphanCustomers()`.
- Kundenstammdaten sind über alle seine Dokumente **dupliziert**; die Version mit
  dem neuesten `updatedAt` „gewinnt". Umbenennen eines Kunden ohne sevDesk-ID
  ändert den Schlüssel und zerreißt die Zuordnung → dafür existiert der
  Merge-Endpoint.
- `objekte` referenzieren den Kunden per `customerKey` (String), nicht per ID.
- `localStorage` wird **nicht** für Geschäftsdaten genutzt — nur für den
  sevDesk-Token-Cache im Browser und den Highscore des Minispiels. Block 9
  („Daten aus localStorage") betrifft hier also faktisch die **JSON-Dateien auf
  dem Volume**, nicht den Browser-Speicher.

**Robustheit:** `readJsonFileSafe()` fängt korrupte Einzeldateien ab, damit eine
kaputte Datei nicht die ganze Liste (`Promise.all`) mitreißt. Es gibt **keine
Transaktionen, kein Locking, keine referenzielle Integrität** — zwei parallele
Schreibvorgänge auf dieselbe Datei können sich überschreiben (Last-Write-Wins).

---

## 3. Bestehende sevDesk-Anbindung

**Key:** liegt serverseitig in der Env-Variable `SEVDESK_TOKEN` (auf Railway
gesetzt). Der Client kann alternativ einen Token im Formular eintragen (im Browser
`localStorage` gecacht); `GET /api/sevdesk/token` liefert den Server-Default zum
Vorbefüllen. Der Token verlässt den Server nur Richtung sevDesk.

**Proxy-Endpunkte** (alle in `server/index.js`, Zweck: CORS umgehen):
- `POST /api/sevdesk/request` — generischer JSON-Proxy. **Hart abgesichert:
  `SEVDESK_ALLOWED_METHODS = {GET, POST}`** — PUT/PATCH/DELETE werden mit 403
  serverseitig abgelehnt, egal was das Frontend schickt. Das Tool kann in sevDesk
  **niemals löschen oder ändern**, nur lesen und anlegen. **Diese Regel ist
  bindend und bleibt in allen Blöcken bestehen.**
- `POST /api/sevdesk/form-request` — form-encoded Proxy für die Factory-Endpunkte
  (`flattenToForm()` wandelt verschachtelte Objekte in `order[header]=…`).
- `GET /api/sevdesk/offer-pdf/:id` — lädt das Angebots-PDF (intern ein
  `/Order`-Dokument mit `orderType=AN`).

**Welche sevDesk-Objekte werden gelesen/angelegt** (`src/lib/sevdesk.js`):
- **Gelesen:** `Contact` (Kontaktsuche), `ContactAddress` (Adresse), `SevUser`
  (Ansprechpartner + eigene User-ID), `Order/Factory/getNextOrderNumber?orderType=AN`
  (nächste Angebotsnummer, z. B. „AN-1275").
- **Angelegt (POST):** `Contact`, `ContactAddress`, `CommunicationWay` (E-Mail),
  und der Kern: `Order/Factory/saveOrder` — ein **Angebot = ein `Order`
  (`orderType=AN`)** mit je einer `OrderPos` pro Leistungsgruppe (Hauptleistung +
  optionale wie Glas/Winterdienst als `optional`-Position). Wichtiges Detail:
  sevDesk hat **keine** eigene „Offer"-Ressource; Angebote sind Orders.
- **Rückschreibung:** Nach erfolgreichem Anlegen ruft `SevDeskModal`
  `onOfferCreated()` in `App.jsx` auf; die Angebotsnummer + Beträge werden in das
  `offer`-Feld des jeweiligen `documents/<uuid>.json` gespeichert (überlebt Reload).
  `sevdesk_contact_id` wird als `customer.id` im Dokument gehalten.
- **Caching:** `getSevUserId` cached pro Token (`Map`), nicht global.

Für Block 6 (Kundenabgleich) ist die Basis vorhanden: Kontaktsuche liest bereits
`/Contact?depth=1&limit=100` clientseitig gefiltert.

---

## 4. Gesetzte Umgebungsvariablen (Railway, Produktion)

Werte sind hier **bewusst nicht abgedruckt** (dieses Dokument geht in git). Nur der
Setzstatus:

| Variable | Status | Zweck |
|---|---|---|
| `ANTHROPIC_API_KEY` | **gesetzt** | Claude (KI-Checkup Schritt 2) — Modell `claude-sonnet-4-6` |
| `GEMINI_API_KEY` | **gesetzt** | Gemini (KI-Checkup Schritt 1, LV-aus-Bild) — Modell `gemini-flash-latest` |
| `GOOGLE_CLIENT_ID` | **gesetzt** | Google-OAuth (aktuell nur Kalender-Scope) |
| `GOOGLE_CLIENT_SECRET` | **gesetzt** | dito |
| `SEVDESK_TOKEN` | **gesetzt** | sevDesk-API-Key |
| `DATA_DIR` | **gesetzt** (`/data`) | Volume-Mountpunkt |
| `RAILWAY_VOLUME_*` | gesetzt | Volume `lv-tool-volume` an `/data` |
| `APP_USERNAME` / `APP_PASSWORD` | **NICHT gesetzt** | ⇒ App läuft aktuell **völlig ohne Login** (offen) |
| `SMTP_USER` / `SMTP_APP_PASSWORD` / `NOTIFY_EMAIL` | **NICHT gesetzt** | ⇒ E-Mail-Digest inaktiv |
| `VITE_CRM_SYNC_TOKEN` | **NICHT gesetzt** | Shared Secret zum Vertragsgenerator |
| Postgres-URL o. Ä. | **NICHT vorhanden** | es gibt noch keine Datenbank |

**Für die Modell-Keys wichtig (Block 7):** Es sind zwei nutzbare Vision-/LLM-Keys
vorhanden (Gemini + Anthropic). Block 7 fordert Gemini als Standard-Adapter — der
Key liegt bereits.

**Für Block 3/4 fehlt noch:** ein Postgres-Dienst, S3-kompatibler Speicher-Zugang,
`ALLOWED_EMAILS`, ein Verschlüsselungs-Secret für die OAuth-Tokens, sowie
zusätzliche Google-Scopes (`profile`, `email` — aktuell nur `calendar`).

---

## 5. Wo Layout und Rendering der Dokumente passieren

Es gibt **drei getrennte Renderpfade**, und alle Layout-/Rahmen-Definitionen liegen
bereits fest im Code (nicht KI-generiert) — das passt zum Grundprinzip des Auftrags:

1. **Bildschirm-Editor** — `src/components/PrintView.jsx` (verstecktes
   Print-Layout) + `Header.jsx`/`LVEditor.jsx`/`SectionBlock.jsx`. Feste
   Tabelle: Spalten *Einzelleistung · Bei Bedarf · Wöchentlich · Monatlich ·
   Jährlich · Bemerkungen*. **Das entspricht exakt den vier Intervallspalten aus
   Block 2/8.** Sonderfall `intervalColumn:'aufAnfrage'` rendert eine über drei
   Spalten laufende „Auf Anfrage"-Zelle.

2. **PDF-Export** — `src/lib/lvPdfExport.js` (jsPDF 4.2.1 + jspdf-autotable).
   Rein regelbasiert: fester CC-Briefkopf, feste Spaltenbreiten, wiederholter
   Tabellenkopf pro Seite, vollständige Firmenfußzeile. Kein html2canvas/Screenshot
   mehr. Markenfarben Teal/Schwarz auf Weiß fest verdrahtet.

3. **CSS-Print** (`@media print` in `index.css`) — für „Drucken" im Browser.

**Wichtig für Block 1:** Das erzeugte Dokument (`.lv-document`, `.pv-*`, PDF) ist
**schwarz-auf-weiß mit CC-Briefkopf** und soll das laut Auftrag auch bleiben. Die
**Bedien-Oberfläche** (Übersicht, Toolbar, Modals, CRM) ist davon getrennt und
wurde in dieser Session bereits auf ein dunkles CC-Markenschema
(near-black `#0B0E0E`-Familie + Teal) umgestellt — das deckt sich weitgehend mit
den Block-1-Tokens (siehe D2).

Der **Vertrag** wird separat als DOCX in `vertragsgenerator/build_docs_v17.js`
gebaut — ebenfalls fester Code, variabel nur die Felder. Deckt sich mit Block 8.

---

## 6. Die drei größten Schwachstellen für Mehrbenutzerbetrieb

**S1 — Keine echte Authentifizierung, kein Benutzerkonzept, alles global.**
`APP_USERNAME`/`APP_PASSWORD` sind nicht gesetzt, d. h. die Live-App ist **offen im
Netz** — inkl. sevDesk-Proxy, aller Kundendaten und `GET /api/backup` (kompletter
Datenexport). Selbst mit Basic-Auth gäbe es nur **ein** geteiltes Passwort, keine
Benutzer, keine Rollen, keinen `owner_id`. Es gibt kein „wer hat was angelegt".
Der Google-Kalender hängt an **einem** global gespeicherten Refresh-Token
(`calendar-token.json`, **unverschlüsselt** auf dem Volume). → Blöcke 2/3 (users,
owner_id, Google-Login, verschlüsselte Tokens) adressieren genau das.

**S2 — Dateibasierte Persistenz ohne Transaktionen, Locking oder Integrität.**
Eine JSON-Datei pro Datensatz, Aggregation zur Laufzeit durch Einlesen *aller*
Dokumente (`loadAllDocuments()` bei jedem `GET /api/crm/customers`). Bei mehreren
gleichzeitigen Nutzern drohen Last-Write-Wins-Verluste (kein Locking),
inkonsistente Zustände (Kunde nur als Kopie im Dokument, kein FK zu Objekt/Auftrag)
und lineare Verlangsamung mit der Datenmenge. Kundenidentität hängt an einem aus
dem Namen abgeleiteten Slug — fragil bei Umbenennung. → Block 2 (Prisma/Postgres
mit echten Relationen und `owner_id`) ist die Kernlösung.

**S3 — Einzige Kopie der Daten auf einem ephemeren Volume, kein Backup-Automatismus.**
Alle Geschäftsdaten liegen ausschließlich auf dem Railway-Volume. Ein manuelles
`GET /api/backup` existiert, aber **keine automatische, ausgelagerte Sicherung**.
Volume-Verlust, versehentliches Löschen oder ein Migrationsfehler wären
unwiederbringlich. Zusätzlich ist der Backup-Endpunkt ungeschützt (siehe S1). →
Block 4 (täglicher `pg_dump` nach S3, 30 Tage, Fehler-Mail) adressiert das.

Weitere (nachgeordnete) Punkte: Single-Prozess ohne Health-/Readiness-Trennung;
kein Audit-Log; `dist/` wird zur Laufzeit statisch bedient (Redeploy nötig für
Frontend-Änderungen); kein strukturiertes Logging/Monitoring der KI-Kosten
(Block 7 fordert Protokollierung).

---

## Offene Entscheidungen vor Block 1 (fachlich mehrdeutig / würde Bestehendes brechen)

Diese Punkte betreffen genau die Fälle, für die der Auftrag Rückfrage verlangt.
Ich würde sie vor dem Start klären, statt eine Richtung stillschweigend zu wählen:

- **D1 — Vertragsgenerator: konsolidieren oder koppeln?** Block 8 (Vertrag) und
  Block 2 (`contracts`, `documents`) setzen voraus, dass Verträge in dieser
  Datenbank liegen. Der funktionierende Vertragscode liegt aber im **separaten
  Repo** `vertragsgenerator` (eigenes Deployment, React 19, `docx`). Optionen:
  (a) `build_docs_v17` als Modul ins LV-Tool übernehmen und den Generator hier
  integrieren; (b) beide Apps auf **dieselbe neue Datenbank** zeigen lassen und
  das separate Repo bestehen lassen. (a) ist sauberer für ein einheitliches
  Datenmodell, (b) bricht weniger. **Empfehlung: (a), aber erst nachdem die DB
  steht.** Bitte bestätigen.

- **D2 — Design in Block 1: Tailwind einführen?** Block 1 nennt „CSS-Variablen
  plus Tailwind-Config". Das Projekt nutzt **kein Tailwind** (reines CSS in
  `index.css`). Tailwind einzuführen ist ein Build-System-Eingriff, der alle
  Komponenten anfasst. Alternativ setze ich die geforderten Tokens als
  CSS-Variablen um (Mechanik ist bereits vorhanden) — Ergebnis identisch, ohne
  Tailwind. Zusätzlich: die Tokens sind fast deckungsgleich mit dem gerade
  eingeführten dunklen CC-Schema; das erzeugte **Dokument** bleibt laut Auftrag
  schwarz-auf-weiß. **Empfehlung: Tokens als CSS-Variablen statt Tailwind.**
  Bitte bestätigen.

- **D3 — Postgres + S3 bereitstellen.** Für Block 2/4 brauche ich einen
  Postgres-Dienst auf Railway und einen S3-kompatiblen Bucket (+ Zugangsdaten).
  Ich kann die Prisma-/Worker-Struktur vorbereiten und die Migration gegen eine
  **Kopie** fahren, aber das Provisionieren der Dienste und das Setzen der Secrets
  (`DATABASE_URL`, S3-Keys, `ALLOWED_EMAILS`, Token-Verschlüsselungs-Secret) musst
  du vornehmen bzw. freigeben. Reihenfolge-Vorschlag: DB anlegen → Block 2 Schema
  → Probemigration (Block 9-Probelauf) → erst dann Produktivmigration.

- **D4 — Reihenfolge Kalender/Instantly.** „Nicht in diesem Auftrag" schließt
  Kalender-Serien aus Verträgen und Instantly-Webhooks aus, das Datenmodell
  (`recurring_jobs`, `leads`, `webhook_events`) soll sie aber vorbereiten. Ich
  lege die Tabellen an, implementiere aber keine Logik dafür — nur zur Bestätigung.

**Bindende Leitplanken, die ich in allen Blöcken einhalte:** kein Löschen
bestehender Daten; sevDesk bleibt GET/POST-only und wird nur erweitert; Backup vor
Migration; bei drohendem Bruch anhalten und melden; keine Bindestriche in
generierten Dokumententexten; KI erzeugt nur strukturierte Daten, niemals
Dokument-/Vertragstext.

---

**Block 0 abgeschlossen. Ich warte auf Freigabe (und idealerweise auf die
Entscheidungen D1–D4), bevor ich mit Block 1 beginne.**
