# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import os
import stat
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
PATCHES_DIR = DATA_DIR / "patches"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLE_PARSER_DIR = ROOT_DIR / "scripts" / "bundle-parser"
UPDATED_FILES_PATH = BUNDLE_PARSER_DIR / "updated_files.txt"
PENDING_REPOS_PATH = BUNDLE_PARSER_DIR / "pending_repos.json"
PARSED_FILES_PATH = BUNDLE_PARSER_DIR / "parsed_files.txt"
GRADLE_EXECUTABLE_NAME = "gradlew.bat" if sys.platform == "win32" else "gradlew"
GRADLE_EXECUTABLE_PATH = BUNDLE_PARSER_DIR / GRADLE_EXECUTABLE_NAME

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_json, save_json


def commit_pending_repos() -> None:
    if not PENDING_REPOS_PATH.exists():
        return

    pending_repos = load_json(PENDING_REPOS_PATH, {})
    if not pending_repos:
        return

    successful_parsed_files = set()
    if PARSED_FILES_PATH.exists():
        successful_parsed_files = {line.strip() for line in PARSED_FILES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()}

    repos_data = load_json(REPOS_JSON_PATH, {})
    committed_target_count = 0

    for base_key, repo_updates in pending_repos.items():
        if ":" not in base_key:
            continue
        source, owner_repo = base_key.split(":", 1)
        if "/" not in owner_repo:
            continue
        owner, repo = owner_repo.split("/", 1)

        for branch, new_val in repo_updates.items():
            if branch == "name":
                if new_val:
                    repos_data.setdefault(base_key, {})["name"] = new_val
                continue
            file_prefix = f"{source}~{owner}~{repo}~{branch}.json"
            patch_exists = (PATCHES_DIR / file_prefix).exists()
            if branch == "image" or file_prefix in successful_parsed_files or patch_exists or new_val is None:
                repos_data.setdefault(base_key, {})[branch] = new_val
                committed_target_count += 1

    if committed_target_count > 0:
        formatted_repos_data = {}
        for key in sorted(repos_data.keys(), key=lambda k: k.lower()):
            raw_branches = repos_data[key]
            if isinstance(raw_branches, dict):
                formatted_branches = {}
                if "name" in raw_branches and raw_branches["name"]:
                    formatted_branches["name"] = raw_branches["name"]
                for branch in ["main", "dev", "image"]:
                    if raw_branches.get(branch) is not None:
                        formatted_branches[branch] = raw_branches[branch]
                if formatted_branches:
                    formatted_repos_data[key] = formatted_branches
        save_json(REPOS_JSON_PATH, formatted_repos_data)
        print(f"Successfully committed pending SHA updates for {committed_target_count} target(s) to repos.json.")


def run_bundle_parser() -> None:
    has_updated_files = UPDATED_FILES_PATH.exists() and bool(UPDATED_FILES_PATH.read_text(encoding="utf-8").strip())

    if has_updated_files:
        print("\nRunning bundle-parser to extract patches-list from .mpp files...")
        if sys.platform != "win32" and GRADLE_EXECUTABLE_PATH.exists():
            os.chmod(GRADLE_EXECUTABLE_PATH, os.stat(GRADLE_EXECUTABLE_PATH).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

        command_arguments = [str(GRADLE_EXECUTABLE_PATH), "run", "--args=@updated_files.txt"]
        try:
            execution_result = subprocess.run(command_arguments, cwd=str(BUNDLE_PARSER_DIR), capture_output=False, text=True)
            if execution_result.returncode != 0:
                print(f"[-] [bundle-parser] Exited with code {execution_result.returncode}")
            else:
                print("bundle-parser completed successfully.")
        except Exception as error:
            print(f"[-] [bundle-parser] Failed to execute: {error}")
    else:
        print("[-] No updated_files.txt found or empty. Nothing to parse.")

    commit_pending_repos()


def main() -> None:
    run_bundle_parser()


if __name__ == "__main__":
    main()
