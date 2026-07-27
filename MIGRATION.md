# Block 9: Migration der bestehenden Daten in das neue Postgres-Modell

Dieses Dokument beschreibt die einmalige Migration der dateibasierten Bestandsdaten
(`DATA_DIR`) in das seit Block 2 bestehende Postgres-Schema, den Ablauf des
vorgeschriebenen Testlaufs gegen eine Kopie sowie die gefundenen Besonderheiten.

## Bestandsaufnahme (Stand 2026-07-27)

Über den bestehenden `/api/backup`-Export (identisch mit dem, was das reguläre
Backup sichert) wurde der komplette Datei-Bestand geprüft:

- **5 echte Dokumente** unter `documents/` (Leistungsverzeichnisse, Freitext-
  Sektionen/Zeilen), verteilt auf **4 Kunden**: Kölner Physio Kollektiv GbR,
  Edith Vossebrecker, ohja events, Simone Adam & Birgit Ziemer GbR. Jeder Kunde
  hat genau ein Objekt (keine Mehrfach-Objekt-Kunden im Bestand).
- **Keine** separaten Dateien unter `crm/customers/`, `crm/objekte/`,
  `crm/mitarbeiter/` - diese Verzeichnisse existieren (noch) nicht. Kunden
  werden im dateibasierten System ausschließlich aus den Dokumenten aggregiert
  (siehe `customerKeyFor()` in `src/lib/crmKeys.js`).
- **8 Einträge unter `crm/auftraege/`** - alle mit `customerKey: "deploy-check"`,
  `titel: "Deploy Check"`, erstellt am 2026-07-25. Das waren Test-Artefakte aus
  einer früheren Block-Verifikation, die nicht aufgeräumt wurden - keine echten
  Aufträge. Vor der Migration über die bestehende API gelöscht (`DELETE
  /api/crm/auftraege/:id`).
- **Zusätzlich gefunden:** 4 Test-Kunden `"... (Block 5)"` in der Postgres-
  Kundentabelle, ebenfalls Rückstände einer früheren Block-Verifikation ohne
  abhängige Daten (keine Dokumente/Verträge/Uploads). Vor der Migration
  entfernt, damit die neue Kundentabelle einen sauberen, ausschließlich aus
  der Migration stammenden Stand hat.

**Fazit Aufträge/Mitarbeiter:** Es gibt aktuell keine echten Bestandsdaten für
"Auftrag" (Job-Status + Kalenderverknüpfung) oder Mitarbeiter zu migrieren. Das
alte Auftrag-Konzept (`customerKey`, `titel`, `documentId`, `status`,
`calendarEventIds`) hat im neuen Schema (Block 2) auch keine 1:1-Entsprechung
(am ehesten verwandt: `Task`, aber ohne Dokumentbezug) - das wird hier bewusst
nicht mitgelöst, da nichts Reales davon abhängt und es außerhalb des in Block 9
beschriebenen Umfangs (Dokumente, Kunden, Objekte) liegt.

## Migrationsskript

`scripts/migrate-legacy-data.js` - nimmt einen `/api/backup`-Export als Quelle
(kein Volume-SSH-Zugriff eingerichtet; das ist exakt der Datenstand, den auch
das reguläre Backup sichert) und schreibt gegen `DATABASE_URL`.

```
DATABASE_URL=... GEMINI_API_KEY=... node scripts/migrate-legacy-data.js \
  --source backup.json [--apply] [--report out.json]
```

Ohne `--apply`: reiner Trockenlauf, nichts wird geschrieben, nur die
Zusammenfassung/der Report.

Ablauf je Kunde:

1. **Customer** anlegen/wiederverwenden - Identifikation über dieselbe Logik
   wie im bestehenden dateibasierten CRM (`customerKeyFor()`): sevDesk-Kontakt-
   ID, falls vorhanden, sonst Name. `sevdeskContactId` wird direkt aus dem
   alten `customer.id`-Feld übernommen - das stellt zugleich die in Block 6
   gebaute sevDesk-Verknüpfung her, ganz ohne die dortige Matching-Heuristik.
2. **Property (Objekt)** je distinktem `objekt`-Adressstring - geparst als
   `"Straße, PLZ Ort"`. Lässt sich der String nicht so parsen (siehe
   "ohja events" unten), wird ersatzweise die Kundenadresse verwendet und der
   Fall in `addressGaps` gemeldet statt etwas zu raten.
3. **ServiceSpec** je alten Dokument, unter dem passenden Objekt.
4. **ServiceSpecItem** je Zeile - aber NUR, wenn alle drei Bedingungen erfüllt
   sind:
   - Gemini liefert eine tatsächlich existierende Katalog-ID (serverseitig
     gegen die echte Liste geprüft - das Modell kann nie eine ID erfinden,
     exakt wie in Block 7),
   - eine tatsächlich existierende Raumbereich-ID (gleiche Prüfung),
   - die Häufigkeit ist eindeutig (genau eines von nachBedarf/wöchentlich/
     monatlich/jährlich, numerisch parsbar).

   Alles andere landet unverändert (Originaltext, Abschnitt, Intervall-
   Rohwert, Bemerkung, ggf. der unverbindliche Modell-Hinweis) im
   "nicht zugeordnet"-Report - nichts wird stillschweigend verworfen oder
   geraten.

Das Skript ruft bewusst **nicht** den bestehenden Block-7-Auslese-Adapter
(`server/lib/extraction/*`) auf - der ist für Bild/PDF-Uploads gebaut und
bleibt unangetastet. Für Text-zu-Katalog-Zuordnung nutzt dieses Skript einen
eigenen, schlanken Prompt, aber dieselbe Grundregel: die Modellantwort wird nie
blind übernommen, sondern gegen die echten IDs validiert.

**Idempotent:** ein erneuter Lauf überspringt bereits migrierte ServiceSpecs
(gleiches Objekt + gleiche Leistungsart + gleiches Stand-Datum) und legt keine
doppelten Kunden/Objekte an. Im Testlauf verifiziert (zweiter Durchlauf gegen
dieselbe Kopie: 0 neue Kunden/Objekte/Specs).

## Testlauf gegen eine Kopie (Auftrag verlangt: vor dem echten Lauf)

Da kein lokaler Docker/Postgres-Server vorhanden war, wurde PostgreSQL 18
(passend zur Server-Version auf Railway) per Homebrew installiert, ein
Produktions-Dump per `pg_dump -Fc` gezogen und in eine lokale Kopie
(`lvtool_trial`) eingespielt. Das Migrationsskript lief gegen diese Kopie,
NICHT gegen die echte Produktionsdatenbank.

Ergebnis (ein repräsentativer Lauf, die Gemini-Zuordnung schwankt leicht
zwischen Läufen):

| | Wert |
|---|---|
| Kunden angelegt | 4 |
| Objekte angelegt | 4 |
| ServiceSpecs angelegt | 3 von 5 (die beiden Glasreinigung-Dokumente ergaben 0 zuordenbare Zeilen, siehe unten) |
| ServiceSpecItems angelegt | ~24-28 von 101 Zeilen (~25 %) |
| Offene Punkte ("nicht zugeordnet") | ~73-77 |
| Adresslücken | 1 (siehe unten) |

Die Zuordnungsquote von rund einem Viertel ist erwartbar und kein Fehler: der
Start-Katalog aus Block 5 hat bewusst nur 11 Einträge ("vollständige
Katalogpflege ist bewusst nicht Teil dieses Blocks", siehe `prisma/seed.js`),
während die echten Bestandsdokumente deutlich reichhaltigeren Freitext
enthalten (z.B. "WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern",
"Nachfüllen von Verbrauchsmaterialien" - für beides gibt es aktuell keinen
passenden Katalogeintrag). Die beiden Glasreinigung-Dokumente ergaben 0
Treffer, weil der Katalog aktuell gar keine Glasreinigungs-Einträge enthält.

### Gefundene Besonderheiten

- **"ohja events"**: Der alte `objekt`-String ist `"ohja events"` statt einer
  Adresse, `customer.street/zip/city` sind ebenfalls leer. Das ist eine Lücke
  in den Ausgangsdaten selbst, keine Migrationsfehler - das Skript legt Kunde
  und Objekt trotzdem an (nichts wird verworfen), aber mit leerer Adresse, und
  meldet den Fall in `addressGaps`. **Muss nach der Migration manuell über die
  UI ergänzt werden.**
- **"Tägl." als Intervall-Wert**: Ein Dokument (Simone Adam & Birgit Ziemer
  GbR) verwendet bei mehreren Zeilen `intervalColumn: "woechentlich"` mit
  `intervalValue: "Tägl."` statt einer Zahl. Das lässt sich nicht sicher in
  eine wöchentliche Häufigkeit umrechnen (täglich könnte 5x, 6x oder 7x pro
  Woche bedeuten, je nach Betriebstagen) - diese Zeilen werden bewusst NICHT
  geraten, sondern landen im "nicht zugeordnet"-Report mit dem Rohwert.
- **Katalog-Granularität**: Mehrere alte Freitext-Zeilen bilden teils dieselbe
  neue Katalog-ID ab (z.B. "WC-Oberflächen...", "Waschbecken, Armaturen &
  Wandspiegel reinigen" und "WC Fliesenwände reinigen" landen alle auf dem
  einen vorhandenen Sanitär-Katalogeintrag). Das ist beabsichtigt - der neue
  Katalog ist gröber als der alte Freitext, exakte Deduplizierung geschieht
  ohnehin erst beim Rendern (Block 8, `groupItems()` in `lvPdf.js`).

### Was nach der Migration manuell zu erledigen ist

Der Report (`--report`-Datei) listet jede nicht automatisch zugeordnete Zeile
mit Kunde/Objekt/Dokument/Abschnitt/Originaltext/Intervall/Bemerkung und, falls
vorhanden, einem unverbindlichen Modell-Hinweis auf Katalog-/Raumbereich-ID.
Diese Zeilen werden über die bestehende, bereits getestete UI
("+ Leistungsverzeichnis erstellen" in `DbObjectDetail`) von Hand ergänzt -
dafür wird keine neue UI gebaut, das ist exakt der Weg, den auch Block 5 für
das manuelle Anlegen von Positionen vorsieht. Zusätzlich: Adresse von
"ohja events" ergänzen, ggf. neue Katalogeinträge für Glasreinigung und
weitere häufig wiederkehrende Freitext-Leistungen anlegen (Katalogpflege ist
eine eigene, laufende Aufgabe außerhalb dieses Blocks).

## Echter Lauf (2026-07-27)

Vor dem echten Lauf gegen die Produktionsdatenbank wurde ein Backup gezogen
(`pg_dump` lokal plus der bestehende `/api/backup/run-now`-Endpunkt). Nach
Freigabe durch den Betreiber lief das Skript mit `--apply` gegen die echte
Produktions-Postgres.

**Unterbrechung durch Gemini-Tageskontingent:** Der kostenlose Gemini-Tarif
ist auf 20 Requests/Tag begrenzt. Durch die vorangegangenen Testläufe (Block
Testlauf gegen eine Kopie) war das Kontingent für den 2026-07-27 bereits
größtenteils aufgebraucht - der echte Lauf schaffte 2 von 5 Dokumenten mit
KI-Zuordnung, bevor ein 429 (Quota exceeded) auftrat. Da das Skript idempotent
ist, ließ sich das ohne Risiko einfach neu starten (bereits Migriertes wird
übersprungen). Auf Wunsch des Betreibers wurde für die verbleibenden 3
Dokumente auf die KI-Zuordnung verzichtet (`--no-match`, neu ergänzter
Skript-Schalter) statt auf das Kontingent des nächsten Tages zu warten - diese
3 Dokumente sind vollständig manuell nachzutragen (siehe unten), Kunde und
Objekt wurden trotzdem angelegt.

**Ergebnis (finaler Stand in der echten Produktionsdatenbank):**

| | Wert |
|---|---|
| Kunden | 4 (alle real, aus den 4 Kunden-Gruppen der 5 Dokumente) |
| Objekte | 4 |
| ServiceSpecs | 1 (Kölner Physio Kollektiv GbR / Unterhaltsreinigung) |
| ServiceSpecItems | 9 |
| Live verifiziert | `/api/db/lv-pdf?specIds=...` liefert ein echtes, 33 KB großes PDF aus den migrierten Daten; `/api/db/customers` listet alle 4 echten Kunden |

### Manuell nachzutragen

Für 4 der 5 Dokumente ist noch keine automatische KI-Zuordnung gelaufen (2
davon - beide "Glasreinigung" - hätten ohnehin 0 Treffer gehabt, da der
Katalog aktuell keine Glasreinigungs-Einträge enthält). Der komplette
Originaltext aller Zeilen (nichts wurde gelöscht, die alten Dokumente bleiben
zusätzlich unverändert unter `DATA_DIR/documents/` bestehen) folgt hier, damit
er ohne Rückgriff auf die alten JSON-Dateien direkt für das manuelle Anlegen
über "+ Leistungsverzeichnis erstellen" in der neuen Objektansicht genutzt
werden kann. Bei "Kölner Physio Kollektiv GbR / Unterhaltsreinigung" sind
bereits 9 der 36 Zeilen als ServiceSpecItems angelegt (Fußleisten, Mobiliar/
Staub, Arbeits- und Schreibtische, Sanitärobjekte in den vier Raumbereichen
Flure und Treppenhäuser/Büros/Sanitär/Küchen und Teeküchen) - beim Abgleich
mit der Liste unten darauf achten, diese nicht doppelt anzulegen.

### Kölner Physio Kollektiv GbR / Glasreinigung (Dokument 73a50881-e239-4162-bb6a-77574fc53d67)

**Glasreinigung**
- Reinigung der Glasflächen innen und außen _(aufAnfrage Ja)_
- Entfernung von Verschmutzungen wie Staub, Fingerabdrücken und Schmierrückständen _(aufAnfrage Ja)_
- Fensterrahmen abwischen _(aufAnfrage Ja)_

### Edith Vossebrecker / Glasreinigung (Dokument 81d4a8b8-ddb9-417b-8540-99a4ae565870)

**Glasreinigung**
- Reinigung der Glasflächen innen und außen _(aufAnfrage Ja)_
- Entfernung von Verschmutzungen wie Staub, Fingerabdrücken und Schmierrückständen _(aufAnfrage Ja)_
- Rahmenreinigung im Zuge der Glasreinigung _(aufAnfrage Ja)_

### Kölner Physio Kollektiv GbR / Unterhaltsreinigung (Dokument a68de81f-8a8d-42b5-9df7-8b1b680d6e58) - teilweise migriert (9/36)

**Empfangs- und Verkehrsbereich**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 1x, Sofern frei zugänglich)_
- Entfernen von Fingerabdrücken & Schlieren von Türen, Türklinken & Einbauschränken _(woechentlich 1x)_
- Feuchte Reinigung der Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Eingangs- und Wartebereich**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 1x, Sofern frei zugänglich)_
- Reinigung der Oberflächen von Arbeits- & Schreibtischen _(woechentlich 1x, Sofern frei zugänglich)_
- Entfernen von Fingerabdrücken & Schlieren von Türen, Türklinken & Einbauschränken _(woechentlich 1x)_
- Feuchte Reinigung der Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Büro- und Behandlungsräume**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 2x, Sofern frei zugänglich)_
- Reinigung der Oberflächen von Arbeits- & Schreibtischen _(woechentlich 2x)_
- Wandspiegel feucht reinigen _(woechentlich 2x)_
- Verschieben und feucht wischen unter den Behandlungsliegen _(monatlich 2x)_
- Feuchte Reinigung der Füße  Behandlungsliegen _(monatlich 2x)_
- Feuchte Reinigung der Fensterbänke & Fußleisten _(monatlich 2x)_
- Entfernen von Fingerabdrücken & Schlieren von Türen, Türklinken & Einbauschränken _(woechentlich 1x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Trainings- und Kampfsportbereiche**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 2x, Sofern frei zugänglich)_
- Feuchte Reinigung der Fußleisten _(monatlich 2x)_
- Entfernen von Fingerabdrücken & Schlieren von Türen, Türklinken, Küchen- & Einbauschränken _(nach Bedarf)_
**Sanitär-, Umkleidebereiche und Duschen**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 3x, Sofern frei zugänglich)_
- Feuchte Reinigung aller Sanitärobjekte (WC, Waschbecken, Armaturen) _(woechentlich 3x)_
- WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern _(woechentlich 3x)_
- Waschbecken, Armaturen & Wandspiegel reinigen _(woechentlich 3x)_
- WC Fliesenwände reinigen _(woechentlich 3x)_
- Vollreinigung der Dusche inkl. Armaturen & Fliesen _(woechentlich 1x)_
- Feuchte Reinigung der Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
- Feuchte Reinigung der Türblätter & Türklinken _(nach Bedarf)_
**Küchenräume**
- Feuchte Reinigung der Oberflächen & Arbeitsplatten _(woechentlich 3x, Sofern frei zugänglich)_
- Entfernen von Fingerabdrücken & Schlieren von Türen, Türklinken, Küchen- & Einbauschränken _(woechentlich 3x)_
- Waschbecken & Armatur reinigen _(woechentlich 3x)_
- Geschirr spülen & in die Schränke/Schubladen einräumen _(woechentlich 2x)_
- Feuchte Reinigung der Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 3x)_

### ohja events / Unterhaltsreinigung (Dokument c3d8cc17-4cd9-4e36-86ea-061d9e4b44f3) - Adresse fehlt, siehe unten

**Flur- und Verkehrsbereich**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 2x)_
- Feuchte Reinigung der Türblätter & Türklinken _(woechentlich 2x)_
- Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken _(woechentlich 2x)_
- Feuchte Reinigung der Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Empfangs- und Wartebereich**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 2x)_
- Reinigung der Oberflächen von Arbeits- & Schreibtischen _(woechentlich 2x)_
- Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken _(woechentlich 2x)_
- Feuchte Reinigung der Fensterbänke & Fußleisten _(monatlich 2x)_
- Feuchte Reinigung der Türblätter & Türklinken _(nach Bedarf)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Büro- und Behandlungsräume**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 2x, Oberflächen und Maschinen im Behandlungs-, Steril- und Laborbereich, auf denen medizinisches Equipment oder Behandlungsmaterialien abgelegt sind, sind von der Reinigung ausgeschlossen.)_
- Reinigung der Oberflächen von Arbeits- & Schreibtischen _(woechentlich 2x)_
- Feuchte Reinigung der Türblätter & Türklinken _(woechentlich 2x)_
- Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken _(woechentlich 2x)_
- Feuchte Reinigung der Fensterbänke & Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Sanitärbereiche und Dusche**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 2x)_
- Feuchte Reinigung aller Sanitärobjekte (WC, Waschbecken, Armaturen) _(woechentlich 2x)_
- WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern _(woechentlich 2x)_
- Waschbecken, Armaturen & Wandspiegel reinigen _(woechentlich 2x)_
- WC Fliesenwände reinigen _(woechentlich 2x)_
- Vollreinigung der Dusche inkl. Armaturen & Fliesen _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Küchenräume**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich 2x)_
- Feuchte Reinigung der Oberflächen & Arbeitsplatten _(woechentlich 2x)_
- Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen, Küchen- & Einbauschränken _(woechentlich 2x)_
- Waschbecken & Armatur reinigen _(woechentlich 2x)_
- Feuchte Reinigung der Fensterbänke _(woechentlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Glasreinigung**
- Reinigung der Glasflächen innen und außen _(aufAnfrage Ja)_
- Entfernung von Verschmutzungen wie Staub, Fingerabdrücken und Schmierrückständen _(aufAnfrage Ja)_
- Rahmenreinigung im Zuge der Glasreinigung _(aufAnfrage Ja)_

### Simone Adam & Birgit Ziemer GbR / Unterhaltsreinigung (Dokument ef703daf-90d3-4515-ad91-acecaf05bce7) - viele "Tägl."-Werte, siehe unten

**Flur- und Verkehrsbereich**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich Tägl.)_
- Feuchte Reinigung der Türblätter & Türklinken _(woechentlich Tägl.)_
- Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken _(woechentlich Tägl.)_
- Feuchte Reinigung der Fußleisten _(woechentlich Tägl.)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Empfangs- und Wartebereich**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich Tägl.)_
- Reinigung der Oberflächen von Ablagen & Schrankoberflächen _(woechentlich Tägl.)_
- Feuchte Reinigung der Türblätter & Türklinken _(woechentlich Tägl.)_
- Feuchte Reinigung der Fensterbänke & Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Büro- und Behandlungsräume**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich Tägl.)_
- Reinigung der Oberflächen von Arbeits- & Schreibtischen _(woechentlich Tägl.)_
- Feuchte Reinigung der Türblätter & Türklinken _(woechentlich 2x)_
- Feuchte Reinigung der Fensterbänke & Fußleisten _(monatlich 2x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Sanitär-, Umkleidebereich und Dusche**
- Hartböden feucht wischen & Textilbeläge saugen _(woechentlich Tägl.)_
- Feuchte Reinigung aller Sanitärobjekte (WC, Waschbecken, Armaturen) _(woechentlich Tägl.)_
- WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern _(woechentlich Tägl.)_
- Waschbecken, Armaturen & Wandspiegel reinigen _(woechentlich Tägl.)_
- WC Fliesenwände reinigen _(woechentlich Tägl.)_
- Nachfüllen von Verbrauchsmaterialien _(woechentlich Tägl., Toilettenpapier, Seife und Desinfektionsmittel werden ohne zusätzliche Kosten dem Kunden in Rechnung gestellt)_
- Vollreinigung der Dusche inkl. Armaturen & Fliesen _(woechentlich Tägl.)_
- Feuchte Reinigung der Kleiderhacken in der Umkleide _(woechentlich 1x)_
- Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken _(nach Bedarf)_
**Schwimmbad**
- Wechselnde chemische Bodenreinigung mit Alkalische- & Säurehaltigemittel _(woechentlich Tägl., Reinigungsmittel werden vom Kunden gestellt)_
- Chemische Desinfektion des Bodens _(woechentlich Tägl., Desinfektionsmittel werden vom Kunden gestellt)_

### Zusätzlich zu klären

- **ohja events**: Objektadresse fehlt komplett in den Ausgangsdaten (weder
  `objekt`-Feld noch Kundenadresse enthalten eine echte Anschrift) - vor dem
  ersten echten Angebot/Vertrag über die UI ergänzen.
- **Simone Adam & Birgit Ziemer GbR**: Die vielen "Tägl."-Intervallwerte
  bedeuten vermutlich täglich beim Schwimmbad-Betrieb - das muss der Betreiber
  festlegen (z.B. 6x oder 7x wöchentlich), das Skript hat hier bewusst nicht
  geraten.
- **Katalog**: Für Glasreinigung existiert aktuell kein einziger
  Katalogeintrag - beide Glasreinigungs-Dokumente sind dadurch komplett
  manuell nachzutragen, nachdem passende Katalogeinträge angelegt wurden.
