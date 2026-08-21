# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import stat
import subprocess
import sys
from pathlib import Path

from utils import append_step_summary, load_json, save_json

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
PATCHES_DIR = DATA_DIR / "patches"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLE_PARSER_DIR = ROOT_DIR / "scripts" / "bundle-parser"
UPDATED_FILES_PATH = BUNDLE_PARSER_DIR / "updated_files.txt"
PENDING_REPOS_PATH = BUNDLE_PARSER_DIR / "pending_repos.json"
PARSED_FILES_PATH = BUNDLE_PARSER_DIR / "parsed_files.txt"
GRADLE_EXECUTABLE_NAME = "gradlew.bat" if sys.platform == "win32" else "gradlew"
GRADLE_EXECUTABLE_PATH = BUNDLE_PARSER_DIR / GRADLE_EXECUTABLE_NAME


def commit_pending_repos(updated_files: list[str] | None = None, parse_error: str | None = None) -> None:
    successful_parsed_files = (
        {line.strip() for line in PARSED_FILES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()}
        if PARSED_FILES_PATH.exists()
        else set()
    )

    errors = [parse_error] if parse_error else []
    if updated_files:
        for file_path in sorted(updated_files):
            target_name = Path(file_path).stem
            if f"{target_name}.json" not in successful_parsed_files:
                errors.append(f"Failed to parse bundle: {target_name}")

    if errors:
        markdown_lines = ["### ⚠️ Parse", *[f"- {error}" for error in errors]]
        append_step_summary("\n".join(markdown_lines))

    if not (pending_repos := load_json(PENDING_REPOS_PATH, {})):
        return

    repos_data = load_json(REPOS_JSON_PATH, {})
    committed_target_count = 0

    for base_key, repo_updates in pending_repos.items():
        if ":" not in base_key:
            continue
        source, owner_repo = base_key.split(":", 1)
        if "/" not in owner_repo:
            continue
        owner, repo = owner_repo.split("/", 1)

        for branch, new_value in repo_updates.items():
            if branch == "name":
                if new_value:
                    repos_data.setdefault(base_key, {})["name"] = new_value
                continue
            file_prefix = f"{source}~{owner}~{repo}~{branch}.json"
            patch_exists = (PATCHES_DIR / file_prefix).exists()
            if branch == "image" or file_prefix in successful_parsed_files or patch_exists or new_value is None:
                repos_data.setdefault(base_key, {})[branch] = new_value
                committed_target_count += 1

    if committed_target_count > 0:
        formatted_repos_data = {
            key: {field: entry[field] for field in ("name", "image") if entry.get(field)}
            | {"main": entry.get("main"), "dev": entry.get("dev")}
            for key, entry in sorted(repos_data.items(), key=lambda item: item[0].lower())
            if isinstance(entry, dict)
        }
        save_json(REPOS_JSON_PATH, formatted_repos_data)
        print(f"Successfully committed pending SHA updates for {committed_target_count} target(s) to repos.json.")


def run_bundle_parser() -> None:
    updated_files = (
        [line.strip() for line in UPDATED_FILES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
        if UPDATED_FILES_PATH.exists()
        else []
    )

    parse_error = None
    if updated_files:
        print("\nRunning bundle-parser to extract patches-list from .mpp files...")
        if sys.platform != "win32" and GRADLE_EXECUTABLE_PATH.exists():
            GRADLE_EXECUTABLE_PATH.chmod(
                GRADLE_EXECUTABLE_PATH.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
            )

        command_arguments = [str(GRADLE_EXECUTABLE_PATH), "run", "--args=@updated_files.txt"]
        try:
            execution_result = subprocess.run(
                command_arguments, cwd=str(BUNDLE_PARSER_DIR), text=True
            )
            if execution_result.returncode != 0:
                parse_error = f"bundle-parser exited with code {execution_result.returncode}"
                print(f"[-] {parse_error}")
            else:
                print("bundle-parser completed successfully.")
        except Exception as error:
            parse_error = f"bundle-parser failed to execute: {error}"
            print(f"[-] {parse_error}")
    else:
        print("[-] No updated_files.txt found or empty. Nothing to parse.")

    commit_pending_repos(updated_files, parse_error)


def main() -> None:
    run_bundle_parser()


if __name__ == "__main__":
    sys.exit(main())
