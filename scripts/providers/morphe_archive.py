# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils import fetch, save_json

README_URL = "https://raw.githubusercontent.com/rushiforai/morphe-archive/main/README.md"
OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "discover" / "morphe-archive.json"
_REPO_RE = re.compile(r"morphe\.software/add-source\?(github|gitlab)=([^)\s]+)")


def discover():
    try:
        content = fetch(README_URL)
    except Exception as error:
        existing_data = load_json(OUTPUT_PATH)
        print(f"::warning title=Discover:: [-] [morphe-archive] Failed: {error}. Kept {len(existing_data)} sources in morphe-archive.json")
        return existing_data

    discovered = {}
    for match in _REPO_RE.finditer(content):
        platform, repo_path = match.group(1), match.group(2).strip()
        parts = repo_path.split("/", 1)
        if len(parts) == 2:
            owner, repo = parts[0].strip(), parts[1].strip()
            discovered[f"{platform}:{owner}/{repo}"] = {}

    if not discovered:
        existing_data = load_json(OUTPUT_PATH)
        print(f"::warning title=Discover:: [-] [morphe-archive] Empty result. Kept {len(existing_data)} sources in morphe-archive.json")
        return existing_data
    save_json(OUTPUT_PATH, dict(sorted(discovered.items(), key=lambda item: item[0].lower())))
    print(f"[morphe-archive] Exported {len(discovered)} sources to morphe-archive.json")
    return discovered


if __name__ == "__main__":
    result = discover()
    print(f"Saved {len(result)} repos to {OUTPUT_PATH.relative_to(OUTPUT_PATH.parents[2])}")
