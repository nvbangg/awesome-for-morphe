# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import sys
from pathlib import Path

from updater import repo_info, local_parse, official_sync, gplay_scrape
from utils import load_json, save_json

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DOCS_DIR = ROOT_DIR / "docs"

REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLES_JSON_PATH = DOCS_DIR / "bundles.json"
APPS_JSON_PATH = DOCS_DIR / "apps.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Update Morphe patches and bundles")
    parser.add_argument("--daily", action="store_true", help="Daily update (fetch stars, avatars, missing apps)")
    parser.add_argument("--month", action="store_true", help="Monthly update (force Google Play scrape for all apps)")
    args = parser.parse_args()

    if args.month:
        mode = "month"
    elif args.daily:
        mode = "daily"
    else:
        mode = "default"

    repos_data = load_json(REPOS_JSON_PATH, {})
    existing_bundles_data = load_json(BUNDLES_JSON_PATH, [])
    if isinstance(existing_bundles_data, dict) and "bundles" in existing_bundles_data:
        existing_bundles_list = existing_bundles_data["bundles"]
    else:
        existing_bundles_list = existing_bundles_data

    existing_bundles = {}
    for bundle in existing_bundles_list:
        key = f"{bundle.get('source')}:{bundle.get('repo')}"
        existing_bundles[key] = bundle

    apps_dict = load_json(APPS_JSON_PATH, {})
    existing_apps = {k: v.copy() for k, v in apps_dict.items()}

    bundle_sources = {}
    for key, branches in repos_data.items():
        if branches.get("main") is None and branches.get("dev") is None:
            continue

        source, repo = key.split(":", 1)
        bundle_sources[key] = {"source": source, "repo": repo}

        if key in existing_bundles:
            old_bundle = existing_bundles[key]
            if "stars" in old_bundle:
                bundle_sources[key]["stars"] = old_bundle["stars"]
            if "avatarUrl" in old_bundle:
                bundle_sources[key]["avatarUrl"] = old_bundle["avatarUrl"]
            if "repoDescription" in old_bundle:
                bundle_sources[key]["repoDescription"] = old_bundle["repoDescription"]

    if mode == "default":
        repo_info.process(bundle_sources, mode, existing_bundles)
        compatibilities_list = local_parse.process(bundle_sources, apps_dict, DATA_DIR)
        official_sync.process(bundle_sources, apps_dict, DATA_DIR)
        gplay_scrape.process(apps_dict, mode, existing_apps)

    elif mode == "daily":
        repo_info.process(bundle_sources, mode, existing_bundles)
        compatibilities_list = local_parse.process(bundle_sources, apps_dict, DATA_DIR)
        official_sync.process(bundle_sources, apps_dict, DATA_DIR)
        gplay_scrape.process(apps_dict, mode, existing_apps)

    elif mode == "month":
        repo_info.process(bundle_sources, mode, existing_bundles)
        compatibilities_list = local_parse.process(bundle_sources, apps_dict, DATA_DIR)
        gplay_scrape.process(apps_dict, mode, existing_apps)
        official_sync.process(bundle_sources, apps_dict, DATA_DIR)

    final_bundles = []

    def normalize_timestamp(timestamp):
        if not timestamp:
            return 0
        if isinstance(timestamp, int):
            return timestamp
        if isinstance(timestamp, str):
            if timestamp.isdigit():
                return int(timestamp)
            try:
                from datetime import datetime

                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                return int(dt.timestamp() * 1000)
            except Exception:
                pass
        return 0

    sorted_keys = sorted(bundle_sources.keys(), key=lambda k: (normalize_timestamp(existing_bundles.get(k, {}).get("firstSeen", bundle_sources[k].get("updatedAt", 0))), k.lower()))

    import time

    now_ms = int(time.time() * 1000)

    for key in sorted_keys:
        bundle = bundle_sources[key]
        updated_at = bundle.get("updatedAt", 0)
        target_apps = bundle.get("targetApps", [])

        ordered_bundle = {
            "name": bundle.get("name"),
            "source": bundle.get("source"),
            "repo": bundle.get("repo"),
            "avatarUrl": bundle.get("avatarUrl"),
            "stars": bundle.get("stars", 0),
            "firstSeen": normalize_timestamp(existing_bundles.get(key, {}).get("firstSeen", now_ms)),
            "patches": bundle.get("patches", []),
            "targetApps": target_apps,
            "updatedAt": updated_at,
            "repoDescription": bundle.get("repoDescription"),
        }
        if bundle.get("isPreRelease"):
            ordered_bundle["isPreRelease"] = True

        final_bundles.append(ordered_bundle)

    for package_name, app_data in apps_dict.items():
        if "firstSeen" not in app_data:
            app_data["firstSeen"] = now_ms

        app_data.pop("updatedAt", None)

    final_apps = apps_dict

    save_json(BUNDLES_JSON_PATH, {"bundles": final_bundles, "compatibilities": compatibilities_list})
    save_json(APPS_JSON_PATH, final_apps)

    print(f"Update completed. Saved {len(final_bundles)} bundles and {len(final_apps)} apps.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
