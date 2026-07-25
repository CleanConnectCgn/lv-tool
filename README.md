# LV-Tool – Clean Connect Gebäudereinigung

Leistungsverzeichnis (LV) Editor, KI-Qualitätscheck, Basic-CRM (Kunden,
Aufträge, Mitarbeiter, Objekte, Google-Kalender) und sevDesk-Integration für
Clean Connect Gebäudereinigung. React (Vite) Frontend, Node/Express Server,
deployed auf Railway.

Läuft live unter https://lv-tool-production.up.railway.app

## Features

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
- Verlinkt mit dem separaten [vertragsgenerator](https://github.com/muecreates/vertragsgenerator)
  (Vertrag direkt aus dem Kundenprofil erstellen)

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

- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` - für KI-Checkup und LV-aus-Bild
- `SEVDESK_TOKEN` - optional, sonst manuell im Formular eintragbar
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - für die Google-Kalender-
  Anbindung (OAuth-Client in der Google Cloud Console anlegen, Redirect-URI
  `<domain>/api/calendar/oauth/callback` eintragen)
- `APP_USERNAME` / `APP_PASSWORD` - optionaler Basic-Auth-Schutz für die
  gesamte App, standardmäßig **nicht** aktiv (offen)
- `DATA_DIR` - Pfad für persistente Daten; auf Railway muss hier ein Volume
  gemountet sein, sonst gehen Dokumente/CRM-Daten bei jedem Redeploy verloren

## Deployment auf Railway

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
                      InspectionMode (Besichtigungsmodus), ErrorBoundary
  lib/                documents.js, sevdesk.js, crm.js, crmKeys.js,
                      lvFromImage.js, lvPdfExport.js
  templates/          checklistAreas.js (aktive Bereichs-Vorlagen),
                      templates.js (nur noch winterdienst + optionalServices
                      aktiv genutzt)
server/index.js       Express-Server: sevDesk-Proxy, KI-Checkup, CRM-/
                      Kalender-Endpoints, Dokument-Speicherung, Backup
```
