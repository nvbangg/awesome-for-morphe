# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BUNDLE_PARSER_DIR = ROOT_DIR / "scripts" / "bundle-parser"
UPDATED_FILES_TXT = BUNDLE_PARSER_DIR / "updated_files.txt"


def run_bundle_parser() -> None:
    if not UPDATED_FILES_TXT.exists() or not UPDATED_FILES_TXT.read_text(encoding="utf-8").strip():
        print("[-] No updated_files.txt found or empty. Nothing to parse.")
        return
    print("\nRunning bundle-parser to extract patches-list from .mpp files...")
    gradle_cmd = "gradlew.bat" if sys.platform == "win32" else "./gradlew"

    args = [str(BUNDLE_PARSER_DIR / gradle_cmd), "run", "--args=@updated_files.txt"]
    try:
        result = subprocess.run(args, cwd=str(BUNDLE_PARSER_DIR), capture_output=False, text=True)
        if result.returncode != 0:
            print(f"[-] [bundle-parser] Failed with exit code {result.returncode}")
        else:
            print("bundle-parser completed successfully.")
    except Exception as error:
        print(f"[-] [bundle-parser] Failed to execute: {error}")


def main() -> None:
    run_bundle_parser()


if __name__ == "__main__":
    main()
