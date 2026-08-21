# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import urllib.parse
from datetime import UTC, datetime, timedelta
from pathlib import Path

from updater.local_parse import PACKAGE_UNIVERSAL
from utils import load_json, save_json

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
PUBLIC_DIR = ROOT_DIR / "web" / "public"
HISTORY_PATH = DATA_DIR / "history.json"
BUNDLES_JSON_PATH = PUBLIC_DIR / "bundles.json"
WHATS_NEW_PATH = ROOT_DIR / "whats-new.md"
WHATS_NEW_JSON_PATH = PUBLIC_DIR / "whats-new.json"
WHATS_NEW_MAX_ENTRIES = 21


def get_bundle_names(bundles_json: dict) -> dict[str, str]:
    return {
        f"{bundle['source']}:{bundle['repo']}": bundle.get(
            "name", bundle["repo"].split("/")[-1]
        )
        for bundle in bundles_json.get("bundles", [])
    }


def build_new_bundles(bundles_json: dict) -> dict:
    compatibilities = bundles_json.get("compatibilities", [])
    new_bundles = {}

    for bundle in bundles_json.get("bundles", []):
        base = f"{bundle['source']}:{bundle['repo']}"
        patches_dict = {}

        for patch in bundle.get("patches", []):
            if not (patch_name := patch.get("name")):
                continue

            package_names = set()
            compat_key = patch.get("compatiblePackagesKey")
            if compat_key is not None and compat_key < len(compatibilities):
                for item in compatibilities[compat_key]:
                    if isinstance(item, dict) and (
                        package_name := item.get("packageName")
                    ):
                        package_names.add(package_name)

            for package_name in package_names or {PACKAGE_UNIVERSAL}:
                patches_dict.setdefault(package_name, set()).add(patch_name)

        if patches_dict:
            new_bundles[base] = {
                package_name: sorted(patches_dict[package_name])
                for package_name in sorted(patches_dict)
            }
    return new_bundles


def format_app_name(package_name: str, app_metadata: dict) -> str:
    meta = app_metadata.get(package_name)
    if isinstance(meta, dict):
        return meta.get("name") or meta.get("altName") or package_name
    if isinstance(meta, str):
        return meta
    return package_name


def make_url(
    bundle: str | None = None, app: str | None = None, patch: str | None = None
) -> str:
    query = {}
    if patch and app:
        query["app"] = app
        query["patch"] = patch
    elif app:
        query["app"] = app
    elif bundle and ":" in bundle:
        source, repo = bundle.split(":", 1)
        query[source] = repo

    base_url = "https://awesome-morphe.vercel.app/"
    if query:
        query_string = urllib.parse.urlencode(
            query, quote_via=urllib.parse.quote_plus
        ).replace("%2F", "/")
        return f"{base_url}?{query_string}#whats-new"
    return f"{base_url}#whats-new"


def is_valid_package_name(package_name: str) -> bool:
    return (
        "." in package_name and " " not in package_name
    ) or package_name == PACKAGE_UNIVERSAL


def build_json_diff(
    old_bundles: dict, new_bundles: dict, app_metadata: dict, bundle_names: dict
) -> dict:
    json_diff = {}

    def app_sort_key(package_name: str) -> tuple[bool, str]:
        return (
            package_name == PACKAGE_UNIVERSAL,
            format_app_name(package_name, app_metadata).lower(),
        )

    for key, patches_dict in sorted(
        new_bundles.items(), key=lambda item: item[0].lower()
    ):
        new_package_names = {
            package_name
            for package_name in patches_dict
            if is_valid_package_name(package_name)
        }
        display_name = bundle_names.get(key, key.split("/")[-1] if "/" in key else key)
        source, repo = key.split(":", 1) if ":" in key else ("github", key)

        if key not in old_bundles:
            apps = {}
            for package_name in sorted(new_package_names, key=app_sort_key):
                apps[package_name] = {
                    "patches": sorted(patches_dict.get(package_name, [])),
                    "isNew": True,
                }
            json_diff[display_name] = {
                "source": source,
                "repo": repo,
                "apps": apps,
                "isNew": True,
            }
        else:
            old_patches_dict = old_bundles[key]
            old_package_names = {
                package_name
                for package_name in old_patches_dict
                if is_valid_package_name(package_name)
            }
            apps_dict = {}

            for package_name in sorted(new_package_names, key=app_sort_key):
                if package_name not in old_package_names:
                    apps_dict[package_name] = {
                        "patches": sorted(patches_dict.get(package_name, [])),
                        "isNew": True,
                    }
                else:
                    added_patches = set(patches_dict.get(package_name, [])) - set(
                        old_patches_dict.get(package_name, [])
                    )
                    if added_patches:
                        apps_dict[package_name] = {
                            "patches": sorted(added_patches),
                        }

            if apps_dict:
                json_diff[display_name] = {
                    "source": source,
                    "repo": repo,
                    "apps": apps_dict,
                }
    return json_diff


def generate_markdown(json_diff: dict, app_metadata: dict) -> str:
    markdown_lines = []

    for display_name, bundle_data in json_diff.items():
        is_new_bundle = bundle_data.get("isNew", False)
        apps_data = bundle_data.get("apps", {})
        source = bundle_data.get("source", "github")
        repo = bundle_data.get("repo", "")
        bundle_key = f"{source}:{repo}" if repo else display_name

        if is_new_bundle:
            bundle_url = make_url(bundle=bundle_key)
            bundle_md = [f"+ 📦 (✨New) [{display_name}]({bundle_url})"]
            for package_name in apps_data:
                app_name = format_app_name(package_name, app_metadata)
                app_url = make_url(app=package_name)
                bundle_md.append(f"    - 📱 [{app_name}]({app_url})")
            markdown_lines.append("\n".join(bundle_md))
        else:
            bundle_md = [f"- 📦 {display_name}"]
            for package_name, app_data in apps_data.items():
                app_name = format_app_name(package_name, app_metadata)
                if app_data.get("isNew", False):
                    app_url = make_url(app=package_name)
                    bundle_md.append(f"    + 📱 (✨New) [{app_name}]({app_url})")
                else:
                    bundle_md.append(f"    - 📱 {app_name}")
                    for patch_name in sorted(app_data.get("patches", [])):
                        patch_url = make_url(app=package_name, patch=patch_name)
                        bundle_md.append(f"        + 🧩 [{patch_name}]({patch_url})")
            markdown_lines.append("\n".join(bundle_md))

    if not markdown_lines:
        return ""

    full_url = "https://awesome-morphe.vercel.app/#whats-new"
    return f"✨ [_View full changelog_]({full_url})\n\n" + "\n\n".join(markdown_lines)


def main() -> None:
    old_history = load_json(HISTORY_PATH, {})
    whats_new_data = load_json(WHATS_NEW_JSON_PATH, [])
    bundles_json = load_json(BUNDLES_JSON_PATH, {})
    app_metadata = bundles_json.get("store", {})
    bundle_names = get_bundle_names(bundles_json)

    current_time = datetime.now(UTC) - timedelta(hours=12)
    today_str = current_time.strftime(f"%B {current_time.day}, %Y")

    new_bundles = build_new_bundles(bundles_json)
    json_diff = build_json_diff(old_history, new_bundles, app_metadata, bundle_names)

    if not json_diff:
        print("No changes detected in patch bundles. Skipping What's New generation.")
        return

    if markdown_str := generate_markdown(json_diff, app_metadata):
        WHATS_NEW_PATH.write_text(markdown_str + "\n", encoding="utf-8")
        print(f"Generated {WHATS_NEW_PATH.name}")

    whats_new_data.insert(0, {"date": today_str, "bundles": json_diff})
    save_json(WHATS_NEW_JSON_PATH, whats_new_data[:WHATS_NEW_MAX_ENTRIES])
    print(f"Updated {WHATS_NEW_JSON_PATH.name}")

    save_json(HISTORY_PATH, new_bundles)
    print(f"Saved baseline to {HISTORY_PATH.name}")


if __name__ == "__main__":
    main()
