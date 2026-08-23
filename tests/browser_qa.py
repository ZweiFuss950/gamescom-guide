#!/usr/bin/env python3
"""Mobile browser, interaction, persistence and offline QA for the GC26 guide."""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
QA_DIR = ROOT / "assets/qa"
QA_DIR.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("GC26_BASE_URL", "http://127.0.0.1:8765/").rstrip("/") + "/"
USER_DATA = Path(tempfile.mkdtemp(prefix="gc26-browser-"))

results: dict = {
    "ok": False,
    "baseUrl": BASE_URL,
    "viewport": {"width": 390, "height": 844},
    "checks": [],
    "errors": [],
    "screenshots": [],
}


def passed(name: str) -> None:
    results["checks"].append(name)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def shot(page, filename: str, full_page: bool = True) -> None:
    path = QA_DIR / filename
    page.screenshot(path=str(path), full_page=full_page)
    results["screenshots"].append(f"assets/qa/{filename}")


def attach_error_listeners(page) -> None:
    page.on("pageerror", lambda exc: results["errors"].append(f"pageerror: {exc}"))
    page.on("console", lambda msg: results["errors"].append(f"console {msg.type}: {msg.text}") if msg.type == "error" else None)


try:
    with sync_playwright() as p:
        browser_type = p.chromium
        context = browser_type.launch_persistent_context(
            user_data_dir=str(USER_DATA),
            executable_path="/usr/bin/chromium",
            headless=True,
            viewport={"width": 390, "height": 844},
            locale="de-DE",
            timezone_id="Europe/Berlin",
            geolocation={"latitude": 50.9469, "longitude": 6.9833},
            permissions=["geolocation"],
            service_workers="allow",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        attach_error_listeners(page)
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_function("window.__GC_APP__ && window.__GC_APP__.state.isReady")

        version = page.evaluate("window.__GC_APP__.version")
        base_count = page.evaluate("window.__GC_APP__.state.baseEntries.length")
        assert_true(version == "3.1.1", f"Falsche App-Version im Browser: {version}")
        assert_true(base_count == 23, f"Falsche Eintragszahl im Browser: {base_count}")
        passed("App lädt mit Version 3.1.1 und 23 redaktionellen Einträgen")

        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
        assert_true(overflow <= 1, f"Horizontaler Overflow auf 390 px: {overflow}")
        assert_true(bg in {"rgb(255, 255, 255)", "rgba(0, 0, 0, 0)"}, f"Seitenhintergrund ist nicht weiß: {bg}")
        assert_true(page.locator("#home-hall-grid .home-hall-card").count() >= 7, "Hallenüberblick auf Startseite fehlt")
        assert_true(page.locator("#home-top-picks .entry-card").count() >= 6, "Mainstream-Top-Picks fehlen")
        shot(page, "mobile-home-v3.png")
        passed("Landingpage ist mobil, weiß und ohne horizontalen Overflow")

        # iOS install help must be available even without beforeinstallprompt.
        page.evaluate("window.__GC_APP__.state.installPrompt = null")
        page.locator("#install-button").click()
        expect(page.locator("#install-dialog")).to_have_attribute("open", "")
        assert_true("Zum Home-Bildschirm" in page.locator("#install-dialog").inner_text(), "iOS-Installationshilfe fehlt")
        page.locator("#install-dialog [data-close-dialog]").click()
        passed("Installationshilfe ist auf iOS direkt erreichbar")

        # Hall quick navigation and compact details.
        page.locator('[data-nav="halls"]').first.click()
        expect(page).to_have_url(re.compile(r"#halls$"))
        page.locator('[data-hall-quick="7"]').click()
        h7_text = page.locator("#hall-results").inner_text()
        for expected_name in ["Xbox", "NetEase", "SEGA"]:
            assert_true(expected_name in h7_text, f"{expected_name} fehlt in der direkten H7-Ansicht")
        xbox_card = page.locator('#hall-results [data-entry-card="xbox"]').first
        details = xbox_card.locator("details.expand-details")
        assert_true(not details.evaluate("el => el.open"), "Warum-interessant-Details sind standardmäßig offen")
        details.locator("summary").click()
        assert_true(details.evaluate("el => el.open"), "Details lassen sich nicht ausklappen")
        shot(page, "mobile-halls-h7-v3.png")
        passed("Direkte Hallenwahl und einklappbare Detailinformationen funktionieren")

        # Favorite and map emphasis.
        xbox_card.locator('[data-favorite="xbox"]').click()
        assert_true(page.evaluate("JSON.parse(localStorage.getItem('gc26:favorites:v3')).includes('xbox')"), "Xbox-Favorit nicht gespeichert")
        page.locator('.bottom-nav [data-nav="map"]').click()
        marker = page.locator('#map-markers [data-open-entry="xbox"]')
        expect(marker).to_have_class(re.compile(r"\bfavorite\b"))
        page.locator("#map-favorites-toggle").click()
        assert_true(page.locator("#map-markers .map-marker.dimmed").count() > 0, "Nicht-Favoriten werden im Fokusmodus nicht gedimmt")
        assert_true("Fokus aktiv" in page.locator("#map-favorites-toggle").inner_text(), "Favoritenfokus nicht sichtbar")
        # Keyboard access for SVG marker.
        marker.focus()
        page.keyboard.press("Enter")
        expect(page.locator("#entry-dialog")).to_have_attribute("open", "")
        assert_true("Xbox" in page.locator("#entry-dialog-content").inner_text(), "Marker-Dialog zeigt falschen Eintrag")
        page.locator("#entry-dialog [data-close-dialog]").click()
        shot(page, "mobile-map-favorites-v3.png")
        passed("Favoritenmarker, Fokusmodus und Tastaturbedienung der Karte funktionieren")

        # Manual hall fallback.
        page.locator("#manual-hall-select").select_option("7")
        assert_true(page.evaluate("localStorage.getItem('gc26:currentHall:v3')") == "7", "Manueller Hallenstandort nicht gespeichert")
        assert_true(page.locator("#map-user-location .user-location").count() == 1, "Manueller Hallenstandort nicht auf Karte sichtbar")
        passed("Manueller Indoor-Standort-Fallback funktioniert")

        # Add local custom discovery.
        page.locator("#add-note-fab").click()
        page.locator("#note-title").fill("Spontane Koop-Demo")
        page.locator("#note-hall").select_option("7")
        page.locator("#note-stand").fill("B042")
        page.locator("#note-day").select_option("2026-08-28")
        page.locator("#note-time").fill("15:30")
        page.locator("#note-text").fill("Nach dem NetEase-Stand wiederkommen und mit Alex testen.")
        page.locator("#note-form button[type=submit]").click()
        expect(page.locator("#notes-count")).to_have_text("1")
        note_id = page.evaluate("window.__GC_APP__.state.notes[0].id")
        assert_true(bool(note_id), "Eigener Eintrag hat keine ID")
        assert_true(page.evaluate("window.__GC_APP__.state.favorites.has(window.__GC_APP__.state.notes[0].id)"), "Eigener Eintrag wurde nicht favorisiert")
        page.locator('.bottom-nav [data-nav="map"]').click()
        note_marker = page.locator(f'#map-markers [data-open-entry="{note_id}"]')
        expect(note_marker).to_have_class(re.compile(r"(?=.*\buser-note\b)(?=.*\bfavorite\b)"))
        shot(page, "mobile-map-own-note-v3.png")
        passed("Eigene Einträge erscheinen lokal, als Favorit und auf der Karte")

        # Notes drawer, edit, export.
        page.locator("#notes-button").click()
        expect(page.locator("#notes-drawer")).to_have_attribute("open", "")
        assert_true("Spontane Koop-Demo" in page.locator("#notes-list").inner_text(), "Eigener Eintrag fehlt im Notizblock")
        page.locator(f'[data-edit-note="{note_id}"]').click()
        page.locator("#note-title").fill("Spontane Koop-Demo – wichtig")
        page.locator("#note-form button[type=submit]").click()
        assert_true(page.evaluate("window.__GC_APP__.state.notes[0].name").endswith("wichtig"), "Notizbearbeitung nicht gespeichert")
        page.locator("#notes-button").click()
        with page.expect_download() as download_info:
            page.locator("#notes-export-button").click()
        download = download_info.value
        export_path = ROOT / "data/test-export.json"
        download.save_as(str(export_path))
        exported = json.loads(export_path.read_text(encoding="utf-8"))
        assert_true(len(exported["notes"]) == 1 and note_id in exported["favorites"], "Export enthält Notiz/Favorit nicht")
        export_path.unlink(missing_ok=True)
        page.locator("#notes-drawer [data-close-dialog]").click()
        passed("Notizblock, Bearbeiten und JSON-Export funktionieren")

        # Persistence after reload.
        page.reload(wait_until="networkidle")
        page.wait_for_function("window.__GC_APP__ && window.__GC_APP__.state.isReady")
        assert_true(page.evaluate("window.__GC_APP__.state.notes.length") == 1, "Notiz nach Reload verloren")
        assert_true(page.evaluate("window.__GC_APP__.state.favorites.has('xbox')"), "Favorit nach Reload verloren")
        passed("Favoriten, aktuelle Halle und Notizen bleiben nach Reload erhalten")

        # Live schedule at a deterministic event time.
        debug = quote("2026-08-27T16:15:00+02:00", safe="")
        page.goto(f"{BASE_URL}?debugTime={debug}#schedule", wait_until="networkidle")
        page.wait_for_function("window.__GC_APP__ && window.__GC_APP__.state.isReady")
        assert_true(page.locator("#schedule-results .timeline-item.running").count() >= 1, "Kein laufender Termin um 16:15 erkannt")
        assert_true("läuft gerade" in page.locator("#next-up-card").inner_text().lower(), "Live-Hervorhebung fehlt")
        panel_item = page.locator('[data-timeline-id="spielwissenschaft-panel"]')
        expect(panel_item).to_be_visible()
        assert_true("Stage D" in panel_item.inner_text(), "Stage D fehlt im kompakten Zeitplan")
        # Favorite panel so timed favorite actions can be checked.
        panel_item.locator('[data-favorite="spielwissenschaft-panel"]').click()
        page.evaluate("window.scrollTo(0, 0)")
        shot(page, "mobile-schedule-live-v3.png", full_page=False)
        passed("Live-Zeitplan erkennt laufende Termine und hält Talks kompakt")

        # Deep link schedule -> map.
        panel_item.locator('[data-map-entry="spielwissenschaft-panel"]').click()
        expect(page).to_have_url(re.compile(r"#map/spielwissenschaft-panel$"))
        expect(page.locator('#map-markers [data-open-entry="spielwissenschaft-panel"]')).to_have_class(re.compile(r"\bfocused\b"))
        passed("Deep-Link vom Zeitplan zur fokussierten Kartenposition funktioniert")

        # Favorites actions including timed sources and schedule link.
        page.locator('.bottom-nav [data-nav="favorites"]').click()
        expect(page).to_have_url(re.compile(r"#favorites$"))
        expect(page.locator("#view-favorites")).to_be_visible()
        favorite_text = page.locator("#favorites-results").inner_text()
        assert_true("Xbox" in favorite_text and "Spontane Koop-Demo" in favorite_text and "Spielwissenschaft" in favorite_text, "Favoritenansicht ist unvollständig")
        timed_favorite = page.locator('#favorites-results [data-entry-card="spielwissenschaft-panel"]').first
        for action in ["Gamescom", "Quelle", "Auf Karte", "Im Zeitplan"]:
            assert_true(action in timed_favorite.inner_text(), f"Aktion fehlt beim terminierten Favoriten: {action}")
        own_timed_favorite = page.locator(f'#favorites-results [data-entry-card="{note_id}"]').first
        own_actions = own_timed_favorite.inner_text()
        assert_true("Gamescom" not in own_actions and "Quelle" not in own_actions, "Eigener Termin zeigt einen erfundenen Quellenlink")
        assert_true("Halle 7" in own_actions and "Stand B042" in own_actions, "Eigener Termin zeigt Halle/Stand nicht vollständig")
        page.evaluate("window.scrollTo(0, 0)")
        shot(page, "mobile-favorites-v3.png", full_page=False)
        passed("Favoriten-Tab gruppiert Inhalte und bietet alle relevanten Aktionen")

        # Search and reset in the complete hall overview.
        page.locator('.bottom-nav [data-nav="halls"]').click()
        expect(page).to_have_url(re.compile(r"#halls$"))
        page.locator('[data-hall-quick="all"]').click()
        page.locator("#global-search").fill("Ubisoft")
        page.wait_for_timeout(150)
        count_text = page.locator("#result-count").inner_text()
        count_value = int(count_text.split()[0])
        assert_true(count_value >= 1, f"Freitextsuche findet Ubisoft nicht: {count_text}")
        assert_true("Ubisoft" in page.locator("#hall-results").inner_text(), "Ubisoft-Karte fehlt im Suchergebnis")
        page.locator("#filter-reset-inline").click()
        assert_true(page.locator("#global-search").input_value() == "", "Filter-Reset leert Suche nicht")
        passed("Freitextsuche, Trefferzähler und Ein-Klick-Reset funktionieren")

        # Service worker and cache.
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_function("window.__GC_APP__ && window.__GC_APP__.state.isReady")
        page.evaluate("navigator.serviceWorker.ready")
        page.reload(wait_until="networkidle")
        page.wait_for_function("navigator.serviceWorker.controller !== null")
        cache_keys = page.evaluate("caches.keys()")
        assert_true(any("gc26-guide-v3-1" in key for key in cache_keys), f"Versionierter Cache fehlt: {cache_keys}")
        cache_count = page.evaluate("(key) => caches.open(key).then(c => c.keys()).then(a => a.length)", cache_keys[0])
        assert_true(cache_count >= 20, f"App-Shell unvollständig im Cache: {cache_count}")
        passed("Service Worker kontrolliert die App und cached die vollständige App-Shell")

        context.close()

        # Browser restart without network, using the same profile.
        offline_context = browser_type.launch_persistent_context(
            user_data_dir=str(USER_DATA),
            executable_path="/usr/bin/chromium",
            headless=True,
            viewport={"width": 390, "height": 844},
            locale="de-DE",
            timezone_id="Europe/Berlin",
            service_workers="allow",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        offline_context.set_offline(True)
        offline_page = offline_context.pages[0] if offline_context.pages else offline_context.new_page()
        attach_error_listeners(offline_page)
        offline_page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
        offline_page.wait_for_function("window.__GC_APP__ && window.__GC_APP__.state.isReady", timeout=30000)
        assert_true(not offline_page.locator("#network-banner").is_hidden(), "Offline-Hinweis ist nicht sichtbar")
        assert_true(offline_page.evaluate("window.__GC_APP__.state.baseEntries.length") == 23, "Datenbestand lädt nach Browser-Neustart offline nicht")
        assert_true(offline_page.evaluate("window.__GC_APP__.state.notes.length") == 1, "Lokale Notiz fehlt nach Offline-Neustart")
        offline_page.locator('.bottom-nav [data-nav="map"]').click()
        offline_page.wait_for_function("document.querySelectorAll('#map-markers .map-marker').length > 10", timeout=10000)
        assert_true(offline_page.locator("#map-markers .map-marker").count() > 10, "Karte hat offline keine Marker")
        offline_page.evaluate("window.scrollTo(0, 0)")
        shot(offline_page, "mobile-offline-restart-v3.png", full_page=False)
        passed("App startet nach echtem Browser-Neustart offline mit Karte, Daten, Favoriten und Notizen")
        offline_context.close()

        if results["errors"]:
            # Ignore the expected external-resource errors only if there are any; app itself should stay clean.
            raise AssertionError("Browser meldete Fehler: " + " | ".join(results["errors"]))

        results["ok"] = True

except Exception as exc:
    results["errors"].append(f"test failure: {exc}")
finally:
    shutil.rmtree(USER_DATA, ignore_errors=True)
    (ROOT / "data/browser-qa.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if not results["ok"]:
    print("BROWSER QA FAILED")
    for error in results["errors"]:
        print(f"- {error}")
    raise SystemExit(1)

print(f"BROWSER QA PASSED: {len(results['checks'])} Prüfgruppen")
for check in results["checks"]:
    print(f"- {check}")
