# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import concurrent.futures
from pathlib import Path
from typing import Any

from google_play_scraper import app as gplay_app
from google_play_scraper.exceptions import NotFoundError

from updater import normalize_image_url
from utils import load_json

GPLAY_CONCURRENCY = 8
ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
OFFICIAL_BUNDLES_PATH = DATA_DIR / "official-bundles.json"

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


def fetch_app_details(package_name: str) -> tuple[dict[str, Any] | None, bool]:
    try:
        result = gplay_app(package_name, lang="en", country="us")
        if not result:
            return None, False
        icon_url = normalize_image_url(result.get("icon"))
        description = result.get("summary") or ""
        details = {
            "name": result.get("title"),
            "iconUrl": icon_url,
            "description": description,
            "minInstalls": result.get("minInstalls") or 0,
            "category": result.get("genre") or "",
        }
        return details, False
    except NotFoundError:
        return None, True
    except Exception as error:
        print(f"[-] Error fetching Google Play details for {package_name}: {error}")
        return None, False


def process(
    apps_dict: dict[str, Any], mode: str,
) -> None:
    official_data = load_json(OFFICIAL_BUNDLES_PATH, {})
    official_store = (
        official_data.get("store", {}) if isinstance(official_data, dict) else {}
    )

    if mode == "month":
        apps_to_scrape = list(apps_dict.keys())
    else:
        apps_to_scrape = [
            package_name
            for package_name, app_data in apps_dict.items()
            if any(
                app_data.get(field) is None
                for field in (
                    "name",
                    "iconUrl",
                    "description",
                    "minInstalls",
                    "category",
                )
            )
        ]
    if apps_to_scrape:
        print(
            f"\nScraping Google Play for {len(apps_to_scrape)} apps (mode: {mode})..."
        )
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=GPLAY_CONCURRENCY
        ) as executor:
            future_to_package = {
                executor.submit(fetch_app_details, package_name): package_name
                for package_name in apps_to_scrape
            }
            for future in concurrent.futures.as_completed(future_to_package):
                package_name = future_to_package[future]
                try:
                    details, is_404 = future.result()
                    current_app = apps_dict[package_name]
                    if not is_404 and details:
                        for key, value in details.items():
                            if value is not None:
                                current_app[key] = value
                        for field in ("name", "iconUrl", "description"):
                            if current_app.get(field) is None:
                                current_app[field] = ""
                    elif is_404:
                        for field in ("name", "iconUrl", "description", "category"):
                            if current_app.get(field) is None:
                                current_app[field] = ""
                        if not current_app.get("minInstalls"):
                            current_app["minInstalls"] = 0
                except Exception as error:
                    print(f"[-] Error processing {package_name}: {error}")
    print(
        f"\nSyncing with official store data ({len(official_store)} apps in store)..."
    )
    for package_name, app_data in apps_dict.items():
        official_app = official_store.get(package_name)
        if official_app:
            for field_name in ("name", "iconUrl", "description", "category"):
                field_value = official_app.get(field_name)
                if field_value:
                    app_data[field_name] = field_value

    def derive_name(package_name: str) -> str:
        parts = [
            part
            for part in package_name.split(".")
            if part not in SKIP_WORDS and len(part) > 1
        ]
        name = parts[-1] if parts else package_name.split(".")[-1]
        return name.replace("-", " ").replace("_", " ").title()

    for package_name, app_data in apps_dict.items():
        if not app_data.get("name"):
            app_data["altName"] = derive_name(package_name)
        else:
            app_data.pop("altName", None)
        if app_data.get("iconUrl"):
            app_data["iconUrl"] = normalize_image_url(app_data["iconUrl"])
