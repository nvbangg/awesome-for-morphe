# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import json
import re
import time
from pathlib import Path
from typing import Any

from utils import load_json, parse_timestamp

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
BUNDLES_DIR = DATA_DIR / "bundles"
PATCHES_DIR = DATA_DIR / "patches"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
PACKAGE_UNIVERSAL = "__universal__"


def parse_version_item(item: Any) -> dict[str, Any] | None:
    if isinstance(item, str):
        return {"version": item}
    if isinstance(item, dict) and "version" in item:
        result: dict[str, Any] = {"version": item["version"]}
        if item.get("isExperimental"):
            result["isExperimental"] = True
        return result
    return None


def strip_patch(
    patch: dict[str, Any], discovered_names: dict[str, str]
) -> dict[str, Any] | None:
    output: dict[str, Any] = {}
    if "name" in patch:
        output["name"] = patch["name"]
    if patch.get("description"):
        output["description"] = patch["description"]
    if patch.get("isPreRelease"):
        output["isPreRelease"] = True
    if patch.get("default") is False:
        output["default"] = False
    if "options" in patch:
        options_list = []
        for option_item in patch["options"]:
            option_object = {}
            if "key" in option_item:
                option_object["key"] = option_item["key"]
            if option_item.get("title"):
                option_object["title"] = option_item["title"]
            if option_item.get("description"):
                option_object["description"] = option_item["description"]
            if option_object:
                options_list.append(option_object)
        if options_list:
            output["options"] = options_list
    compatible_packages = patch.get("compatiblePackages")
    compatibility_targets = []
    has_real_app = False
    if isinstance(compatible_packages, dict):
        for package_name, versions in compatible_packages.items():
            has_real_app = True
            targets = []
            if versions:
                for version_item in versions:
                    if parsed_version := parse_version_item(version_item):
                        targets.append(parsed_version)
            package_out = {"packageName": package_name}
            if targets:
                package_out["targets"] = targets
            compatibility_targets.append(package_out)
    elif isinstance(compatible_packages, list):
        for entry in compatible_packages:
            if not isinstance(entry, dict):
                continue
            package_name = entry.get("packageName")
            if not package_name:
                continue
            if name := entry.get("name"):
                discovered_names[package_name] = name
            has_real_app = True
            targets = []
            for target_item in entry.get("targets", []):
                if parsed_version := parse_version_item(target_item):
                    targets.append(parsed_version)
            package_out = {"packageName": package_name}
            if targets:
                package_out["targets"] = targets
            compatibility_targets.append(package_out)
    if has_real_app and compatibility_targets:
        output["compatiblePackages"] = compatibility_targets
    return output


def process(bundle_sources: dict[str, Any], apps_dict: dict[str, Any]) -> list:
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
    keys_to_remove = []
    valid_apps_from_bundles = set()

    print(f"\nParsing local patches and bundles for {len(bundle_sources)} sources...")
    for base_key, source_entry in bundle_sources.items():
        source = source_entry.get("source")
        owner_repo = source_entry.get("repo")
        if not source or not owner_repo:
            continue
        try:
            owner, repo_name = owner_repo.split("/", 1)
        except ValueError:
            continue
        file_prefix = f"{source}~{owner}~{repo_name}"
        main_bundle_path = BUNDLES_DIR / f"{file_prefix}~main.json"
        main_list_path = PATCHES_DIR / f"{file_prefix}~main.json"
        dev_bundle_path = BUNDLES_DIR / f"{file_prefix}~dev.json"
        dev_list_path = PATCHES_DIR / f"{file_prefix}~dev.json"
        main_json = (
            load_json(main_bundle_path)
            if main_bundle_path.exists() and main_list_path.exists()
            else None
        )
        dev_json = (
            load_json(dev_bundle_path)
            if dev_bundle_path.exists() and dev_list_path.exists()
            else None
        )
        if not main_json and not dev_json:
            keys_to_remove.append(base_key)
            continue
        main_timestamp = (
            parse_timestamp(main_json["created_at"])
            if main_json and "created_at" in main_json
            else 0
        )
        dev_timestamp = (
            parse_timestamp(dev_json["created_at"])
            if dev_json and "created_at" in dev_json
            else 0
        )
        is_latest_dev = bool(dev_json and dev_timestamp > main_timestamp)
        list_path = (
            dev_list_path
            if is_latest_dev
            else (main_list_path if main_json else dev_list_path)
        )
        updated_at = (
            dev_timestamp
            if is_latest_dev
            else (main_timestamp if main_json else dev_timestamp)
        )
        source_entry["isPreRelease"] = not bool(main_json)
        source_entry["updatedAt"] = updated_at
        main_patch_names = set()
        if is_latest_dev and main_json and main_list_path.exists():
            main_list_raw = load_json(main_list_path, [])
            main_patches_raw = (
                main_list_raw.get("patches", [])
                if isinstance(main_list_raw, dict)
                else main_list_raw
            )
            if isinstance(main_patches_raw, list):
                main_patch_names = {
                    patch.get("name")
                    for patch in main_patches_raw
                    if isinstance(patch, dict) and patch.get("name")
                }
        patches_list_json = load_json(list_path, [])
        if isinstance(patches_list_json, list):
            patches_list_json = {"patches": patches_list_json}
        existing_name = source_entry.get("name")
        repo_name_from_json = (
            repos_data.get(base_key, {}).get("name")
            if isinstance(repos_data.get(base_key), dict)
            else None
        )
        bundle_name = repo_name_from_json or existing_name
        cleaned_name = bundle_name if bundle_name else ""
        if cleaned_name:
            if cleaned_name.lower() == "morphe patches":
                cleaned_name = ""
            else:
                pattern = re.compile(
                    r"(?i)(?: for use with morphe| for morphe|['']s morphe patches|['']s patches| morphe| patches| patch)+$"
                )
                cleaned_name = pattern.sub("", cleaned_name).strip("- ")
        source_entry["name"] = (
            cleaned_name
            if cleaned_name
            else (existing_name if existing_name else owner)
        )
        patches = patches_list_json.get("patches", [])
        valid_patches = []
        discovered_names = {}
        for patch in patches:
            name = patch.get("name")
            if not name:
                continue
            if is_latest_dev and main_json and name not in main_patch_names:
                patch["isPreRelease"] = True
            patch_dict = strip_patch(patch, discovered_names)
            if not patch_dict:
                continue
            if patch_dict.get("compatiblePackages"):
                for compatibility_package in patch_dict["compatiblePackages"]:
                    package_name = compatibility_package.get("packageName")
                    if package_name and package_name != PACKAGE_UNIVERSAL:
                        valid_apps_from_bundles.add(package_name)
                        if package_name not in apps_dict:
                            app_name = discovered_names.get(package_name)
                            if app_name:
                                apps_dict[package_name] = {"name": app_name}
                            else:
                                apps_dict[package_name] = {}
                        else:
                            app_name = discovered_names.get(package_name)
                            if app_name and not apps_dict[package_name].get("name"):
                                apps_dict[package_name]["name"] = app_name
                patch_dict["compatiblePackagesKey"] = get_compat_key(
                    patch_dict["compatiblePackages"]
                )
                del patch_dict["compatiblePackages"]
            valid_patches.append(patch_dict)
        source_entry["patches"] = valid_patches
        current_timestamp_ms = int(time.time() * 1000)
        app_first_seen_map = source_entry.get("appFirstSeen", {})
        if not isinstance(app_first_seen_map, dict):
            app_first_seen_map = {}
        has_universal_patch = False
        for patch_dict in valid_patches:
            if "compatiblePackagesKey" in patch_dict:
                compatibility_data = compatibilities_list[
                    patch_dict["compatiblePackagesKey"]
                ]
                for compatibility_entry in compatibility_data:
                    package_name = compatibility_entry.get("packageName")
                    if package_name and package_name not in app_first_seen_map:
                        app_first_seen_map[package_name] = current_timestamp_ms
            else:
                has_universal_patch = True
        if has_universal_patch and PACKAGE_UNIVERSAL not in app_first_seen_map:
            app_first_seen_map[PACKAGE_UNIVERSAL] = current_timestamp_ms
        source_entry["appFirstSeen"] = app_first_seen_map
    for base_key, source_entry in bundle_sources.items():
        if base_key in keys_to_remove:
            continue
        if not source_entry.get("patches"):
            print(
                f"[-] Bundle '{base_key}' has no patches. Skipping and excluding from bundles.json."
            )
            keys_to_remove.append(base_key)
        else:
            bundle_apps = set()
            for patch in source_entry.get("patches", []):
                if "compatiblePackagesKey" in patch:
                    compat_data = compatibilities_list[patch["compatiblePackagesKey"]]
                    for compat_entry in compat_data:
                        if "packageName" in compat_entry:
                            bundle_apps.add(compat_entry["packageName"])
            if bundle_apps == {"com.example.app"}:
                print(
                    f"[-] Bundle '{base_key}' only has example app (com.example.app). Skipping and excluding from bundles.json."
                )
                keys_to_remove.append(base_key)
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
        print(
            f"[INFO] Removed app '{package_name}' (no longer supported by any bundle)"
        )
    valid_prefixes = set()
    for base_key in repos_data:
        if ":" in base_key:
            source, owner_repo = base_key.split(":", 1)
            try:
                owner, repo_name = owner_repo.split("/", 1)
                valid_prefixes.add(f"{source}~{owner}~{repo_name}")
            except ValueError:
                pass
    for directory in [BUNDLES_DIR, PATCHES_DIR]:
        if directory.exists():
            for filepath in directory.glob("*.json"):
                prefix = filepath.name.removesuffix("~main.json").removesuffix(
                    "~dev.json"
                )
                if prefix not in valid_prefixes:
                    filepath.unlink()
    return compatibilities_list
