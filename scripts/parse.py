# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import stat
import subprocess
import sys
from pathlib import Path

from utils import append_step_summary, load_json, load_lines, save_json

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


def commit_pending_repos(
    updated_files: list[str] | None = None, parse_error: str | None = None
) -> None:
    updated_files_set = set(updated_files or [])
    successful_parsed_files = set(load_lines(PARSED_FILES_PATH))

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

    for repo, repo_updates in pending_repos.items():
        if "/" not in repo:
            continue
        owner, repo_name = repo.split("/", 1)

        if name := repo_updates.get("name"):
            repos_data.setdefault(repo, {})["name"] = name

        for platform in ("github", "gitlab"):
            if not isinstance(platform_updates := repo_updates.get(platform), dict):
                continue

            platform_data = repos_data.setdefault(repo, {}).setdefault(platform, {})
            if "image" in platform_updates:
                platform_data["image"] = platform_updates["image"]
                committed_target_count += 1

            for branch in ("main", "dev"):
                if branch in platform_updates:
                    new_sha = platform_updates[branch]
                    is_mpp_target = (
                        f"mpp/{owner}~{repo_name}~{branch}.mpp" in updated_files_set
                    )
                    file_prefix = f"{owner}~{repo_name}~{branch}.json"
                    if not is_mpp_target or file_prefix in successful_parsed_files:
                        platform_data[branch] = new_sha
                        committed_target_count += 1

    if committed_target_count > 0:
        formatted_repos_data = {}
        for repo, entry in sorted(repos_data.items(), key=lambda item: item[0].lower()):
            if not isinstance(entry, dict):
                continue
            repo_entry = {}
            if "name" in entry:
                repo_entry["name"] = entry["name"]
            for platform in ("github", "gitlab"):
                if platform in entry and isinstance(entry[platform], dict):
                    platform_entry = {
                        "main": entry[platform].get("main"),
                        "dev": entry[platform].get("dev"),
                    }
                    if "image" in entry[platform]:
                        platform_entry["image"] = entry[platform]["image"]
                    repo_entry[platform] = platform_entry
            formatted_repos_data[repo] = repo_entry
        save_json(REPOS_JSON_PATH, formatted_repos_data)
        print(
            f"Successfully committed pending SHA updates for {committed_target_count} target(s) to repos.json."
        )


def run_bundle_parser() -> None:
    updated_files = load_lines(UPDATED_FILES_PATH)

    parse_error = None
    if updated_files:
        print("\nRunning bundle-parser to extract patches-list from .mpp files...")
        if sys.platform != "win32" and GRADLE_EXECUTABLE_PATH.exists():
            GRADLE_EXECUTABLE_PATH.chmod(
                GRADLE_EXECUTABLE_PATH.stat().st_mode
                | stat.S_IXUSR
                | stat.S_IXGRP
                | stat.S_IXOTH
            )

        command_args = [
            str(GRADLE_EXECUTABLE_PATH),
            "run",
            "--args=@updated_files.txt",
        ]
        try:
            execution_result = subprocess.run(
                command_args, cwd=str(BUNDLE_PARSER_DIR), text=True
            )
            if execution_result.returncode != 0:
                parse_error = (
                    f"bundle-parser exited with code {execution_result.returncode}"
                )
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
