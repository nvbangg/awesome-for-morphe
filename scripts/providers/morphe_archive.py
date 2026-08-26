# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import re

from providers import export_provider
from utils import DISCOVER_DIR, build_repo_url, fetch

README_URL = (
    "https://raw.githubusercontent.com/rushiforai/morphe-archive/main/README.md"
)
OUTPUT_PATH = DISCOVER_DIR / "morphe-archive.json"
_REPO_RE = re.compile(r"morphe\.software/add-source\?(github|gitlab)=([^)\s]+)")


def discover() -> str | None:
    try:
        content = fetch(README_URL)
    except Exception as error:
        warning_message = f"[morphe-archive] Failed: {error}. Kept existing sources in morphe-archive.json"
        print(f"[-] {warning_message}")
        return warning_message

    discovered = {
        url: {}
        for match in _REPO_RE.finditer(content)
        if (url := build_repo_url(match.group(1), match.group(2).strip()))
        and "/" in match.group(2)
    }

    return export_provider("morphe-archive", discovered, OUTPUT_PATH)


if __name__ == "__main__":
    discover()
