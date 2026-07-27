# LV-Tool – Clean Connect Gebäudereinigung

Leistungsverzeichnis (LV) Editor, KI-Qualitätscheck, Basic-CRM (Kunden,
Aufträge, Mitarbeiter, Objekte, Google-Kalender) und sevDesk-Integration für
Clean Connect Gebäudereinigung. React (Vite) Frontend, Node/Express Server,
deployed auf Railway.

Läuft live unter https://lv-tool-production.up.railway.app

## Features

- **Anmeldung**: Google OAuth als einziger Anmeldeweg, Zugang nur für in
  `ALLOWED_EMAILS` freigeschaltete Konten, 30-Tage-Session-Cookie
- **Postgres/Prisma**: schrittweise Ablösung der dateibasierten Persistenz
  (`prisma/schema.prisma` - Kunden, Objekte, dreistufiger Leistungskatalog,
  Dokumente, Verträge, Betrieb)
- **Kunden (Postgres, neu) - Block 5**: neuer, parallel zum bestehenden CRM
  laufender Bereich auf `/api/db/*`: Kundenformular mit "Rechnungsadresse
  gleich Objektadresse" (legt immer mindestens ein Objekt an, transaktional
  erzwungen), Sammelanlage (mehrere Objekte aus einem mehrzeiligen
  Adressfeld), Leistungsverzeichnis auf andere Objekte übertragen
  (unabhängige Kopien, danach je Objekt einzeln bearbeitbar)
- **sevDesk-Kundenverknüpfung - Block 6**: gleicht sevDesk-Kontakte (nur
  lesend) gegen die neuen Postgres-Kunden ab - exakte E-Mail-Übereinstimmung
  wird sofort automatisch verknüpft, gleiche Firmendomain oder nur
  ähnlicher Firmenname sind reine Vorschläge zur Bestätigung (Namens-
  Ähnlichkeit verknüpft nie automatisch). Jede Verknüpfung lässt sich
  jederzeit wieder trennen
- **Upload und Auslesung - Block 7**: PDF/Foto eines bestehenden
  Leistungsverzeichnisses an ein Objekt hochladen, automatische Zuordnung
  der Positionen zum geschlossenen Leistungskatalog (austauschbarer
  Adapter, Standard Gemini, Anbieterwahl nur über `EXTRACTION_PROVIDER`).
  Das Modell darf ausschließlich vorhandene Katalog-IDs zurückgeben -
  serverseitig erzwungen, nicht nur per Prompt erhofft. Ergebnis immer im
  Review-Editor zur Bestätigung (Raumbereich wählen, Intervalle prüfen);
  nicht zuordenbare Zeilen können zugeordnet, als neuer Katalogpunkt
  angelegt (nur durch einen Menschen) oder verworfen werden. Jeder
  Auslese-Aufruf wird mit Modell/Dauer/Kosten protokolliert
- LV-Editor: Bereiche/Zeilen hinzufügen, entfernen, per Drag & Drop
  neu anordnen, Intervall-Spalten (wöchentlich/monatlich/jährlich) plus
  optionale Wochentagsauswahl, Zusatzleistungen (Glasreinigung,
  Lamellenreinigung, Grundreinigung, Winterdienst-Vorlage)
- Besichtigungsmodus: Leistungen vor Ort per Klick erfassen, Bereichs-Tiles,
  globale Wochentags-Sync
- LV aus Foto/PDF erstellen (Gemini Vision)
- Dualer KI-Checkup (Gemini + Claude) für LV/Angebot
- PDF-Export (jsPDF + autoTable)
- sevDesk-Integration: Kontakte suchen/anlegen, Angebot erstellen (Server-Proxy
  vermeidet CORS; **nur GET/POST erlaubt** - der Server lehnt DELETE/PUT/PATCH
  gegen sevDesk hart ab, das Tool kann dort nie etwas löschen oder ändern)
- **CRM**: Kundenprofile (aus LV/Angebot-Dokumenten aggregiert), Aufträge mit
  Status-Tracking, Mitarbeiter-Verwaltung, Objekte (Liegenschaften mit
  Adresse) inkl. Mitarbeiter-Zuweisung, Google-Kalender-Anbindung
  (wiederkehrende Termine, Verschieben, pro Kunde gefiltert)
- Backup-Export (`/api/backup`) - lädt alle Dokumente/CRM-Daten als eine
  JSON-Datei herunter
- **Sicherung (Block 4)**: separater `backup-worker`-Railway-Dienst
  (`worker/`), täglich 03:00 Europe/Berlin `pg_dump` (komprimiert, 30 Tage
  Aufbewahrung, Mail an den Betreiber bei Fehlschlag), zusätzlich per
  „🗄️ Jetzt sichern" sofort auslösbar. Jedes gespeicherte Dokument landet
  außerdem automatisch als JSON in einem Google-Drive-Ordner
  ("LV-Tool Dokumente"), sobald die Firmenkalender-Verbindung steht
- **Dokumentenausgabe - Block 8**: Leistungsverzeichnis-PDF direkt aus den
  Postgres-ServiceSpecs (Kopfzeile mit Leistungsart/Stand-Datum/Kunde/
  Objektanschrift, feste Spalten, gruppiert nach Raumbereich und darin nach
  Elementgruppe in fester Reihenfolge Boden/Wand/Abfall/Inventar; je Objekt
  ein eigener Abschnitt, Duplikate innerhalb eines Abschnitts werden
  zusammengefasst). Vertrag als DOCX, portiert aus dem separaten
  vertragsgenerator-Repo (`server/lib/render/contractDocx.js`) - Haftung,
  Gewährleistung und Schlussbestimmungen sind fester Code und nicht
  veränderbar, Datenschutz ist eine feste Standardklausel (für Arztpraxis
  etc. per Auswahl eine zusätzliche feste Verschwiegenheitsklausel), einzig
  Kunde/Objekt/Überschrift/Vertragsnummer/Leistungsart/Intervall/Preis/
  Zahlungsziel/Laufzeit/Kündigungsfrist/Leistungsbeginn/Ansprechpartner/
  optionale Positionen sind variabel. Keine KI ist an der Vertragserstellung
  beteiligt - es wird ausschließlich strukturiertes JSON gespeichert
  (`renderedData`), das DOCX wird bei Abruf aus diesen Daten neu gerendert
- **Migration - Block 9**: einmaliges Skript (`scripts/migrate-legacy-data.js`,
  siehe `MIGRATION.md`) übernimmt die bestehenden dateibasierten Dokumente in
  das Postgres-Modell - Kunden/Objekte werden direkt angelegt (inkl.
  sevDesk-Verknüpfung aus der alten Kontakt-ID), Freitext-LV-Zeilen werden per
  Gemini-Textabgleich gegen den geschlossenen Katalog/die Raumbereiche
  zugeordnet und nur bei eindeutigem Ergebnis übernommen (nie geraten, jede
  zurückgegebene ID wird gegen die echte Liste geprüft). Alles andere landet
  unverändert in einem "nicht zugeordnet"-Report zur manuellen Nachbearbeitung
  über die bestehende UI. Läuft gegen einen `/api/backup`-Export, idempotent
  (erneuter Lauf überspringt bereits Migriertes), vor dem echten Lauf per
  Testlauf gegen eine lokale Kopie der Datenbank geprüft

## Lokale Entwicklung

```bash
npm install
npm run dev        # Vite Dev-Server (Port 5173, proxied /api zu :3001)
```

In einem zweiten Terminal für die API während der Entwicklung:

```bash
npm run build
npm start           # Express Server auf PORT (Standard 3001)
```

Tests:

```bash
npm test            # Vitest: Unit-Tests + Server-Endpoint-Tests (supertest)
```

## Umgebungsvariablen

Siehe `.env.example`. Wichtig:

- `DATABASE_URL` - Postgres-Verbindung (Prisma). Auf Railway per
  Referenzvariable an den Postgres-Service gebunden.
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` - für KI-Checkup und LV-aus-Bild
- `SEVDESK_TOKEN` - optional, sonst manuell im Formular eintragbar
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - EIN OAuth-Client in der
  Google Cloud Console mit ZWEI Redirect-URIs: `<domain>/api/auth/google/callback`
  (Anmeldung) und `<domain>/api/calendar/oauth/callback` (Firmenkalender)
- `ALLOWED_EMAILS`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` - Google OAuth
  ist der einzige Anmeldeweg (kein Basic-Auth mehr); nur die in
  `ALLOWED_EMAILS` gelisteten Google-Konten kommen rein
- `DATA_DIR` - Pfad für persistente Daten; auf Railway muss hier ein Volume
  gemountet sein, sonst gehen Dokumente/CRM-Daten bei jedem Redeploy verloren
- `SERVICE_ROLE`, `BACKUP_DIR`, `WORKER_INTERNAL_TOKEN`,
  `BACKUP_WORKER_INTERNAL_URL` - Block 4 (Sicherung), siehe Kommentare in
  `.env.example`

## Deployment auf Railway

Zwei Dienste aus diesem einen Repo (siehe `scripts/start.js`):
`lv-tool` (Web, Standard) und `backup-worker` (`SERVICE_ROLE=backup-worker`,
eigenes Volume unter `/backups`, kein öffentliches Domain).

1. Neues Projekt auf [railway.app](https://railway.app) erstellen.
2. Deploy erfolgt hier nicht über GitHub-Autodeploy, sondern per
   `railway up` (CLI) aus diesem Ordner.
3. Volume unter `/data` mounten und `DATA_DIR=/data` setzen.
4. Umgebungsvariablen aus `.env.example` setzen (`railway variables --set ...`).
5. Domain unter "Settings → Networking → Generate Domain" freischalten.

## Projektstruktur

```
src/                 React-Frontend
  components/        LVEditor, SectionBlock, RowEditor, SevDeskModal,
                      Crm* (Kundenliste/-profil/Aufträge/Mitarbeiter/Objekte),
                      InspectionMode (Besichtigungsmodus), ErrorBoundary,
                      AuthGate/LoginScreen (Block 3, Google-Anmeldung)
  lib/                documents.js, sevdesk.js, crm.js, crmKeys.js,
                      lvFromImage.js, lvPdfExport.js, auth.js
  templates/          checklistAreas.js (aktive Bereichs-Vorlagen),
                      templates.js (nur noch winterdienst + optionalServices
                      aktiv genutzt)
server/index.js       Express-Server: Auth-Gate, sevDesk-Proxy, KI-Checkup,
                      CRM-/Kalender-Endpoints, Dokument-Speicherung, Backup
server/lib/           auth.js (Google-Login, Session-Cookie, ALLOWED_EMAILS),
                      crypto.js (AES-256-GCM für gespeicherte OAuth-Tokens),
                      mailer.js (geteilt mit worker/), drive.js (Google-Drive-
                      Upload je gespeichertem Dokument), dbCrm.js (Block 5,
                      Kunden/Objekte/Leistungsverzeichnis-Endpoints),
                      sevdeskLink.js (Block 6, sevDesk-Kundenverknüpfung),
                      uploads.js (Block 7, Upload-Endpoints), prisma.js
server/lib/extraction/ Austauschbarer Auslese-Adapter (Block 7): index.js
                      (Dispatcher + Katalog-ID-Validierung + Protokollierung),
                      gemini.js (Standard-Implementierung)
server/lib/render/    Dokumentenausgabe (Block 8): lvPdf.js (LV-PDF gegen
                      ServiceSpec/Katalog, jsPDF + autoTable), contractDocx.js
                      (Vertrags-DOCX, aus vertragsgenerator/build_docs_v17
                      portiert, feste Klauseln + begrenzte Variablenliste),
                      contractFields.js (Konstanten/DSGVO-Varianten, 1:1 aus
                      vertragsgenerator übernommen)
worker/               Backup-Worker (Block 4), eigener Railway-Dienst:
                      backup.js (pg_dump/gzip/Scheduler), storage.js
                      (austauschbarer Speicher-Adapter), index.js (Prozess-
                      Einstieg + interner /run-now-Endpoint)
scripts/start.js      Ein Codebase, zwei Rollen: startet server/index.js
                      oder worker/index.js je nach SERVICE_ROLE
scripts/migrate-legacy-data.js  Einmaliges Migrationsskript (Block 9), siehe
                      MIGRATION.md
prisma/schema.prisma  Postgres-Schema (Block 2)
prisma/seed.js        Feste Raumbereiche/Elementgruppen + Start-Katalog
                      (Block 5). Ausführen mit: npx prisma db seed
                      (idempotent, kann gefahrlos mehrfach laufen)
```
