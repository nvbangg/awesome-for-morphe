# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils import load_json, parse_timestamp

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
REPOS_JSON_PATH = DATA_DIR / "repos.json"

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


def strip_patch(patch: Dict[str, Any], discovered_names: Dict[str, str]) -> Optional[Dict[str, Any]]:
    output: Dict[str, Any] = {}
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
            if package_name == "universal":
                continue
            has_real_app = True
            targets = []
            if versions:
                for version_item in versions:
                    if isinstance(version_item, str):
                        targets.append({"version": version_item})
                    elif isinstance(version_item, dict) and "version" in version_item:
                        targets.append({"version": version_item["version"]})
            compatibility_targets.append({"packageName": package_name, "targets": targets})
    elif isinstance(compatible_packages, list):
        for entry in compatible_packages:
            if not isinstance(entry, dict):
                continue
            package_name = entry.get("packageName")
            if package_name == "universal" or not package_name:
                continue
            if name := entry.get("name"):
                discovered_names[package_name] = name
            has_real_app = True
            targets = []
            for target_item in entry.get("targets", []):
                target_out = {}
                if "version" in target_item:
                    target_out["version"] = target_item["version"]
                if target_item.get("isExperimental"):
                    target_out["isExperimental"] = True
                if target_out:
                    targets.append(target_out)
            package_out = {"packageName": package_name}
            if targets:
                package_out["targets"] = targets
            compatibility_targets.append(package_out)

    if has_real_app and compatibility_targets:
        output["compatiblePackages"] = compatibility_targets
    return output


def process(bundle_sources: Dict[str, Any], apps_dict: Dict[str, Any], data_dir: Path) -> list:
    bundles_dir = data_dir / "bundles"
    patches_dir = data_dir / "patches"
    keys_to_remove = []
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
        main_bundle_path = bundles_dir / f"{file_prefix}~main.json"
        main_list_path = patches_dir / f"{file_prefix}~main.json"
        dev_bundle_path = bundles_dir / f"{file_prefix}~dev.json"
        dev_list_path = patches_dir / f"{file_prefix}~dev.json"

        main_json = load_json(main_bundle_path) if main_bundle_path.exists() and main_list_path.exists() else None
        dev_json = load_json(dev_bundle_path) if dev_bundle_path.exists() and dev_list_path.exists() else None
        if not main_json and not dev_json:
            keys_to_remove.append(base_key)
            continue

        main_timestamp = parse_timestamp(main_json["created_at"]) if main_json and "created_at" in main_json else 0
        dev_timestamp = parse_timestamp(dev_json["created_at"]) if dev_json and "created_at" in dev_json else 0

        is_latest_dev = bool(dev_json and dev_timestamp > main_timestamp)
        list_path = dev_list_path if is_latest_dev else (main_list_path if main_json else dev_list_path)
        updated_at = dev_timestamp if is_latest_dev else (main_timestamp if main_json else dev_timestamp)

        source_entry["isPreRelease"] = not bool(main_json)
        source_entry["updatedAt"] = updated_at

        main_patch_names = set()
        if is_latest_dev and main_json and main_list_path.exists():
            main_list_raw = load_json(main_list_path, [])
            main_patches_raw = main_list_raw.get("patches", []) if isinstance(main_list_raw, dict) else main_list_raw
            if isinstance(main_patches_raw, list):
                main_patch_names = {patch.get("name") for patch in main_patches_raw if isinstance(patch, dict) and patch.get("name")}

        patches_list_json = load_json(list_path, [])
        if isinstance(patches_list_json, list):
            patches_list_json = {"patches": patches_list_json}

        bundle_name = patches_list_json.get("name")
        cleaned_name = bundle_name if bundle_name else ""
        if cleaned_name:
            if cleaned_name.lower() == "morphe patches":
                cleaned_name = ""
            else:
                pattern = re.compile(r"(?i)(?: for use with morphe| for morphe|['’]s morphe patches|['’]s patches| morphe| patches| patch)+$")
                cleaned_name = pattern.sub("", cleaned_name).strip("- ")

        source_entry["name"] = cleaned_name if cleaned_name else owner
        patches = patches_list_json.get("patches", [])
        valid_patches = []
        target_apps_set = set()
        discovered_names = {}

        for patch in patches:
            name = patch.get("name")
            if not name:
                continue

            if is_latest_dev and main_json and name not in main_patch_names:
                patch["isPreRelease"] = True

            app_name = patch.get("appName")
            patch_dict = strip_patch(patch, discovered_names)
            if not patch_dict:
                continue

            if patch_dict.get("compatiblePackages"):
                for compatibility_package in patch_dict["compatiblePackages"]:
                    package_name = compatibility_package.get("packageName")
                    if package_name:
                        target_apps_set.add(package_name)
                        if package_name not in apps_dict:
                            apps_dict[package_name] = {}

                        discovered_app_name = discovered_names.get(package_name) or app_name
                        if discovered_app_name and not apps_dict[package_name].get("name"):
                            apps_dict[package_name]["name"] = discovered_app_name

                patch_dict["compatiblePackagesKey"] = get_compat_key(patch_dict["compatiblePackages"])
                del patch_dict["compatiblePackages"]
            valid_patches.append(patch_dict)

        source_entry["patches"] = valid_patches
        source_entry["_internal_apps_set"] = target_apps_set

    for base_key, source_entry in bundle_sources.items():
        if base_key in keys_to_remove:
            continue
        if not source_entry.get("patches"):
            print(f"[-] Bundle '{base_key}' has no patches. Skipping and excluding from bundles.json.")
            keys_to_remove.append(base_key)
        elif source_entry.pop("_internal_apps_set", set()) == {"com.example.app"}:
            print(f"[-] Bundle '{base_key}' only has example app (com.example.app). Skipping and excluding from bundles.json.")
            keys_to_remove.append(base_key)
    for key in keys_to_remove:
        bundle_sources.pop(key, None)

    valid_prefixes = set()
    repos_data = load_json(REPOS_JSON_PATH, {})
    for base_key in repos_data:
        if ":" in base_key:
            source, owner_repo = base_key.split(":", 1)
            try:
                owner, repo_name = owner_repo.split("/", 1)
                valid_prefixes.add(f"{source}~{owner}~{repo_name}")
            except ValueError:
                pass

    for directory in [bundles_dir, patches_dir]:
        if directory.exists():
            for filepath in directory.glob("*.json"):
                prefix = filepath.name.removesuffix("~main.json").removesuffix("~dev.json")
                if prefix not in valid_prefixes:
                    filepath.unlink()
    return compatibilities_list
