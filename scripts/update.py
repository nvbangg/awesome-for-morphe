# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import re
import sys
import time
from pathlib import Path
from updater import gplay_scrape, local_parse, repo_info
from utils import load_json, parse_timestamp, save_json

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DOCS_DIR = ROOT_DIR / "docs"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLES_JSON_PATH = DOCS_DIR / "bundles.json"
APPS_JSON_PATH = DOCS_DIR / "apps.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Update Morphe patches and bundles")
    parser.add_argument("--daily", action="store_true", help="Daily update")
    parser.add_argument("--month", action="store_true", help="Monthly update")
    args = parser.parse_args()
    mode = "month" if args.month else "daily" if args.daily else "default"

    repos_data = load_json(REPOS_JSON_PATH, {})
    existing_bundles_data = load_json(BUNDLES_JSON_PATH, [])
    existing_bundles_list = existing_bundles_data.get("bundles", []) if isinstance(existing_bundles_data, dict) else existing_bundles_data
    existing_bundles = {f"{bundle.get('source')}:{bundle.get('repo')}": bundle for bundle in existing_bundles_list}
    apps_dict = load_json(APPS_JSON_PATH, {})
    existing_apps = {pkg_name: app_data.copy() for pkg_name, app_data in apps_dict.items()}
    bundle_sources = {}
    for key, branches in repos_data.items():
        source, repo = key.split(":", 1)
        bundle_sources[key] = {"source": source, "repo": repo}

        if key in existing_bundles:
            for attribute_name in ["stars", "avatarUrl", "repoDescription", "starsGained7d", "starsGained40d", "appFirstSeen", "name"]:
                if attribute_name in existing_bundles[key]:
                    bundle_sources[key][attribute_name] = existing_bundles[key][attribute_name]
    repo_info.process(bundle_sources, mode, existing_bundles)
    compatibilities_list = local_parse.process(bundle_sources, apps_dict, DATA_DIR)

    gplay_scrape.process(apps_dict, mode, existing_apps)
    now_ms = int(time.time() * 1000)
    final_bundles = []
    sorted_keys = sorted(
        bundle_sources.keys(), key=lambda sort_key: (parse_timestamp(existing_bundles.get(sort_key, {}).get("firstSeen", bundle_sources[sort_key].get("updatedAt", 0))), sort_key.lower())
    )
    for key in sorted_keys:
        bundle = bundle_sources[key]
        ordered_bundle = {
            "source": bundle.get("source"),
            "repo": bundle.get("repo"),
            "name": bundle.get("name"),
            "repoDescription": bundle.get("repoDescription"),
            "avatarUrl": bundle.get("avatarUrl"),
            "stars": bundle.get("stars"),
            "starsGained7d": bundle.get("starsGained7d"),
            "starsGained40d": bundle.get("starsGained40d"),
            "updatedAt": bundle.get("updatedAt"),
            "firstSeen": parse_timestamp(existing_bundles.get(key, {}).get("firstSeen", now_ms)),
            "appFirstSeen": bundle.get("appFirstSeen"),
            "patches": bundle.get("patches", []),
            "isPreRelease": bool(bundle.get("isPreRelease")),
        }
        final_bundles.append(ordered_bundle)
    ordered_apps_dict = {}
    for package_name, app_data in apps_dict.items():
        app_data.setdefault("firstSeen", now_ms)
        app_data.pop("updatedAt", None)
        ordered_app = {
            "name": app_data.get("name"),
            "iconUrl": app_data.get("iconUrl"),
            "description": app_data.get("description"),
            "minInstalls": app_data.get("minInstalls"),
            "genre": app_data.get("genre"),
            "firstSeen": app_data.get("firstSeen"),
        }
        if "altName" in app_data:
            ordered_app["altName"] = app_data["altName"]
        ordered_apps_dict[package_name] = ordered_app

    save_json(BUNDLES_JSON_PATH, {"bundles": final_bundles, "compatibilities": compatibilities_list})
    save_json(APPS_JSON_PATH, ordered_apps_dict)
    print(f"Update completed. Saved {len(final_bundles)} bundles and {len(apps_dict)} apps.")

    invalid_repos = [key for key in repos_data if key not in {f"{bundle['source']}:{bundle['repo']}" for bundle in final_bundles}]
    if invalid_repos:
        print(f"::warning title=Update:: [-] Note: {len(invalid_repos)}/{len(repos_data)} repos are invalid or excluded: {', '.join(invalid_repos)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
