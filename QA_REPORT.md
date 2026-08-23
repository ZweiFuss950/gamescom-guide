# Abschlussprüfung – GC26 Guide 3.1.1

Prüfdatum: **23. August 2026**  
Datenversion: **2026-08-23.5**  
Ergebnis: **bestanden**

## Zusammenfassung

Die Anwendung wurde als statisches GitHub-Pages-Projekt, mobile Web-App und offline startfähige PWA geprüft. Der finale Datenbestand enthält **23 redaktionelle Einträge** und **25 eindeutige externe Ziel-URLs**.

- statische Struktur- und Datenprüfung: **10 von 10 Prüfgruppen bestanden**
- mobiler Browser- und Interaktionstest: **15 von 15 Prüfgruppen bestanden**
- Offline-Neustart mit demselben Browserprofil und vollständig deaktiviertem Netzwerk: **bestanden**
- bekannte 404-Ziele im ausgelieferten Datenbestand: **0**
- Smartphone-Testbreite: **390 × 844 Pixel**
- vollständiger Browser- und Offline-Test unter einem GitHub-Pages-typischen Projekt-Unterpfad: **bestanden**

## Statische Prüfung

Ausgeführt mit:

```bash
python3 tests/validate_repo.py
node --check js/app.js
```

Geprüft wurden:

1. vollständige Pflichtdateien und Ordnerstruktur
2. gültiges JSON und Schema
3. Big Player, Nintendo, Indie, Retro, Community und Reality-Checks
4. Pflichtlinks, Bilder, Besuchstage und Kartenpositionen jedes Eintrags
5. der vorgegebene Spielwissenschafts-Talk mit Datum, Zeit und Stage D
6. vollständige Abdeckung aller Ziel-URLs im Link-Audit
7. Manifest, Apple-Touch-Icon und PWA-Icons
8. vollständige App-Shell im Service Worker
9. iOS-Meta-Tags und Ausschluss der früheren fehlerhaften Gamescom-URL-Struktur
10. ausschließlich relative interne Pfade für GitHub-Pages-Unterverzeichnisse

Maschinenlesbares Ergebnis: [`data/static-validation.json`](./data/static-validation.json)

## Browser- und Offline-Prüfung

Der automatisierte Test verwendet Chromium über Playwright, eine mobile Viewportgröße von 390 × 844 Pixel, die Zeitzone `Europe/Berlin` und einen vollständig neuen Browser-Speicherbereich. Der finale Lauf wurde gegen die **exakt wieder entpackten Bytes des Deploy-ZIPs** unter `http://127.0.0.1:8766/gamescom-guide-2026-v3-1-1-verify/deploy/` ausgeführt – also unter demselben Unterpfad-Prinzip wie ein GitHub-Pages-Projektrepository.

Abgedeckt sind unter anderem:

- Landingpage, Hallenüberblick und weißes Layout ohne horizontalen Seiten-Overflow
- direkte Hallenwahl H5 bis H10 und Confex
- einklappbare Detailbereiche
- Favoriten, hervorgehobene Kartenmarker und Favoriten-Fokusmodus
- Tastaturbedienung der SVG-Marker
- manuelle Hallenwahl als Indoor-GPS-Fallback
- eigener lokaler Eintrag mit Halle, Stand, Tag, Uhrzeit und Notiz
- Bearbeiten, Löschen sowie JSON-Export des persönlichen Plans
- Persistenz nach Reload
- echtzeitabhängige Anzeige „Läuft gerade“ und „Als Nächstes“
- Deep-Link vom Zeitplan zur Karte
- gemeinsamer Filterzustand, Freitextsuche, Trefferzähler und Reset
- Service-Worker-Kontrolle und vollständiger App-Shell-Cache
- erneuter App-Start nach komplettem Browser-Neustart ohne Netzwerk

Maschinenlesbares Ergebnis: [`data/browser-qa.json`](./data/browser-qa.json)  
Ausführlicher Bericht: [`QA_BROWSER.md`](./QA_BROWSER.md)

## Korrigierter Offline-Randfall

Bei einem abschließenden Wiederholungstest zeigte sich nach einem kalten Offline-Start ein zeitlicher Zwischenzustand, in dem die Kartendaten bereits geladen waren, der Hash-Wechsel zur Kartenansicht aber noch auf das nächste Browserereignis wartete. Die Navigation rendert die Zielansicht jetzt sofort und zusätzlich beim regulären `hashchange`. Der Offline-Test wartet außerdem explizit auf die Marker-Darstellung. Der vollständige Testlauf wurde danach erneut erfolgreich ausgeführt.

## Quellen- und Linkprüfung

Die alten Links nach dem Muster `/en/gamescom/for-visitors/...` sind vollständig entfernt. Die offiziellen Gamescom-Ziele beschränken sich auf:

- das aktuelle Aussteller- und Produktverzeichnis 2026
- den aktuellen Hallenplan 2026
- das aktuelle gamescom-congress-Programm

Bei dynamischen Ausstellerprofilen führt der robuste Link zum aktuellen Portal; die App zeigt direkt darunter den genauen Suchbegriff und den ermittelten Stand. Aktuelle 2026-Line-ups werden nur dort behauptet, wo eine passende Hersteller- oder Veranstalterquelle vorliegt.

Einzelheiten: [`LINK_CHECK.md`](./LINK_CHECK.md), [`SOURCES.md`](./SOURCES.md) und [`data/link-audit.json`](./data/link-audit.json)

## Ehrliche Grenzen

- Externe Quellen-Websites sind offline nicht verfügbar; die eigentliche App bleibt nutzbar.
- Indoor-GPS kann in den Hallen deutlich abweichen. Deshalb ist die manuelle Hallenwahl die empfohlene Orientierung.
- Ausstellerprogramme, Goodies und Bühnenzeiten können sich kurzfristig ändern. Der sichtbare Bestätigungsstatus macht diese Unsicherheit kenntlich.
- Die vereinfachte Karte ist eine mobile Orientierungshilfe und kein Ersatz für Flucht-, Sicherheits- oder Barrierefreiheitspläne der Koelnmesse.
