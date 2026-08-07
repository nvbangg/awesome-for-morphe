# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import re
from pathlib import Path

from providers import export_provider
from utils import fetch, load_json

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DISCOVER_DIR = DATA_DIR / "discover"
README_URL = (
    "https://raw.githubusercontent.com/rushiforai/morphe-archive/main/README.md"
)
OUTPUT_PATH = DISCOVER_DIR / "morphe-archive.json"
_REPO_RE = re.compile(r"morphe\.software/add-source\?(github|gitlab)=([^)\s]+)")


def discover():
    try:
        content = fetch(README_URL)
    except Exception as error:
        existing_data = load_json(OUTPUT_PATH)
        print(
            f"::warning title=Discover:: [-] [morphe-archive] Failed: {error}. Kept {len(existing_data)} sources in morphe-archive.json"
        )
        return existing_data

    discovered = {}
    for match in _REPO_RE.finditer(content):
        platform, repo_path = match.group(1), match.group(2).strip()
        parts = repo_path.split("/", 1)
        if len(parts) == 2:
            owner, repo = parts[0].strip(), parts[1].strip()
            discovered[f"{platform}:{owner}/{repo}"] = {}

    return export_provider("morphe-archive", discovered, OUTPUT_PATH)


if __name__ == "__main__":
    result = discover()
    print(
        f"Saved {len(result)} repos to {OUTPUT_PATH.relative_to(OUTPUT_PATH.parents[2])}"
    )
