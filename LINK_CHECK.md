# Linkcheck

Prüfdatum: **23. August 2026**

## Ergebnis

- **25** eindeutige externe Ziel-URLs im Datenbestand
- **24** aktuelle Portale, Eventseiten, offizielle Websites oder Medienartikel erfolgreich erreichbar beziehungsweise als JavaScript-Seite erreichbar
- **1** optionaler, vom Nutzer genannter Instagram-Link; nicht als Beleg verwendet und gegebenenfalls login-/plattformabhängig
- **0** bekannte 404-Ziele im ausgelieferten Datenbestand
- keine früheren, inzwischen ungültigen Gamescom-Besucher-Deep-Links mehr enthalten

## Gamescom-Links

Alle Gamescom-Ziele führen jetzt in eine der drei aktuell erreichbaren Strukturen:

1. aktuelles Aussteller- und Produktverzeichnis 2026
2. aktueller Hallenplan 2026
3. aktuelles gamescom-congress-Programm

Da direkte Ausstellerprofile intern dynamische Routen verwenden, verlinkt die App robust auf das aktuelle Verzeichnis und zeigt bei jedem Eintrag den exakten Suchbegriff an. Dadurch bleibt die Navigation auch bei internen Änderungen der Gamescom-Website nutzbar.

## Inhaltliche Gegenprüfung

Aktuelle 2026-Line-ups werden nur dort als solche dargestellt, wo die verlinkte Quelle sie konkret nennt – etwa bei Xbox, Nintendo, Bandai Namco, Level Infinite, NetEase und GIANTS Software. Bei Ubisoft, HoYoverse, SEGA und Capcom wird ein bestätigter Stand nicht mit einem erfundenen vollständigen Line-up vermischt.

Der maschinenlesbare Einzelstatus steht in [`data/link-audit.json`](./data/link-audit.json).
