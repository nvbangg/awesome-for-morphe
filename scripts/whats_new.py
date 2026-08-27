# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import urllib.parse
from datetime import UTC, datetime, timedelta

from utils import (
    BUNDLES_JSON_PATH,
    HISTORY_PATH,
    PACKAGE_EXAMPLE,
    PACKAGE_UNIVERSAL,
    WHATS_NEW_JSON_PATH,
    WHATS_NEW_PATH,
    append_step_summary,
    load_json,
    save_json,
)

WHATS_NEW_MAX_ENTRIES = 21


def is_valid_package_name(package_name: str) -> bool:
    return (
        "." in package_name
        and " " not in package_name
        and package_name not in (PACKAGE_UNIVERSAL, PACKAGE_EXAMPLE)
    )


def format_app_name(package_name: str, app_metadata: dict) -> str:
    metadata = app_metadata.get(package_name)
    if isinstance(metadata, dict):
        return metadata.get("name") or metadata.get("altName") or package_name
    return metadata if isinstance(metadata, str) else package_name


def make_url(
    bundle_source: str | None = None,
    bundle_repo: str | None = None,
    app: str | None = None,
    patch: str | None = None,
) -> str:
    query = {}
    if patch and app:
        query["app"] = app
        query["patch"] = patch
    elif app:
        query["app"] = app
    elif bundle_source and bundle_repo:
        query[bundle_source] = bundle_repo

    base_url = "https://awesome-morphe.vercel.app/"
    if query:
        query_string = urllib.parse.urlencode(
            query, quote_via=urllib.parse.quote_plus
        ).replace("%2F", "/")
        return f"{base_url}?{query_string}#whats-new"
    return f"{base_url}#whats-new"


def extract_bundle_metadata(
    bundles: list[dict],
) -> tuple[dict[str, str], dict[str, str], dict[str, int]]:
    def bundle_sort_key(bundle: dict) -> tuple:
        hot_rank = bundle.get("hotRank")
        name = (bundle.get("name") or bundle.get("repo", "")).lower()
        updated_at = bundle.get("updatedAt", 0)
        if hot_rank is not None:
            return (0, hot_rank, -updated_at, name)
        return (1, 9999, -updated_at, name)

    sorted_bundles = sorted(bundles, key=bundle_sort_key)
    bundle_order = {
        bundle["repo"]: index
        for index, bundle in enumerate(sorted_bundles)
        if bundle.get("repo")
    }
    names = {
        bundle["repo"]: bundle.get("name") or bundle["repo"].split("/")[-1]
        for bundle in bundles
        if bundle.get("repo")
    }
    sources = {
        bundle["repo"]: bundle.get("source") or "github"
        for bundle in bundles
        if bundle.get("repo")
    }
    return names, sources, bundle_order


def build_new_bundles(bundles_json: dict) -> dict:
    compatibilities = bundles_json.get("compatibilities", [])
    new_bundles = {}

    for bundle in bundles_json.get("bundles", []):
        if not (repo := bundle.get("repo")):
            continue
        patches_dict = {}

        for patch in bundle.get("patches", []):
            if not (patch_name := patch.get("name")):
                continue

            compat_key = patch.get("compatiblePackagesKey")
            if compat_key is not None and compat_key < len(compatibilities):
                for item in compatibilities[compat_key]:
                    if (
                        isinstance(item, dict)
                        and (package_name := item.get("packageName"))
                        and is_valid_package_name(package_name)
                    ):
                        patches_dict.setdefault(package_name, set()).add(patch_name)

        if patches_dict:
            new_bundles[repo] = {
                package_name: sorted(patches_dict[package_name])
                for package_name in sorted(patches_dict)
            }
    return dict(sorted(new_bundles.items(), key=lambda item: item[0].lower()))


def build_json_diff(
    old_bundles: dict,
    new_bundles: dict,
    app_metadata: dict,
    bundle_order: dict[str, int],
) -> dict:
    json_diff = {}

    def app_sort_key(package_name: str) -> tuple:
        metadata = app_metadata.get(package_name)
        if isinstance(metadata, dict):
            return (
                -metadata.get("minInstalls", 0),
                metadata.get("firstSeen", 0),
                (
                    metadata.get("name") or metadata.get("altName") or package_name
                ).lower(),
            )
        return (0, 0, package_name.lower())

    for repo, patches_dict in sorted(
        new_bundles.items(),
        key=lambda item: (
            0 if item[0] not in old_bundles else 1,
            bundle_order.get(item[0], 9999),
        ),
    ):
        if repo not in old_bundles:
            apps = {
                package_name: {
                    "patches": sorted(patches_dict[package_name]),
                    "isNew": True,
                }
                for package_name in sorted(patches_dict, key=app_sort_key)
            }
            if apps:
                json_diff[repo] = {
                    "apps": apps,
                    "isNew": True,
                }
        else:
            old_patches_dict = old_bundles[repo]
            apps_dict = {}

            for package_name in sorted(
                patches_dict,
                key=lambda package_name: (
                    0 if package_name not in old_patches_dict else 1,
                    *app_sort_key(package_name),
                ),
            ):
                if package_name not in old_patches_dict:
                    apps_dict[package_name] = {
                        "patches": sorted(patches_dict[package_name]),
                        "isNew": True,
                    }
                elif added_patches := set(patches_dict[package_name]) - set(
                    old_patches_dict.get(package_name, [])
                ):
                    apps_dict[package_name] = {"patches": sorted(added_patches)}

            if apps_dict:
                json_diff[repo] = {
                    "apps": apps_dict,
                }
    return json_diff


def generate_markdown(
    json_diff: dict,
    app_metadata: dict,
    bundle_names: dict,
    bundle_sources: dict,
) -> str:
    markdown_lines = []

    for repo, bundle_data in json_diff.items():
        is_new_bundle = bundle_data.get("isNew", False)
        apps_data = bundle_data.get("apps", {})
        if not apps_data:
            continue

        display_name = bundle_names.get(repo) or repo.split("/")[-1]
        source = bundle_sources.get(repo, "github")
        owner = repo.split("/")[0] if "/" in repo else ""
        owner_suffix = (
            f" (by {owner})" if owner and display_name.lower() != owner.lower() else ""
        )

        if is_new_bundle:
            bundle_url = make_url(bundle_source=source, bundle_repo=repo)
            bundle_md = [f"+ 📦 (✨New) [{display_name}]({bundle_url}){owner_suffix}"]
            for package_name in apps_data:
                app_name = format_app_name(package_name, app_metadata)
                app_url = make_url(app=package_name)
                bundle_md.append(f"    - 📱 [{app_name}]({app_url})")
            markdown_lines.append("\n".join(bundle_md))
        else:
            bundle_md = [f"- 📦 {display_name}{owner_suffix}"]
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
    return f"✨ [_View full changelog_]({full_url})\n\n" + "\n".join(markdown_lines)


def main() -> None:
    old_history = load_json(HISTORY_PATH, {})
    whats_new_data = load_json(WHATS_NEW_JSON_PATH, [])
    bundles_json = load_json(BUNDLES_JSON_PATH, {})
    app_metadata = bundles_json.get("store", {})
    bundle_names, bundle_sources, bundle_order = extract_bundle_metadata(
        bundles_json.get("bundles", [])
    )

    current_time = datetime.now(UTC) - timedelta(hours=12)
    today_str = current_time.strftime(f"%B {current_time.day}, %Y")

    new_bundles = build_new_bundles(bundles_json)
    json_diff = build_json_diff(old_history, new_bundles, app_metadata, bundle_order)

    if not json_diff:
        print("No changes detected in patch bundles. Skipping What's New generation.")
        return

    latest_entry = (
        whats_new_data[0]
        if whats_new_data and isinstance(whats_new_data[0], dict)
        else {}
    )
    if latest_entry.get("date") == today_str:
        warning_message = f"Date '{today_str}' already exists in `{WHATS_NEW_JSON_PATH.name}`. Skipping What's New generation."
        print(f"[-] {warning_message}")
        append_step_summary(f"### ⚠️ What's new\n- {warning_message}")
        return

    if markdown_str := generate_markdown(
        json_diff, app_metadata, bundle_names, bundle_sources
    ):
        WHATS_NEW_PATH.write_text(markdown_str + "\n", encoding="utf-8")
        print(f"Generated {WHATS_NEW_PATH.name}")

    whats_new_data.insert(0, {"date": today_str, "bundles": json_diff})
    save_json(WHATS_NEW_JSON_PATH, whats_new_data[:WHATS_NEW_MAX_ENTRIES])
    print(f"Updated {WHATS_NEW_JSON_PATH.name}")

    save_json(HISTORY_PATH, new_bundles)
    print(f"Saved baseline to {HISTORY_PATH.name}")


if __name__ == "__main__":
    main()
