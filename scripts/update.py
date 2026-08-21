# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import html
import json
import sys
import time
from pathlib import Path

from updater import gplay_scrape, local_parse, repo_info
from utils import append_step_summary, load_json, parse_timestamp, save_json

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
OFFICIAL_BUNDLES_PATH = DATA_DIR / "official-bundles.json"
BUNDLES_JSON_PATH = ROOT_DIR / "web" / "public" / "bundles.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Update Morphe patches and bundles")
    parser.add_argument("--daily", action="store_true", help="Daily update")
    parser.add_argument("--month", action="store_true", help="Monthly update")
    args = parser.parse_args()
    mode = "month" if args.month else "daily" if args.daily else "default"

    repos_data = load_json(REPOS_JSON_PATH, {})
    existing_bundles_data = load_json(BUNDLES_JSON_PATH, {})
    existing_bundles = {
        f"{bundle.get('source')}:{bundle.get('repo')}": bundle
        for bundle in existing_bundles_data.get("bundles", [])
    }
    apps_dict = existing_bundles_data.get("store", {})
    bundle_sources = {}
    for key in repos_data:
        source, repo = key.split(":", 1)
        existing = existing_bundles.get(key, {})
        bundle_sources[key] = {
            "source": source,
            "repo": repo,
            **{field: existing[field] for field in ("stars", "avatarUrl", "repoDescription", "appFirstSeen") if field in existing},
        }

    errors: dict[str, list[str]] = {"unavailable": [], "warnings": []}
    compatibilities_list = local_parse.process(bundle_sources, apps_dict, errors)
    repo_info.process(bundle_sources, mode, existing_bundles, errors)

    gplay_scrape.process(apps_dict, mode)
    official_ranks = {
        f"{source.lower()}:{repo.lower()}": bundle_entry.get("hotRank")
        for bundle_entry in load_json(OFFICIAL_BUNDLES_PATH, {}).get("bundles", [])
        if (source := bundle_entry.get("source")) and (repo := bundle_entry.get("repo"))
    }
    official_ranks["github:morpheapp/morphe-patches"] = -1

    now_ms = int(time.time() * 1000)
    sorted_keys = sorted(
        bundle_sources.keys(),
        key=lambda sort_key: (
            parse_timestamp(existing_bundles.get(sort_key, {}).get("firstSeen", bundle_sources[sort_key].get("updatedAt", 0))),
            sort_key.lower(),
        ),
    )
    final_bundles = []
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
            "firstSeen": parse_timestamp(existing_bundles.get(key, {}).get("firstSeen", now_ms)),
            **({"hotRank": hot_rank} if hot_rank is not None else {}),
            **({"isPreRelease": True} if bundle.get("isPreRelease") else {}),
            "appFirstSeen": bundle.get("appFirstSeen") or {},
            "patches": bundle.get("patches") or [],
        }
        final_bundles.append(ordered_bundle)

    app_patches_status: dict[str, list[bool]] = {}
    reindexed_compatibilities = []
    compat_map = {}
    for bundle in final_bundles:
        is_bundle_prerelease = bool(bundle.get("isPreRelease"))
        for patch in bundle.get("patches", []):
            is_patch_prerelease = is_bundle_prerelease or bool(patch.get("isPreRelease"))
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
                        app_patches_status.setdefault(package_name, []).append(is_patch_prerelease)
            else:
                app_patches_status.setdefault(local_parse.PACKAGE_UNIVERSAL, []).append(is_patch_prerelease)

    apps_store = {}
    incomplete_apps = []
    for package_name, app_data in apps_dict.items():
        app_data.setdefault("firstSeen", now_ms)
        app_data.pop("updatedAt", None)
        statuses = app_patches_status.get(package_name, [])
        name = app_data.get("name")
        alt_name = app_data.get("altName")
        icon_url = app_data.get("iconUrl")
        apps_store[package_name] = {
            "name": name,
            "iconUrl": icon_url,
            "description": html.unescape(app_data.get("description") or ""),
            "minInstalls": app_data.get("minInstalls"),
            "category": app_data.get("category"),
            "firstSeen": app_data.get("firstSeen"),
            **({"isPreRelease": True} if statuses and all(statuses) else {}),
            **({"altName": alt_name} if alt_name else {}),
        }
        if package_name not in (local_parse.PACKAGE_UNIVERSAL, "com.example.app"):
            issues = []
            if not icon_url:
                issues.append("missing icon")
            if not name and alt_name:
                issues.append("missing name")
            if issues:
                display_name = f" ({name or alt_name})" if (name or alt_name) else ""
                incomplete_apps.append(f"- `{package_name}`{display_name}: {', '.join(issues)}")

    save_json(
        BUNDLES_JSON_PATH,
        {"bundles": final_bundles, "compatibilities": reindexed_compatibilities, "store": apps_store},
    )
    print(f"Update completed. Saved {len(final_bundles)} bundles and {len(apps_store)} apps.")

    summary_sections = []
    final_bundle_keys = {f"{bundle['source']}:{bundle['repo']}" for bundle in final_bundles}
    invalid_repos = [key for key in repos_data if key not in final_bundle_keys]
    all_reported = errors["unavailable"] + errors["warnings"]
    reported_keys = {error.split("`")[1] for error in all_reported if "`" in error}
    for repo_key in sorted(invalid_repos):
        if repo_key not in reported_keys:
            errors["unavailable"].append(f"`{repo_key}`: Not found or no release bundle")

    if invalid_repos:
        note_message = f"Note: {len(invalid_repos)}/{len(repos_data)} repos are invalid or excluded"
        print(f"[-] {note_message}")
        update_lines = [f"## ⚠️ Update\n{note_message}:"]
        for category_name, category_icon, category_errors in (
            ("Unavailable", "⛔", errors["unavailable"]),
            ("Warnings", "⚠️", errors["warnings"]),
        ):
            if category_errors:
                sorted_errors = sorted(category_errors)
                print(f"  {category_name} ({len(sorted_errors)}):")
                for error in sorted_errors:
                    print(f"    - {error}")
                update_lines.append(
                    f"### {category_icon} {category_name} ({len(sorted_errors)})\n"
                    + "\n".join(f"- {error}" for error in sorted_errors)
                )

        summary_sections.append("\n\n".join(update_lines))

    if incomplete_apps:
        sorted_incomplete_apps = sorted(incomplete_apps)
        print(
            f"[-] Note: {len(sorted_incomplete_apps)} apps have incomplete metadata (missing icon/name):"
        )
        for app_issue in sorted_incomplete_apps:
            print(f"  {app_issue}")
        summary_sections.append(
            f"### 📱 Incomplete Apps ({len(sorted_incomplete_apps)})\n"
            + "\n".join(sorted_incomplete_apps)
        )

    if summary_sections:
        append_step_summary("\n\n".join(summary_sections))
    return 0


if __name__ == "__main__":
    sys.exit(main())
