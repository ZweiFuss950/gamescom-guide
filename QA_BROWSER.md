# Mobiler Browser- und Offline-Test

Prüfdatum: **23. August 2026**  
App-Version: **3.1.1**  
Ergebnis: **15 von 15 Prüfgruppen bestanden**

## Testumgebung

| Eigenschaft | Wert |
|---|---|
| Browser-Engine | Chromium |
| Automatisierung | Playwright |
| Viewport | 390 × 844 Pixel |
| Sprache | de-DE |
| Zeitzone | Europe/Berlin |
| Testkoordinaten | 50.9469, 6.9833 |
| Speicher | neues temporäres Browserprofil |
| Testobjekt | exakt entpacktes Deploy-ZIP |
| URL-Struktur | Projekt-Unterpfad `/gamescom-guide-2026-v3-1-1-verify/deploy/` |
| Offline-Test | Browser geschlossen, mit demselben Profil neu gestartet, Netzwerk deaktiviert |

## Bestandene Prüfgruppen

1. App lädt mit Version 3.1.1 und 23 redaktionellen Einträgen.
2. Landingpage ist mobil, weiß und ohne horizontalen Seiten-Overflow.
3. Die iOS-Installationshilfe ist auch ohne Chromium-Installationsprompt erreichbar.
4. Direkte Hallenwahl und einklappbare Detailinformationen funktionieren.
5. Favoritenmarker, Fokusmodus und Tastaturbedienung der Karte funktionieren.
6. Der manuelle Indoor-Standort-Fallback funktioniert.
7. Eigene Einträge erscheinen lokal, als Favorit und auf der Karte.
8. Notizblock, Bearbeiten und JSON-Export funktionieren.
9. Favoriten, aktuelle Halle und Notizen bleiben nach Reload erhalten.
10. Der Live-Zeitplan erkennt laufende Termine und hält Talks kompakt.
11. Der Deep-Link vom Zeitplan zur fokussierten Kartenposition funktioniert.
12. Der Favoriten-Tab gruppiert Inhalte und bietet die relevanten Aktionen.
13. Freitextsuche, Trefferzähler und Ein-Klick-Reset funktionieren.
14. Der Service Worker kontrolliert die App und cached die vollständige App-Shell.
15. Die App startet nach echtem Browser-Neustart offline mit Karte, Daten, Favoriten und Notizen.

## Smartphone-Screenshots

- [`assets/qa/mobile-home-v3.png`](./assets/qa/mobile-home-v3.png) – Landingpage und Hallenüberblick
- [`assets/qa/mobile-halls-h7-v3.png`](./assets/qa/mobile-halls-h7-v3.png) – direkte Hallenwahl H7
- [`assets/qa/mobile-map-favorites-v3.png`](./assets/qa/mobile-map-favorites-v3.png) – hervorgehobene Favoritenmarker
- [`assets/qa/mobile-map-own-note-v3.png`](./assets/qa/mobile-map-own-note-v3.png) – lokaler eigener Fund auf der Karte
- [`assets/qa/mobile-schedule-live-v3.png`](./assets/qa/mobile-schedule-live-v3.png) – laufender und nächster Termin
- [`assets/qa/mobile-favorites-v3.png`](./assets/qa/mobile-favorites-v3.png) – persönlicher Fahrplan
- [`assets/qa/mobile-offline-restart-v3.png`](./assets/qa/mobile-offline-restart-v3.png) – App nach Offline-Neustart

## Reproduzieren

Bei lokal laufendem Server:

```bash
python3 -m http.server 8766 --directory /mnt/data
GC26_BASE_URL=http://127.0.0.1:8766/gamescom-guide-2026-v3-1-1-verify/deploy/ python3 tests/browser_qa.py
```

Das ausführbare Testergebnis wird nach jedem Lauf nach [`data/browser-qa.json`](./data/browser-qa.json) geschrieben. Testexporte und temporäre Browserprofile werden automatisch entfernt.
