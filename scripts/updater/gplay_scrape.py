# Copyright (c) 2026 nvbangg (github.com/nvbangg)

from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import concurrent.futures

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from google_play_scraper import app as gplay_app
    from google_play_scraper.exceptions import NotFoundError
except ImportError:
    gplay_app = None
    NotFoundError = Exception

GPLAY_CONCURRENCY = 8


def fetch_app_details(package_name: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if not gplay_app:
        return None, None, None
    try:
        result = gplay_app(package_name, lang="en", country="us")
        if not result:
            return None, None, None

        icon_url = result.get("icon")
        if icon_url:
            icon_url += "=s64"

        description = result.get("summary")
        if description is None:
            description = ""

        return result.get("title"), icon_url, description
    except NotFoundError:
        return None, None, None
    except Exception as error:
        print(f"Error fetching Google Play details for {package_name}: {error}")
        return None, None, None


def process(apps_dict: Dict[str, Any], mode: str, existing_apps: Dict[str, Any]) -> None:
    if not gplay_app:
        print("Warning: google-play-scraper is not installed. Run: pip install google-play-scraper")
        return

    tasks = []

    for package_name, app_data in apps_dict.items():
        if mode == "default":
            if package_name not in existing_apps:
                tasks.append(package_name)
        elif mode == "daily":
            if package_name not in existing_apps:
                tasks.append(package_name)
            else:
                if app_data.get("name") is None or app_data.get("iconUrl") is None or app_data.get("description") is None:
                    tasks.append(package_name)
        elif mode == "month":
            tasks.append(package_name)

    if not tasks:
        return

    print(f"Scraping Google Play for {len(tasks)} apps (mode: {mode})...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=GPLAY_CONCURRENCY) as executor:
        future_to_package = {executor.submit(fetch_app_details, package_name): package_name for package_name in tasks}
        for future in concurrent.futures.as_completed(future_to_package):
            package_name = future_to_package[future]
            try:
                name, icon, description = future.result()

                if package_name not in apps_dict:
                    apps_dict[package_name] = {}

                if name is not None or icon is not None or description is not None:
                    if mode == "month" or apps_dict[package_name].get("name") is None:
                        if name is not None:
                            apps_dict[package_name]["name"] = name
                    if mode == "month" or apps_dict[package_name].get("iconUrl") is None:
                        if icon is not None:
                            apps_dict[package_name]["iconUrl"] = icon
                    if mode == "month" or apps_dict[package_name].get("description") is None:
                        if description is not None:
                            apps_dict[package_name]["description"] = description
                else:
                    if "name" not in apps_dict[package_name]:
                        apps_dict[package_name]["name"] = None
                    if "iconUrl" not in apps_dict[package_name]:
                        apps_dict[package_name]["iconUrl"] = None
                    if "description" not in apps_dict[package_name]:
                        apps_dict[package_name]["description"] = None

            except Exception as error:
                print(f"Error processing future for {package_name}: {error}")
