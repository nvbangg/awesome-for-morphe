# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import concurrent.futures
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils import load_json

try:
    from google_play_scraper import app as gplay_app
    from google_play_scraper.exceptions import NotFoundError
except ImportError:
    gplay_app = None
    NotFoundError = Exception

GPLAY_CONCURRENCY = 8
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
OFFICIAL_BUNDLES_PATH = DATA_DIR / "official-bundles.json"

# Inspired by code from Paresh Maheshwari
SKIP_WORDS = {
    "com",
    "org",
    "net",
    "io",
    "co",
    "tv",
    "me",
    "xyz",
    "ai",
    "cn",
    "ru",
    "jp",
    "ch",
    "cz",
    "de",
    "fr",
    "kr",
    "in",
    "nl",
    "pl",
    "se",
    "dk",
    "ee",
    "eu",
    "it",
    "android",
    "app",
    "apps",
    "player",
    "client",
    "mobile",
    "thirdpartyclient",
    "free",
    "pro",
    "lite",
    "dev",
    "beta",
    "premium",
    "inc",
    "corp",
    "llc",
    "studio",
    "studios",
    "game",
    "games",
    "software",
}


def fetch_app_details(package_name: str) -> Tuple[Optional[Dict[str, Any]], bool]:
    if not gplay_app:
        return None, False
    try:
        result = gplay_app(package_name, lang="en", country="us")
        if not result:
            return None, False

        icon_url = result.get("icon")
        if icon_url:
            icon_url += "=s64"
        description = result.get("summary")
        if description is None:
            description = ""
        score_raw = result.get("score")
        score = round(score_raw, 1) if score_raw else 0.0

        details = {
            "name": result.get("title"),
            "iconUrl": icon_url,
            "description": description,
            "minInstalls": result.get("minInstalls") or 0,
            "score": score,
            "genre": result.get("genre") or "Outside Google Play",
        }
        if result.get("editorsChoice"):
            details["editorsChoice"] = True

        return details, False
    except NotFoundError:
        return None, True
    except Exception as error:
        print(f"[-] Error fetching Google Play details for {package_name}: {error}")
        return None, False


def process(apps_dict: Dict[str, Any], mode: str, existing_apps: Dict[str, Any]) -> None:
    if not gplay_app:
        print("[-] google-play-scraper is not installed. Run: pip install google-play-scraper")
        return

    official_apps = {}
    official_data = load_json(OFFICIAL_BUNDLES_PATH, {})
    if isinstance(official_data, dict) and "apps" in official_data:
        official_apps = official_data["apps"]

    def apply_official_fallback(pkg_name: str, app: Dict[str, Any]) -> None:
        off_app = official_apps.get(pkg_name)
        if off_app:
            for attr in ("name", "iconUrl", "description"):
                if not app.get(attr) and off_app.get(attr):
                    app[attr] = off_app[attr]
                    if attr == "iconUrl" and "googleusercontent.com" in app[attr] and "=s" not in app[attr]:
                        app[attr] += "=s64"

    tasks = [
        pkg for pkg, data in apps_dict.items() if mode == "month" or pkg not in existing_apps or any(data.get(a) is None for a in ("name", "iconUrl", "description", "minInstalls", "score", "genre"))
    ]

    if tasks:
        print(f"\nScraping Google Play for {len(tasks)} apps (mode: {mode})...")
        if mode == "default":
            for task in tasks:
                print(f"  -> {task}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=GPLAY_CONCURRENCY) as executor:
            future_to_package = {executor.submit(fetch_app_details, package_name): package_name for package_name in tasks}
            for future in concurrent.futures.as_completed(future_to_package):
                package_name = future_to_package[future]
                try:
                    details, is_404 = future.result()
                    app = apps_dict.setdefault(package_name, {})

                    if not is_404 and details:
                        for key, value in details.items():
                            if value is not None:
                                app[key] = value
                        for attr in ("name", "iconUrl", "description"):
                            if app.get(attr) is None:
                                app[attr] = ""
                    elif is_404:
                        for attr in ("name", "iconUrl", "description"):
                            if app.get(attr) is None:
                                app[attr] = ""
                        app["genre"] = "Outside Google Play"
                        app["minInstalls"] = 0
                        app["score"] = 0.0
                except Exception as error:
                    print(f"[-] Error processing future for {package_name}: {error}")

    def derive_name(pkg_name: str) -> str:
        parts = [part for part in pkg_name.split(".") if part not in SKIP_WORDS and len(part) > 1]
        name = parts[-1] if parts else pkg_name.split(".")[-1]
        return name.replace("-", " ").replace("_", " ").title()

    # Fallback to official data AFTER scraping (ONLY for missing fields, NEVER overrides)
    for package_name, app_data in apps_dict.items():
        apply_official_fallback(package_name, app_data)
        if not app_data.get("name"):
            app_data["altName"] = derive_name(package_name)
        else:
            app_data.pop("altName", None)
