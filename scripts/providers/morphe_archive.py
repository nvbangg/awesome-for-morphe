# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import re
from pathlib import Path

from providers import export_provider
from utils import fetch

ROOT_DIR = Path(__file__).resolve().parents[2]
README_URL = ("https://raw.githubusercontent.com/rushiforai/morphe-archive/main/README.md")
OUTPUT_PATH = ROOT_DIR / "data" / "discover" / "morphe-archive.json"
_REPO_RE = re.compile(r"morphe\.software/add-source\?(github|gitlab)=([^)\s]+)")


def discover() -> str | None:
    try:
        content = fetch(README_URL)
    except Exception as error:
        warning_message = f"[morphe-archive] Failed: {error}. Kept existing sources in morphe-archive.json"
        print(f"[-] {warning_message}")
        return warning_message

    discovered = {
        f"{match.group(1)}:{parts[0].strip()}/{parts[1].strip()}": {}
        for match in _REPO_RE.finditer(content)
        if len(parts := match.group(2).strip().split("/", 1)) == 2
    }

    return export_provider("morphe-archive", discovered, OUTPUT_PATH)


if __name__ == "__main__":
    discover()
