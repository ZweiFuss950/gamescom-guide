# Paketprüfung

Prüfdatum: **23. August 2026**

## Auslieferungen

- **Komplettes Repo:** Anwendung, Daten, lokale Assets, Dokumentation, Tests, QA-Ergebnisse und Smartphone-Screenshots
- **Deploy-Paket:** direkt veröffentlichbare Anwendung ohne Testskripte und QA-Screenshots
- **TAR.GZ:** vollständige Alternative zum ZIP-Format
- **Teilarchive:** App/Code/Daten, Assets sowie Dokumentation/Tests getrennt für robuste Downloads

## Umfang

Das vollständige Repo enthält **47 Dateien** vor der Archivierung.

## Paketkriterien

- `index.html` liegt direkt im Archiv-Root.
- Es gibt keinen zusätzlichen übergeordneten Projektordner im Archiv.
- Alle Pfade sind relativ und für GitHub-Pages-Projekt-Unterpfade geeignet.
- Es sind keine symbolischen Links, temporären Testexporte, Python-Caches oder Betriebssystem-Metadaten enthalten.
- Das vollständige ZIP wird mit `unzip -t` geprüft.
- Das TAR.GZ wird vollständig aufgelistet und testweise extrahiert.
- Das Deploy-ZIP wird in einen leeren Ordner extrahiert und dort erneut mit der statischen Prüfung validiert.
- Das exakt entpackte Deploy-ZIP wird anschließend unter einem Projekt-Unterpfad im mobilen Browser geprüft, einschließlich Service Worker und Offline-Neustart.
- SHA-256-Prüfsummen werden außerhalb des Repo-Verzeichnisses in einer separaten Datei ausgeliefert.

Die konkreten Archivgrößen und Prüfsummen stehen in `gamescom-2026-guide-v3-checksums.txt` neben den Downloads.
