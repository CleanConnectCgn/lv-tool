# Learnings aus 142 echten Leistungsverzeichnissen

Stand: 22.09.2026. Grundlage: alle auffindbaren LV-PDFs auf dem Laptop
(142 Dateien: 121 aus der Numbers-Zeit, 21 aus dem laufenden Tool),
abgeglichen gegen den aktuellen Code (`CleanConnectCgn/lv-tool`, HEAD a5311a8).

Reine Bestandsaufnahme plus daraus abgeleitete Checkliste. Keine Codeänderung.

---

## Teil A — Was die echten LVs über das Tool verraten

### A1. Das Tool schreibt „desinfizierend", du schreibst es wieder raus

Der Bereichskatalog (`src/templates/checklistAreas.js`) erzeugt **19 Zeilen**
mit „desinfizieren/desinfizierend". In den 21 LVs, die tatsächlich aus dem Tool
herausgegangen sind, steht das Wort noch **4 mal** — über alle 142 LVs hinweg
nur **5 mal**.

Nachweisbar am Verlauf eines einzigen Objekts (Herthastraße 6, 22.09.):

| Fassung | Uhrzeit | „desinfizier" |
|---|---|---|
| v1 | 09:17 | 1 |
| v4 | 16:07 | 0 |

Das Wort wird also bei praktisch jedem LV von Hand wieder entfernt. Es steht
an 19 Stellen im Katalog, an 6 in `inspectionTasks.js` und an 5 in
`suggestions.js`.

**Bewertung:** Das ist keine Formulierungsfrage, sondern eine Haftungsfrage.
„Desinfizieren" ist eine zugesicherte Wirkung (Flächendesinfektion nach
Einwirkzeit, dokumentationspflichtig in Praxen). In einer Unterhaltsreinigung
willst du das nicht zusichern. Der Katalog verspricht es aktuell standardmäßig.

### A2. Du hast einen neuen LV-Stil entwickelt, den der Katalog nicht kennt

Vergleich erste gegen letzte Fassung Herthastraße 6:

```
vorher (Katalog):  Hartböden feucht wischen & Textilbeläge saugen        2x
nachher (deine     Hartböden feucht wischen                              2x
Handarbeit):       + Bemerkung: „Feuchte Reinigung der Hartbodenflächen
                     in den Flur- und Verkehrsbereichen einschließlich
                     Entfernung von Schmutz, Staub und sonstigen
                     oberflächlichen Verunreinigungen."
```

Das Muster ist durchgehend: **kurze Leistungsbezeichnung in Spalte 1,
ausformulierte, vertragsfeste Leistungsbeschreibung in der Bemerkungsspalte.**
Es zieht sich durch alle aktuellen LVs (Rhöndorfer Str. 8, Herthastraße 6).

Der Katalog liefert nur die Kurzform. Den Langtext tippst du jedes Mal neu —
und zwar in beiden Objekten am selben Tag nahezu wortgleich.

### A3. Für Wohnanlagen/Hausverwaltung hat das Tool praktisch nichts

Bereiche, die du in den letzten LVs von Hand angelegt hast und die es im
Katalog **nicht** gibt:

- Flur- und Eingangsbereich (Katalog kennt nur „Flur- und Verkehrsbereich")
- Treppenhaus und Stufen / Treppengeländer & Handläufe
- Keller und Waschraum
- Hausmeisterservice mit 5 Positionen: Tonnenservice, Kontrollgang
  Allgemeinbereiche, Kontrolle Sperrmüllraum, Kontrolle Flucht- und
  Verkehrswege, Entrümpelung
- Aufzug als eigene Position
- Schmutzfang an der Hauseingangstür, Briefkasten- & Klingelanlage,
  Zwischentüren

Im Tool erzeugt der Haken „Hausmeisterservice" **genau eine Zeile**:
„Allgemeine Hausmeistertätigkeiten nach Absprache". Du hast daraus von Hand
fünf ausformulierte Positionen gemacht — zweimal, für zwei Objekte.

Über alle 142 LVs kommt „Sanitärräume" 101 mal als Bereichsüberschrift vor,
„Küchendienst" 44 mal, „Keller und Waschraum" 9 mal, „Hausmeisterservice"
9 mal. Der Katalog hat 10 Bereiche und 80 Zeilen; die Praxis nutzt über
**400 verschiedene Leistungsformulierungen**.

### A4. Die Bemerkungsspalte ist für deinen Stil zu schmal

`src/lib/lvPdfExport.js`, Zeile 28:

```js
const COL_W = { desc: 56, check: 22, woe: 24, mon: 22, jah: 20, bem: 42 };
```

42 mm bei 8 pt fassen rund 22 Zeichen pro Zeile. Deine Beschreibungstexte sind
150–250 Zeichen lang → 8 bis 12 Zeilen Zeilenhöhe pro Position. Gleichzeitig
gehen 88 mm (47 % der Seitenbreite) an vier Spalten, die nur Häkchen und
Pillen enthalten, und die Beschreibungsspalte mit 56 mm bleibt halb leer.

Folge: Rhöndorfer Str. 8 braucht 3 Seiten für das, was in 2 passen würde.

### A5. Der PDF-Renderer bricht Wörter mitten im Wort

Im ausgelieferten PDF steht wörtlich:

- „Sper rmüll-/Entrümpelungsraum"
- „Kontrolle des Sperrmüll-/Entr ümpelungsraums"

`overflow: 'linebreak'` in autoTable bricht lange zusammengesetzte Wörter hart
um, ohne Trennstrich. Das geht so an Kunden raus.

### A6. Der Auto-Checkup feuert bei jedem Tippen einen Claude-Call ab

`src/App.jsx`, Zeile ~330:

```js
useEffect(() => {
  const timer = setTimeout(() => { runAICheck(); }, 3000);
  return () => clearTimeout(timer);
}, [sections]);
```

Drei Sekunden nach jeder Änderung an `sections` geht ein kompletter
Claude-Sonnet-Request raus — auch beim ersten Laden mit leerem LV. Bei einem
LV, an dem du eine Stunde arbeitest, sind das leicht 50+ Requests, die fast
alle niemand liest. Der Endpoint `/api/ai-check` hat außerdem keinen Timeout
(anders als `/api/checkup/*`).

### A7. Sechs Exporte für ein LV

| Objekt | Exporte | Zeitraum |
|---|---|---|
| Hansaring 92 (Glas) | 7 | 21.–22.09. |
| Herthastraße 6 | 5 | 09:17–16:07 am 22.09. |
| Rhöndorfer Str. 8 | 4 | 16:10–16:32 am 22.09. |
| Kerpstraße 44 | 2 | 20:23–20:24 am 22.09. |

Jeder Export landet als neue Datei in `~/Downloads` („… (4).pdf"). Es gibt
keine Versionsansicht, kein „das ist die aktuelle Fassung", kein Diff.

### A8. Kleinere, konkrete Fehler

- Tippfehler im ausgelieferten PDF: „inkl. Ausstausch der Beutel"
  (Kerpstraße 44, zweimal auf Seite 2). Kommt nicht aus dem Katalog, also
  von Hand eingetippt — und der KI-Checkup hat ihn nicht gemeldet.
- Dateiname `Leistungsverzeichnis__Rhöndorfer_Str_8_…` mit doppeltem
  Unterstrich: der LV-Titel war leer. Im PDF steht dann nur
  „Leistungsverzeichnis" ohne Leistungsart.
- Frequenzverteilung über alle LVs: 1x (625), 2x (560), **5x (216)**, 3x (115),
  4x (61), 6x (27), 7x (24). 5x wöchentlich ist dein dritthäufigster Fall,
  im QuickSetup steht die Frequenz aber auf „2x" vorbelegt.

---

## Teil B — Checkliste

Reihenfolge nach Wirkung pro Aufwand. `[ ]` offen, `[x]` erledigt.

### Block 1 — Sprache und Katalog (der größte Zeitfresser)

- [ ] 1.1 „desinfizieren/desinfizierend" aus `checklistAreas.js`,
  `inspectionTasks.js`, `suggestions.js` entfernen und durch die
  Formulierungen ersetzen, die du tatsächlich benutzt
  („feuchte Reinigung …", „… mit Hygienereiniger")
- [ ] 1.2 Optionaler Schalter „Hygieneanforderung" im QuickSetup: nur wenn
  gesetzt (Praxis, Kita), kommen desinfizierende Positionen überhaupt ins LV
- [ ] 1.3 Zweistufiger Katalog: jede Katalogzeile bekommt neben dem Kurztext
  eine feste, ausformulierte `beschreibung` (= dein neuer Stil, siehe A2).
  Quelle: die Langtexte aus Rhöndorfer/Herthastraße
- [ ] 1.4 Umschalter im Editor: „Kurzform" ↔ „Ausformuliert" für das ganze LV,
  statt jede Bemerkung einzeln zu tippen

### Block 2 — Fehlende Bereiche und Vorlagen

- [ ] 2.1 Neuer Objekttyp „Wohnanlage / WEG" mit den Bereichen aus A3
- [ ] 2.2 Hausmeisterservice von 1 auf die 5 echten Positionen erweitern
- [ ] 2.3 Bereiche ergänzen: Treppenhaus und Stufen, Keller und Waschraum,
  Aufzug, Eingangsbereich, Umkleide, Ladenlokal
- [ ] 2.4 QuickSetup: Objekttyp wählen (Büro / Praxis / Wohnanlage /
  Gewerbe / Einzelleistung) → Bereiche und Frequenz sind sinnvoll vorbelegt

### Block 3 — Gemini-Checkup (dein Kernwunsch)

- [ ] 3.1 `/api/ai-check` auf Gemini umstellen (Flash, günstig und schnell),
  Claude bleibt für den tiefen Dual-Checkup
- [ ] 3.2 Prüfregeln neu schreiben, an deinen echten Fehlern ausgerichtet:
  - echte Duplikate im selben Bereich (bewusste Wiederholung über
    verschiedene Bereiche hinweg wird **nicht** gemeldet)
  - Tippfehler („Ausstausch")
  - „desinfizieren" als eigene Kategorie mit Ein-Klick-Ersatz
  - Intervall-Widersprüche
  - fehlender/unvollständiger LV-Titel
- [ ] 3.3 Auto-Check entschärfen: nicht bei jedem Tastendruck, sondern beim
  Öffnen des Checkup-Fensters, vor dem PDF-Export und vor dem sevDesk-Versand
- [ ] 3.4 Timeout und Fehlertexte für `/api/ai-check` wie bei `/checkup/*`

### Block 4 — Empfehlungen aus deinen eigenen Daten

- [ ] 4.1 Aus den 142 LVs die tatsächlich benutzten Leistungen und
  Bemerkungen als Datensatz extrahieren
- [ ] 4.2 „Fehlt hier was?" im Editor: zeigt pro Bereich die Leistungen an,
  die du bei vergleichbaren Objekten fast immer drin hattest
- [ ] 4.3 Bemerkungs-Bausteine als Auswahl statt Freitext
  („Wird immer am ersten Reinigungstag der Woche gereinigt.",
  „Verbrauchsmaterial wird vom Auftragnehmer gestellt." …)
- [ ] 4.4 Autovervollständigung von 64 auf die echten ~400 Formulierungen
  erweitern, nach Häufigkeit sortiert

### Block 5 — PDF und Layout

- [ ] 5.1 Spaltenbreiten an den ausformulierten Stil anpassen
  (Beschreibung breiter, Intervallspalten schmaler)
- [ ] 5.2 Worttrennung reparieren („Sper rmüll")
- [ ] 5.3 LV-Titel darf nicht leer sein (Pflichtfeld oder Ableitung aus
  Leistungsart)
- [ ] 5.4 Dateiname ohne doppelte Unterstriche

### Block 6 — Angebot

- [ ] 6.1 Angebotstexte als Vorlagen je Objekttyp statt generisch
- [ ] 6.2 Preisvorschlag aus vergleichbaren, bereits versendeten Angeboten
- [ ] 6.3 Angebotsvorschau vor dem sevDesk-Versand

### Block 7 — Diktat / Chat (größter Brocken, zuletzt)

- [ ] 7.1 Besichtigung einsprechen: „Erdgeschoss, drei Büros, ein Bad,
  Küche, zweimal die Woche" → Gemini baut daraus den QuickSetup-Vorschlag
- [ ] 7.2 Chat-Leiste im Editor: „mach Sanitär auf 3x", „nimm den Aufzug raus"
- [ ] 7.3 Jede KI-Änderung erst als Vorschlag mit Bestätigung, nie direkt
  ins Dokument

---

## Offene Punkte, die eine Entscheidung brauchen

1. **Arbeitsstand:** `~/lv-tool` ist ein veralteter Clone eines anderen Repos
   (`muecreates/lv-tool`, Stand Juli). Das echte Tool liegt jetzt in
   `~/lv-tool-cc` (`CleanConnectCgn/lv-tool`). Der alte Ordner sollte weg oder
   umbenannt werden, sonst wird darin weitergearbeitet.
2. **Deploy:** Läuft über `railway up`, kein GitHub-Autodeploy. Änderungen sind
   erst nach einem Deploy live.
3. **„desinfizieren":** ganz raus, oder nur hinter dem Hygiene-Schalter?
