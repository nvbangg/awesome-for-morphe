# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import os
import stat
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BUNDLE_PARSER_DIR = ROOT_DIR / "scripts" / "bundle-parser"
UPDATED_FILES_PATH = BUNDLE_PARSER_DIR / "updated_files.txt"
GRADLE_EXECUTABLE_NAME = "gradlew.bat" if sys.platform == "win32" else "gradlew"
GRADLE_EXECUTABLE_PATH = BUNDLE_PARSER_DIR / GRADLE_EXECUTABLE_NAME


def run_bundle_parser() -> None:
    if not UPDATED_FILES_PATH.exists() or not UPDATED_FILES_PATH.read_text(encoding="utf-8").strip():
        print("[-] No updated_files.txt found or empty. Nothing to parse.")
        return
    print("\nRunning bundle-parser to extract patches-list from .mpp files...")
    if sys.platform != "win32" and GRADLE_EXECUTABLE_PATH.exists():
        os.chmod(GRADLE_EXECUTABLE_PATH, os.stat(GRADLE_EXECUTABLE_PATH).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    command_arguments = [str(GRADLE_EXECUTABLE_PATH), "run", "--args=@updated_files.txt"]
    try:
        execution_result = subprocess.run(command_arguments, cwd=str(BUNDLE_PARSER_DIR), capture_output=False, text=True)
        if execution_result.returncode != 0:
            print(f"[-] [bundle-parser] Failed with exit code {execution_result.returncode}")
        else:
            print("bundle-parser completed successfully.")
    except Exception as error:
        print(f"[-] [bundle-parser] Failed to execute: {error}")


def main() -> None:
    run_bundle_parser()


if __name__ == "__main__":
    main()
