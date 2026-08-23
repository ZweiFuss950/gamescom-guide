#!/usr/bin/env python3
"""Static validation for the GC26 GitHub Pages repository."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image
from jsonschema import validate as schema_validate

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data/data.json").read_text(encoding="utf-8"))
SCHEMA = json.loads((ROOT / "data/schema.json").read_text(encoding="utf-8"))
AUDIT = json.loads((ROOT / "data/link-audit.json").read_text(encoding="utf-8"))

errors: list[str] = []
checks: list[str] = []


def ok(name: str) -> None:
    checks.append(name)


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def local_path(value: str) -> Path | None:
    if not value.startswith("./"):
        return None
    clean = value[2:].split("?", 1)[0].split("#", 1)[0]
    return ROOT / clean


required_files = [
    "index.html", "offline.html", "manifest.json", "sw.js", ".nojekyll",
    "css/styles.css", "js/app.js", "data/data.json", "data/schema.json",
    "data/link-audit.json", "README.md", "SOURCES.md", "DATA_STATUS.md",
    "LINK_CHECK.md", "LICENSE",
    "assets/icons/icon-180.png", "assets/icons/icon-192.png",
    "assets/icons/icon-512.png", "assets/icons/maskable-512.png",
    "assets/map/simplified-halls.svg",
]
for rel in required_files:
    require((ROOT / rel).is_file(), f"Pflichtdatei fehlt: {rel}")
ok("Pflichtdateien vorhanden")

# JSON and schema
schema_validate(DATA, SCHEMA)
require(DATA["meta"]["version"] == "3.1.1", "Unerwartete App-Version")
require(DATA["meta"]["dataVersion"] == "2026-08-23.5", "Unerwartete Datenversion")
require(len(DATA["entries"]) >= 20, "Zu wenige redaktionelle Einträge")
ok("JSON-Daten und Schema lesbar")

ids = [entry["id"] for entry in DATA["entries"]]
require(len(ids) == len(set(ids)), "Doppelte Eintrags-IDs")
required_major = {
    "xbox", "nintendo", "bandai-namco", "ubisoft", "level-infinite",
    "hoyoverse", "giants", "netease", "sega", "capcom", "samsung",
    "indie-arena", "coffee-stain", "commodore-retro", "hall5-community",
    "big-n-club-watch", "playstation-route", "xbox-ikea", "gta6-netflix",
    "spielwissenschaft-panel",
}
require(required_major.issubset(ids), f"Wichtige Einträge fehlen: {sorted(required_major - set(ids))}")
ok("Big Player, Fan-, Indie-, Retro- und Reality-Checks enthalten")

allowed_days = {"2026-08-27", "2026-08-28"}
allowed_gc_hosts = {"exhibitors.gamescom.global", "congress.gamescom.global"}
all_urls: set[str] = set()
for entry in DATA["entries"]:
    prefix = entry["id"]
    for field in ["name", "beschreibung", "warumInteressant", "gamescomLink", "sourceChecked"]:
        require(bool(entry.get(field)), f"{prefix}: Pflichtfeld leer: {field}")
    require(entry.get("tage") and set(entry["tage"]).issubset(allowed_days), f"{prefix}: ungültige Tage")
    require(isinstance(entry.get("kategorien"), list) and entry["kategorien"], f"{prefix}: Kategorien fehlen")
    gc = entry.get("gamescomLink", "")
    parsed_gc = urlparse(gc)
    require(parsed_gc.scheme == "https" and parsed_gc.hostname in allowed_gc_hosts, f"{prefix}: Gamescom-Link nicht in aktueller offizieller Struktur: {gc}")
    require(entry.get("externeLinks"), f"{prefix}: externe Quelle fehlt")
    for link in entry.get("externeLinks", []):
        url = link.get("url", "")
        parsed = urlparse(url)
        require(parsed.scheme == "https" and parsed.hostname, f"{prefix}: ungültige externe URL: {url}")
        require(parsed.hostname not in allowed_gc_hosts, f"{prefix}: externe Quelle ist nur eine zweite Gamescom-Seite")
        all_urls.add(url)
    all_urls.add(gc)
    image = local_path(entry.get("bildUrl", ""))
    require(image is not None and image.is_file(), f"{prefix}: lokales Bild fehlt: {entry.get('bildUrl')}")
    pos = entry.get("kartenposition")
    if pos is not None:
        require(0 <= float(pos.get("x", -1)) <= 100 and 0 <= float(pos.get("y", -1)) <= 72, f"{prefix}: Kartenposition außerhalb des Plans")
    if entry.get("startzeit"):
        require(entry["startzeit"][:10] in allowed_days, f"{prefix}: Termin außerhalb des Aufenthalts")
        require(entry.get("endzeit"), f"{prefix}: Termin ohne Endzeit")
ok("Pflichtlinks, Tage, Bilder und Kartenpositionen je Eintrag geprüft")

panel = next(entry for entry in DATA["entries"] if entry["id"] == "spielwissenschaft-panel")
require(panel["startzeit"] == "2026-08-27T16:00:00+02:00", "Spielwissenschaft-Panel: falsche Startzeit")
require(panel["endzeit"] == "2026-08-27T17:00:00+02:00", "Spielwissenschaft-Panel: falsche Endzeit")
require("Stage D" in panel["stage"], "Spielwissenschaft-Panel: Stage D fehlt")
for name in ["Sebastian Möring", "Effrosyni Chelioti", "Andrea Lübcke", "Melanie Fritsch", "Jens Junge"]:
    require(any(name in speaker for speaker in panel["speaker"]), f"Spielwissenschaft-Panel: {name} fehlt")
ok("Vorgegebenes Spielwissenschaft-Panel exakt geprüft")

# Audit coverage
covered = {item["url"] for item in AUDIT["links"]}
require(all_urls == covered, f"Link-Audit deckt Daten nicht exakt ab; fehlend={sorted(all_urls-covered)}, extra={sorted(covered-all_urls)}")
require(AUDIT["summary"]["known404LinksRemaining"] == 0, "Link-Audit meldet verbliebene 404-Ziele")
require(AUDIT["summary"]["uniqueUrls"] == len(all_urls), "Link-Audit zählt URLs falsch")
ok("Link-Audit deckt alle Ziel-URLs ab")

# Manifest and icon dimensions
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
require(manifest.get("start_url") == "./", "Manifest start_url ist nicht relativ")
require(manifest.get("scope") == "./", "Manifest scope ist nicht relativ")
require(manifest.get("display") == "standalone", "Manifest display ist nicht standalone")
for icon in manifest.get("icons", []):
    path = local_path(icon["src"])
    require(path is not None and path.is_file(), f"Manifest-Icon fehlt: {icon['src']}")
expected_dims = {
    "assets/icons/icon-180.png": (180, 180),
    "assets/icons/icon-192.png": (192, 192),
    "assets/icons/icon-512.png": (512, 512),
    "assets/icons/maskable-512.png": (512, 512),
}
for rel, expected in expected_dims.items():
    with Image.open(ROOT / rel) as image:
        require(image.size == expected, f"Falsche Icon-Größe {rel}: {image.size} statt {expected}")
ok("Manifest, Apple- und PWA-Icons geprüft")

# App shell paths in service worker
sw = (ROOT / "sw.js").read_text(encoding="utf-8")
require("CACHE_VERSION" in sw and "gc26-guide-v3-1" in sw, "Service-Worker-Cache nicht versioniert")
app_shell_match = re.search(r"const APP_SHELL = \[(.*?)\];", sw, re.S)
require(bool(app_shell_match), "APP_SHELL nicht gefunden")
if app_shell_match:
    shell_paths = re.findall(r"['\"](\./[^'\"]*)['\"]", app_shell_match.group(1))
    for value in shell_paths:
        if value == "./":
            continue
        path = local_path(value)
        require(path is not None and path.is_file(), f"Service Worker cached fehlende Datei: {value}")
    require("./data/data.json" in shell_paths, "data.json fehlt im Offline-Cache")
    require("./assets/icons/icon-512.png" in shell_paths, "512er Icon fehlt im Offline-Cache")
ok("Service-Worker-App-Shell geprüft")

# HTML and source hygiene
html = (ROOT / "index.html").read_text(encoding="utf-8")
require(html.count('data-nav="map"') >= 2, "Kartennavigation fehlt")
for label in ["Karte", "Hallen", "Zeitplan", "Favoriten"]:
    require(f"<span>{label}</span>" in html, f"Bottom-Navigation fehlt: {label}")
for token in ["apple-mobile-web-app-capable", "apple-mobile-web-app-status-bar-style", "apple-touch-icon", "manifest.json"]:
    require(token in html, f"iOS/PWA-Meta fehlt: {token}")
require("id=\"add-note-fab\"" in html and "id=\"notes-drawer\"" in html, "Notizfunktion fehlt im HTML")
require("id=\"hall-quick-nav\"" in html, "Direkte Hallennavigation fehlt")
require("id=\"install-button\"" in html and "install-button\" type" in html and "install-button\" type=\"button\"" in html, "Installationsbutton fehlt")
require("id=\"install-button\" type=\"button\" aria-label=\"App installieren\" title=\"Zum Home-Bildschirm\" hidden" not in html, "Installationshilfe ist auf iOS versteckt")

for forbidden in ["plan-your-visit", "big-n-club.de", "capcom-games.com", "sega.com/en-gb", "www.commodore.net", "bmftr.bund.de"]:
    for path in [ROOT / "index.html", ROOT / "data/data.json", ROOT / "js/app.js", ROOT / "README.md", ROOT / "SOURCES.md"]:
        require(forbidden not in path.read_text(encoding="utf-8").lower(), f"Veralteter/problematischer Linkrest '{forbidden}' in {path.name}")
ok("HTML, iOS-Metadaten und problematische Altlinks geprüft")

# Offline-local assets referenced by app code/data.
for path in [ROOT / "index.html", ROOT / "css/styles.css", ROOT / "js/app.js", ROOT / "data/data.json", ROOT / "manifest.json", ROOT / "sw.js"]:
    text = path.read_text(encoding="utf-8")
    for value in set(re.findall(r"\.\/[A-Za-z0-9_./-]+\.(?:html|css|json|js|svg|png)", text)):
        target = local_path(value)
        require(target is not None and target.is_file(), f"Kaputter relativer Pfad in {path.name}: {value}")
ok("Relative GitHub-Pages-Pfade geprüft")

result = {
    "ok": not errors,
    "checks": checks,
    "errors": errors,
    "entryCount": len(DATA["entries"]),
    "uniqueUrlCount": len(all_urls),
}
(ROOT / "data/static-validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if errors:
    print("STATIC VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"STATIC VALIDATION PASSED: {len(checks)} Prüfgruppen, {len(DATA['entries'])} Einträge, {len(all_urls)} Ziel-URLs")
for check in checks:
    print(f"- {check}")
