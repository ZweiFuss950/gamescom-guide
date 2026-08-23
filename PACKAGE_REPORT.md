# Paketprüfung – Version 3.1.2

Prüfdatum: **23. August 2026**

## Auslieferungen

- **Deploy-ZIP:** direkt veröffentlichbare Anwendung mit `index.html` im Archiv-Root
- **Komplettes Repo-ZIP:** Anwendung, Daten, lokale Assets, Dokumentation, Tests, QA-Ergebnisse und Smartphone-Screenshots
- **Komplettes TAR.GZ:** vollständige Alternative zum ZIP-Format
- **Teilarchive:** App/Code/Daten, Assets sowie Dokumentation/Tests getrennt für robuste Downloads
- **Einzeldatei:** korrigiertes `retro.svg`

## Umfang

- Deploy-Paket: **32 Dateien**
- Komplettes Repo: **48 Dateien**
- Lokale SVG-Dateien: **12**

## Paketkriterien

- `index.html` liegt direkt im Archiv-Root.
- Es gibt keinen zusätzlichen übergeordneten Projektordner im Archiv.
- Alle Pfade sind relativ und für GitHub-Pages-Projekt-Unterpfade geeignet.
- Es sind keine symbolischen Links, temporären Testexporte, Python-Caches oder Betriebssystem-Metadaten enthalten.
- Alle zwölf SVG-Dateien werden nach dem Entpacken als XML geparst.
- Das vollständige ZIP wird mit `unzip -t` geprüft.
- Das TAR.GZ wird vollständig aufgelistet und testweise extrahiert.
- Das Deploy-ZIP wird in einen leeren Ordner extrahiert.
- Das exakt entpackte Deploy-ZIP wird anschließend unter einem Projekt-Unterpfad im mobilen Browser geprüft, einschließlich Illustration-Rendering, Service Worker und Offline-Neustart.
- SHA-256-Prüfsummen werden außerhalb des Repo-Verzeichnisses in einer separaten Datei ausgeliefert.

## Konkrete Fehlerabsicherung

Der zuvor fehlerhafte Text `Retro & Arcade` liegt in der SVG-Datei nun XML-konform als `Retro &amp; Arcade` vor. Dieselbe Korrektur wurde in `talk.svg` vorgenommen. Der statische Validator und der Browser-Test schlagen künftig fehl, sobald eine lokale SVG-Datei nicht mehr geparst oder als Bild dekodiert werden kann.
