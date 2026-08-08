# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import json
import sys
import time
from pathlib import Path

from updater import gplay_scrape, local_parse, repo_info
from utils import load_json, parse_timestamp, save_json

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
PUBLIC_DIR = ROOT_DIR / "web" / "public"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
DISCOVER_JSON_PATH = DATA_DIR / "discover" / "discover.json"
BUNDLES_JSON_PATH = PUBLIC_DIR / "bundles.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Update Morphe patches and bundles")
    parser.add_argument("--daily", action="store_true", help="Daily update")
    parser.add_argument("--month", action="store_true", help="Monthly update")
    args = parser.parse_args()
    mode = "month" if args.month else "daily" if args.daily else "default"

    repos_data = load_json(REPOS_JSON_PATH, {})
    discover_data = load_json(DISCOVER_JSON_PATH, {})
    keys_to_remove = [
        base_key for base_key in repos_data if base_key not in discover_data
    ]
    if keys_to_remove:
        for base_key in keys_to_remove:
            del repos_data[base_key]
        save_json(REPOS_JSON_PATH, repos_data)
        print(f"Removed {len(keys_to_remove)} disabled repos from repos.json")
    existing_bundles_data = load_json(BUNDLES_JSON_PATH, {})
    existing_bundles_list = existing_bundles_data.get("bundles", [])
    existing_bundles = {
        f"{bundle.get('source')}:{bundle.get('repo')}": bundle
        for bundle in existing_bundles_list
    }
    apps_dict = existing_bundles_data.get("store", {})
    existing_apps = {
        pkg_name: app_data.copy() for pkg_name, app_data in apps_dict.items()
    }
    bundle_sources = {}
    for key, _branches in repos_data.items():
        source, repo = key.split(":", 1)
        bundle_sources[key] = {"source": source, "repo": repo}

        if key in existing_bundles:
            for attribute_name in [
                "stars",
                "avatarUrl",
                "repoDescription",
                "starsGained7d",
                "starsGained40d",
                "appFirstSeen",
            ]:
                if attribute_name in existing_bundles[key]:
                    bundle_sources[key][attribute_name] = existing_bundles[key][
                        attribute_name
                    ]
    repo_info.process(bundle_sources, mode, existing_bundles)
    compatibilities_list = local_parse.process(bundle_sources, apps_dict)

    gplay_scrape.process(apps_dict, mode, existing_apps)
    now_ms = int(time.time() * 1000)
    final_bundles = []
    sorted_keys = sorted(
        bundle_sources.keys(),
        key=lambda sort_key: (
            parse_timestamp(
                existing_bundles.get(sort_key, {}).get(
                    "firstSeen", bundle_sources[sort_key].get("updatedAt", 0)
                )
            ),
            sort_key.lower(),
        ),
    )
    for key in sorted_keys:
        bundle = bundle_sources[key]
        ordered_bundle = {
            "source": bundle.get("source") or "",
            "repo": bundle.get("repo") or "",
            "name": bundle.get("name") or "",
            "repoDescription": bundle.get("repoDescription") or "",
            "avatarUrl": bundle.get("avatarUrl") or "",
            "stars": bundle.get("stars") or 0,
            "starsGained7d": bundle.get("starsGained7d") or 0,
            "starsGained40d": bundle.get("starsGained40d") or 0,
            "updatedAt": bundle.get("updatedAt") or 0,
            "firstSeen": parse_timestamp(
                existing_bundles.get(key, {}).get("firstSeen", now_ms)
            ),
            "appFirstSeen": bundle.get("appFirstSeen") or {},
            "patches": bundle.get("patches") or [],
            "isPreRelease": bool(bundle.get("isPreRelease")),
        }
        final_bundles.append(ordered_bundle)
    apps_store = {}
    for package_name, app_data in apps_dict.items():
        app_data.setdefault("firstSeen", now_ms)
        app_data.pop("updatedAt", None)
        app_entry = {
            "name": app_data.get("name"),
            "iconUrl": app_data.get("iconUrl"),
            "description": app_data.get("description"),
            "minInstalls": app_data.get("minInstalls"),
            "category": app_data.get("category"),
            "firstSeen": app_data.get("firstSeen"),
        }
        if "altName" in app_data:
            app_entry["altName"] = app_data["altName"]
        apps_store[package_name] = app_entry

    reindexed_compatibilities = []
    compat_map = {}
    for bundle in final_bundles:
        for patch in bundle.get("patches", []):
            if "compatiblePackagesKey" in patch:
                old_key = patch["compatiblePackagesKey"]
                compat_data = compatibilities_list[old_key]
                compat_json = json.dumps(compat_data, sort_keys=True)
                if compat_json in compat_map:
                    patch["compatiblePackagesKey"] = compat_map[compat_json]
                else:
                    new_key = len(reindexed_compatibilities)
                    reindexed_compatibilities.append(compat_data)
                    compat_map[compat_json] = new_key
                    patch["compatiblePackagesKey"] = new_key

    save_json(
        BUNDLES_JSON_PATH,
        {
            "bundles": final_bundles,
            "compatibilities": reindexed_compatibilities,
            "store": apps_store,
        },
    )
    print(
        f"Update completed. Saved {len(final_bundles)} bundles and {len(apps_store)} apps."
    )

    invalid_repos = [
        key
        for key in repos_data
        if key
        not in {f"{bundle['source']}:{bundle['repo']}" for bundle in final_bundles}
    ]
    if invalid_repos:
        print(
            f"::warning title=Update:: [-] Note: {len(invalid_repos)}/{len(repos_data)} repos are invalid or excluded: {', '.join(invalid_repos)}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
