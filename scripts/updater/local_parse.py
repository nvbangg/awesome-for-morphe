# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import json
import re
import time
from typing import Any

from utils import (
    BUNDLES_DIR,
    DEFAULT_BRANCHES,
    PACKAGE_EXAMPLE,
    PACKAGE_UNIVERSAL,
    PATCHES_DIR,
    REPOS_JSON_PATH,
    build_repo_url,
    load_json,
    parse_timestamp,
)

_BUNDLE_NAME_SUFFIX_RE = re.compile(
    r"(?i)(?: for use with morphe| for morphe|['\u2019]s morphe patches|['\u2019]s patches| morphe| patches| patch)+$"
)


def parse_version_item(item: Any) -> dict | None:
    if isinstance(item, str):
        return {"version": item}
    if isinstance(item, dict) and "version" in item:
        entry = {"version": item["version"]}
        if item.get("isExperimental"):
            entry["isExperimental"] = True
        return entry
    return None


def strip_patch(patch: dict, discovered_names: dict[str, str]) -> dict | None:
    if not isinstance(patch, dict) or not (name := patch.get("name")):
        return None

    output: dict = {"name": name}
    if desc := patch.get("description"):
        output["description"] = desc
    if patch.get("isPreRelease"):
        output["isPreRelease"] = True
    if patch.get("default") is False:
        output["default"] = False

    if options := patch.get("options"):
        options_list = []
        for opt in options:
            if isinstance(opt, dict) and "key" in opt:
                opt_entry = {"key": opt["key"]}
                if opt.get("title"):
                    opt_entry["title"] = opt["title"]
                if opt.get("description"):
                    opt_entry["description"] = opt["description"]
                options_list.append(opt_entry)
        if options_list:
            output["options"] = options_list

    compatible_packages = patch.get("compatiblePackages")
    package_entries = (
        [
            (package_name, versions, None)
            for package_name, versions in compatible_packages.items()
        ]
        if isinstance(compatible_packages, dict)
        else [
            (
                entry.get("packageName"),
                entry.get("targets", []),
                entry.get("name"),
            )
            for entry in compatible_packages
            if isinstance(entry, dict) and entry.get("packageName")
        ]
        if isinstance(compatible_packages, list)
        else []
    )

    compatibility_targets = []
    for package_name, versions, app_name in package_entries:
        if app_name:
            discovered_names[package_name] = app_name
        targets = [
            parsed
            for version_item in (versions or [])
            if (parsed := parse_version_item(version_item))
        ]
        target_entry = {"packageName": package_name}
        if targets:
            target_entry["targets"] = targets
        compatibility_targets.append(target_entry)

    if compatibility_targets:
        output["compatiblePackages"] = compatibility_targets
    return output


def parse_patches_list(
    raw_patches_data: Any,
    discovered_names: dict[str, str],
    is_dev_branch: bool = False,
    main_patch_names: set[str] | None = None,
) -> tuple[list[dict] | None, str | None]:
    if raw_patches_data is None or raw_patches_data == "":
        return None, "Invalid `patches-list.json`"

    raw_list = (
        raw_patches_data.get("patches")
        if isinstance(raw_patches_data, dict)
        else (raw_patches_data if isinstance(raw_patches_data, list) else None)
    )
    if raw_list is None:
        return None, "Invalid `patches-list.json`"
    if len(raw_list) == 0:
        return None, "Empty `patches-list.json`"

    valid_patches = []
    bundle_apps = set()
    for patch in raw_list:
        if not isinstance(patch, dict) or not (name := patch.get("name")):
            continue
        if is_dev_branch and main_patch_names and name not in main_patch_names:
            patch["isPreRelease"] = True
        if not (patch_dict := strip_patch(patch, discovered_names)):
            continue
        compat_packages = patch_dict.get("compatiblePackages")
        if compat_packages:
            for item in compat_packages:
                if package_name := item.get("packageName"):
                    bundle_apps.add(package_name)
        else:
            bundle_apps.add(PACKAGE_UNIVERSAL)
        valid_patches.append(patch_dict)

    if not valid_patches:
        return None, "Invalid `patches-list.json`"
    if bundle_apps == {PACKAGE_EXAMPLE}:
        return None, 'Only contains "com.example.app"'

    return valid_patches, None


def load_branch_data(
    file_prefix: str,
    branch: str,
    has_sha: bool,
    discovered_names: dict[str, str],
    is_dev_branch: bool = False,
    main_patch_names: set[str] | None = None,
) -> tuple[dict | None, list[dict] | None, str | None]:
    if not has_sha:
        return None, None, "Missing `patches-bundle.json`"
    bundle_file = BUNDLES_DIR / f"{file_prefix}~{branch}.json"
    list_file = PATCHES_DIR / f"{file_prefix}~{branch}.json"
    if not bundle_file.exists():
        return None, None, "Missing `patches-bundle.json`"
    bundle = load_json(bundle_file)
    if not isinstance(bundle, dict) or not bundle.get("download_url"):
        return None, None, "Missing `download_url` in `patches-bundle.json`"
    if not list_file.exists():
        return None, None, "Missing `patches-list.json`"
    raw = load_json(list_file)
    patches, reason = parse_patches_list(
        raw,
        discovered_names,
        is_dev_branch=is_dev_branch,
        main_patch_names=main_patch_names,
    )
    if not patches:
        return None, None, reason
    return bundle, patches, None


def process(
    bundle_sources: dict,
    apps_dict: dict,
    errors: dict[str, list[str]] | None = None,
) -> list:
    compatibilities_list = []
    compatibilities_map = {}

    def get_compat_key(compatibility_data: list) -> int:
        compatibility_json = json.dumps(compatibility_data, sort_keys=True)
        if compatibility_json in compatibilities_map:
            return compatibilities_map[compatibility_json]
        index = len(compatibilities_list)
        compatibilities_list.append(compatibility_data)
        compatibilities_map[compatibility_json] = index
        return index

    repos_data = load_json(REPOS_JSON_PATH, {})
    valid_target_files = {
        f"{repo.replace('/', '~')}~{branch}.json"
        for repo, repo_metadata in repos_data.items()
        if isinstance(repo_metadata, dict)
        for source in ("github", "gitlab")
        if isinstance(repo_metadata.get(source), dict)
        for branch in DEFAULT_BRANCHES
    }
    for directory in (BUNDLES_DIR, PATCHES_DIR):
        if directory.exists():
            for filepath in directory.glob("*.json"):
                if filepath.name not in valid_target_files:
                    filepath.unlink(missing_ok=True)

    keys_to_remove = []
    valid_apps_from_bundles = set()
    now_ms = int(time.time() * 1000)

    print(f"\nParsing local patches and bundles for {len(bundle_sources)} sources...")
    for repo, source_entry in bundle_sources.items():
        if not repo or "/" not in repo:
            continue
        owner, repo_name = repo.split("/", 1)
        file_prefix = f"{owner}~{repo_name}"
        repo_metadata = repos_data.get(repo, {})
        chosen_source = None
        main_bundle = None
        main_patches = None
        dev_bundle = None
        dev_patches = None
        discovered_names = {}
        has_sha = False
        fail_reason = None

        for source in ("github", "gitlab"):
            source_metadata = repo_metadata.get(source)
            if not isinstance(source_metadata, dict):
                continue
            main_sha = source_metadata.get("main")
            dev_sha = source_metadata.get("dev")
            if not main_sha and not dev_sha:
                fail_reason = "Missing `patches-bundle.json`"
                continue
            has_sha = True

            cur_discovered_names = {}
            cur_main_bundle, cur_main_patches, main_reason = load_branch_data(
                file_prefix, "main", bool(main_sha), cur_discovered_names
            )
            main_patch_names = (
                {patch["name"] for patch in cur_main_patches if "name" in patch}
                if cur_main_patches
                else set()
            )
            cur_dev_bundle, cur_dev_patches, dev_reason = load_branch_data(
                file_prefix,
                "dev",
                bool(dev_sha),
                cur_discovered_names,
                is_dev_branch=True,
                main_patch_names=main_patch_names,
            )

            if cur_main_patches or cur_dev_patches:
                chosen_source = source
                main_bundle = cur_main_bundle
                main_patches = cur_main_patches
                dev_bundle = cur_dev_bundle
                dev_patches = cur_dev_patches
                discovered_names = cur_discovered_names
                break

            fail_reason = main_reason or dev_reason

        if not chosen_source:
            keys_to_remove.append(repo)
            message = fail_reason or (
                "Missing `patches-list.json`"
                if has_sha
                else "Missing `patches-bundle.json`"
            )
            print(f"[-] Excluding {repo}: {message}")
            if errors is not None:
                for source in ("github", "gitlab"):
                    if source in repo_metadata:
                        repo_url = build_repo_url(source, repo)
                        errors["unavailable"].append(f"{repo_url}: {message}")
            continue

        source_entry["source"] = chosen_source

        main_timestamp = (
            parse_timestamp(main_bundle.get("created_at"))
            if main_patches and main_bundle
            else 0
        )
        dev_timestamp = (
            parse_timestamp(dev_bundle.get("created_at"))
            if dev_patches and dev_bundle
            else 0
        )
        is_latest_dev = bool(
            dev_patches and (not main_patches or dev_timestamp > main_timestamp)
        )

        source_entry["isPreRelease"] = not bool(main_patches)
        source_entry["updatedAt"] = dev_timestamp if is_latest_dev else main_timestamp

        raw_name = repo_metadata.get("name") or ""
        if raw_name:
            raw_name = (
                ""
                if raw_name.lower() == "morphe patches"
                else _BUNDLE_NAME_SUFFIX_RE.sub("", raw_name).strip("- ")
            )
        source_entry["name"] = raw_name or owner

        chosen_patches = dev_patches if is_latest_dev else main_patches
        app_first_seen_map = (
            source_entry.get("appFirstSeen")
            if isinstance(source_entry.get("appFirstSeen"), dict)
            else {}
        )
        has_universal_patch = False

        for patch_dict in chosen_patches:
            compat_packages = patch_dict.pop("compatiblePackages", None)
            if compat_packages:
                for compat_package in compat_packages:
                    package_name = compat_package.get("packageName")
                    if package_name and package_name != PACKAGE_UNIVERSAL:
                        valid_apps_from_bundles.add(package_name)
                        apps_dict.setdefault(package_name, {})
                        if (
                            app_name := discovered_names.get(package_name)
                        ) and not apps_dict[package_name].get("name"):
                            apps_dict[package_name]["name"] = app_name
                        if package_name not in app_first_seen_map:
                            app_first_seen_map[package_name] = now_ms
                patch_dict["compatiblePackagesKey"] = get_compat_key(compat_packages)
            else:
                has_universal_patch = True

        if has_universal_patch and PACKAGE_UNIVERSAL not in app_first_seen_map:
            app_first_seen_map[PACKAGE_UNIVERSAL] = now_ms

        source_entry["patches"] = chosen_patches
        source_entry["appFirstSeen"] = app_first_seen_map

    for key in keys_to_remove:
        bundle_sources.pop(key, None)

    apps_to_remove = [
        package_name
        for package_name in list(apps_dict.keys())
        if package_name not in valid_apps_from_bundles
        and package_name != PACKAGE_UNIVERSAL
    ]
    for package_name in apps_to_remove:
        del apps_dict[package_name]
        print(f"[-] Removed app '{package_name}' (no longer supported by any bundle)")

    return compatibilities_list
