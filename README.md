# GC26 Guide – Gamescom 2026 für Donnerstag und Freitag

**Finale geprüfte Version: 3.1.2 · Datenstand 23. August 2026**

Ein statischer, mobile-first Gamescom-Guide für **Donnerstag, 27. August 2026**, und **Freitag, 28. August 2026** in der Koelnmesse. Die App läuft ohne Framework und Build-Step auf GitHub Pages und kann nach einem vollständigen Online-Aufruf weitgehend offline genutzt werden.

## Enthalten

- Startseite mit Hallenüberblick und drei sinnvollen Routen
- vereinfachte Offline-Karte mit Favoritenmarkern, grober Geolocation und manueller Hallenauswahl
- direkte Hallen-Schnellwahl für H5, H6, H7, H8, H9, H10 und Confex
- kombinierbare Filter, Suche, Trefferzähler und Reset
- kompakter Live-Zeitplan nur für Donnerstag und Freitag
- tab-übergreifende Favoriten in `localStorage`
- lokaler Notizblock für eigene Funde und Termine, inklusive JSON-Export und -Import
- PWA-Manifest, Apple-Meta-Tags, Icons und versionierter Service Worker
- ausschließlich lokale Illustrationen, damit keine fremden Bilder für den Offline-Start benötigt werden

## Direkt auf GitHub Pages veröffentlichen

1. Den **Inhalt dieses Ordners** in den Root eines GitHub-Repositories hochladen. `index.html` muss direkt im Repo-Root liegen.
2. In GitHub unter **Settings → Pages** als Quelle den gewünschten Branch und den Ordner `/ (root)` wählen.
3. Die veröffentlichte URL einmal vollständig online öffnen.
4. Auf dem iPhone in Safari **Teilen → Zum Home-Bildschirm** wählen.
5. Vor der Messe einmal im Flugmodus öffnen und Karte, Hallen, Zeitplan und Favoriten prüfen.

Alle internen Pfade sind relativ (`./…`). Dadurch funktioniert das Projekt auch unter einer typischen Projekt-URL wie `https://username.github.io/repo-name/`.

## Inhalte aktualisieren

Die redaktionellen Daten liegen in [`data/data.json`](./data/data.json). Jeder Eintrag besitzt unter anderem:

```json
{
  "id": "xbox",
  "name": "Xbox: 25 Spiele, 140 Stationen",
  "typ": "exhibitor",
  "kategorien": ["big-player", "goodies"],
  "halle": "7.1",
  "stand": "A061–C060",
  "kartenposition": { "x": 50, "y": 29 },
  "beschreibung": "…",
  "bildUrl": "./assets/illustrations/xbox.svg",
  "gamescomLink": "https://exhibitors.gamescom.global/en/gamescom-exhibitors/list-of-exhibitors/",
  "officialSearchTerm": "Microsoft / Xbox",
  "externeLinks": [{ "label": "…", "url": "https://…", "type": "official" }],
  "tage": ["2026-08-27", "2026-08-28"],
  "goodie": true,
  "highlight": true,
  "andrangTipp": "…"
}
```

Das offizielle Gamescom-Ausstellerportal arbeitet dynamisch. Deshalb führen die robusten Gamescom-Links zum **aktuellen 2026-Portal**; direkt darunter zeigt die App den exakten Suchbegriff des Eintrags an. So bleibt der Link nutzbar, selbst wenn Gamescom intern Profilpfade ändert.

### Nach einem Daten- oder Code-Update

In [`sw.js`](./sw.js) den Wert von `CACHE_VERSION` erhöhen, zum Beispiel von:

```js
const CACHE_VERSION = 'gc26-guide-v3-1-20260823-3';
```

auf:

```js
const CACHE_VERSION = 'gc26-guide-v3-1-20260823-4';
```

Beim nächsten Online-Aufruf installiert der Browser den neuen Cache und entfernt ältere App-Caches.

## Offline-Nutzung und iOS

Der Service Worker cached beim ersten Online-Aufruf HTML, CSS, JavaScript, `data.json`, Icons, Karte und Illustrationen. Danach funktionieren App-Start, Filter, Karte, Favoriten, Zeitplan und eigene Notizen offline. **Externe Quellen-Websites** benötigen weiterhin Internet.

Safari behandelt eine zum Home-Bildschirm hinzugefügte Web-App in einem eigenen Speicherbereich. iOS kann den Cache nach längerer Nichtnutzung oder bei knappem Speicher aufräumen. Deshalb die installierte App kurz vor der Gamescom noch einmal online öffnen und danach im Flugmodus testen.

Favoriten und eigene Notizen liegen nur im `localStorage` dieses Browsers. Der Button **Plan sichern** beziehungsweise **Export** erzeugt eine JSON-Sicherung; über **Import** lässt sie sich später wieder einlesen.

## Quellenstatus

- [`SOURCES.md`](./SOURCES.md): Quellen pro Eintrag
- [`DATA_STATUS.md`](./DATA_STATUS.md): Umgang mit bestätigten, teilweise bestätigten und nicht bestätigten Themen
- [`data/link-audit.json`](./data/link-audit.json): technischer Prüfstand aller 25 eindeutigen Ziel-URLs
- [`LINK_CHECK.md`](./LINK_CHECK.md): lesbare Zusammenfassung des Linkchecks
- [`QA_REPORT.md`](./QA_REPORT.md): Abschlussprüfung
- [`QA_BROWSER.md`](./QA_BROWSER.md): mobiler Browser- und Offline-Test
- [`CHANGELOG.md`](./CHANGELOG.md): Änderungen der überarbeiteten Fassung

Die App trennt bewusst zwischen bestätigter Vor-Ort-Präsenz, noch offenem Detailprogramm und parallelen Online-Ereignissen. Das betrifft insbesondere PlayStation, Xbox × IKEA, BIG-N-Club und GTA VI.

## Lokale Tests

```bash
python3 -m http.server 8765
python3 tests/validate_repo.py
python3 tests/browser_qa.py
```

Der Browser-Test verwendet Playwright und Chromium. Die statische Prüfung validiert zusätzlich jede lokale SVG-Datei als XML; der Browser-Test lädt alle referenzierten Illustrationen als echte Bilder. Die fertigen Prüfberichte und Smartphone-Screenshots liegen in `QA_REPORT.md`, `data/browser-qa.json` und `assets/qa/`.

## Datenschutz

Die App enthält keine Analytics, keine Konten, keine externen Fonts und keinen Server-Upload. Browser-Geolocation wird erst nach einer bewussten Aktion angefragt. Notizen und Favoriten bleiben lokal.
