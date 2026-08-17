# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import html
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
OFFICIAL_BUNDLES_PATH = DATA_DIR / "official-bundles.json"
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
                "appFirstSeen",
            ]:
                if attribute_name in existing_bundles[key]:
                    bundle_sources[key][attribute_name] = existing_bundles[key][
                        attribute_name
                    ]
    repo_info.process(bundle_sources, mode, existing_bundles)
    compatibilities_list = local_parse.process(bundle_sources, apps_dict)

    gplay_scrape.process(apps_dict, mode, existing_apps)
    official_data = load_json(OFFICIAL_BUNDLES_PATH, {})
    official_bundles_list = (
        official_data.get("bundles", []) if isinstance(official_data, dict) else []
    )
    official_ranks = {}
    for bundle_entry in official_bundles_list:
        source = bundle_entry.get("source")
        repo = bundle_entry.get("repo")
        if source and repo:
            official_ranks[f"{source.lower()}:{repo.lower()}"] = bundle_entry.get(
                "hotRank"
            )
    official_ranks["github:morpheapp/morphe-patches"] = -1

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
        hot_rank = official_ranks.get(key.lower())

        ordered_bundle = {
            "source": bundle.get("source") or "",
            "repo": bundle.get("repo") or "",
            "name": bundle.get("name") or "",
            "repoDescription": html.unescape(bundle.get("repoDescription") or ""),
            "avatarUrl": bundle.get("avatarUrl") or "",
            "stars": bundle.get("stars") or 0,
            "updatedAt": bundle.get("updatedAt") or 0,
            "firstSeen": parse_timestamp(
                existing_bundles.get(key, {}).get("firstSeen", now_ms)
            ),
        }
        if hot_rank is not None:
            ordered_bundle["hotRank"] = hot_rank
        if bundle.get("isPreRelease"):
            ordered_bundle["isPreRelease"] = True
        ordered_bundle["appFirstSeen"] = bundle.get("appFirstSeen") or {}
        ordered_bundle["patches"] = bundle.get("patches") or []
        final_bundles.append(ordered_bundle)
    app_patches_status: dict[str, list[bool]] = {}
    reindexed_compatibilities = []
    compat_map = {}
    for bundle in final_bundles:
        is_bundle_prerelease = bool(bundle.get("isPreRelease"))
        for patch in bundle.get("patches", []):
            is_patch_prerelease = is_bundle_prerelease or bool(
                patch.get("isPreRelease")
            )
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
                for compat_entry in compat_data:
                    package_name = compat_entry.get("packageName")
                    if package_name:
                        app_patches_status.setdefault(package_name, []).append(
                            is_patch_prerelease
                        )
            else:
                app_patches_status.setdefault(
                    local_parse.PACKAGE_UNIVERSAL, []
                ).append(is_patch_prerelease)

    apps_store = {}
    for package_name, app_data in apps_dict.items():
        app_data.setdefault("firstSeen", now_ms)
        app_data.pop("updatedAt", None)
        statuses = app_patches_status.get(package_name, [])
        is_app_prerelease = bool(statuses and all(statuses))
        app_entry = {
            "name": app_data.get("name"),
            "iconUrl": app_data.get("iconUrl"),
            "description": html.unescape(app_data.get("description") or ""),
            "minInstalls": app_data.get("minInstalls"),
            "category": app_data.get("category"),
            "firstSeen": app_data.get("firstSeen"),
        }
        if is_app_prerelease:
            app_entry["isPreRelease"] = True
        if "altName" in app_data:
            app_entry["altName"] = app_data["altName"]
        apps_store[package_name] = app_entry

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
