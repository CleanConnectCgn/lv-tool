# LV-Tool – Clean Connect Gebäudereinigung

Leistungsverzeichnis (LV) Editor für Clean Connect Gebäudereinigung. React (Vite) Frontend, Node/Express Server für Produktion und Deployment auf Railway.

## Features

- Vorlagen: Büro, Arztpraxis, Treppenhaus, Gewerbehalle, Glasreinigung, Winterdienst
- LV-Editor im Clean-Connect-PDF-Layout (Logo, Objekt/Datum/Intervall-Kopfzeile, Spalten Einzelleistungen/Bei Bedarf/Wöchentlich/Monatlich/Jährlich/Bemerkungen)
- Zeilen: Beschreibung, Bedarfs-Checkbox, Intervall-Dropdowns, Bemerkungsfeld
- Zeilen/Bereiche hinzufügen, entfernen, per Drag & Drop neu anordnen
- Zusatzleistungen als Dropdown (Glasreinigung, Lamellenreinigung, Grundreinigung)
- Auto-Datum, editierbares Objektfeld, LV-Typ-Auswahl
- sevDesk-Integration: erstellt ein Angebot über die sevDesk API (Server-Proxy vermeidet CORS)
- PDF-Export (html2pdf.js) mit Dateiname `Leistungsverzeichnis_[Objekt]_[Datum].pdf`
- Druckansicht

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

## Deployment auf Railway

1. Neues Projekt auf [railway.app](https://railway.app) erstellen → "Deploy from GitHub repo" → `muecreates/lv-tool` auswählen.
2. Railway erkennt Node automatisch (Nixpacks). Build-Command: `npm run build` (führt `vite build` aus). Start-Command: `npm start` (in `railway.json` konfiguriert).
3. Keine zusätzlichen Umgebungsvariablen nötig – der Server liest `PORT` automatisch aus der von Railway gesetzten Umgebungsvariable.
4. Nach dem ersten Deploy Domain unter "Settings → Networking → Generate Domain" freischalten.
5. sevDesk-API-Token wird im Frontend-Modal eingegeben und nicht serverseitig gespeichert – für produktiven Einsatz ggf. als Secret/Env-Var hinterlegen und Formular entsprechend anpassen.

## Projektstruktur

```
src/                React-Frontend
  components/       Header, LVEditor, SectionBlock, RowEditor, SevDeskModal
  templates/         Vorlagen-Daten (Büro, Arztpraxis, ...)
server/index.js      Express-Server: liefert dist/ aus + /api/sevdesk Proxy
```
