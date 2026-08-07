# Copyright (c) 2026 nvbangg (github.com/nvbangg)

from pathlib import Path

from providers import export_provider
from utils import fetch, load_json, save_json

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DISCOVER_DIR = DATA_DIR / "discover"
BUNDLES_URL = "https://morphe-patches.software/data/bundles.json"
OUTPUT_PATH = DISCOVER_DIR / "official.json"
SNAPSHOT_PATH = DATA_DIR / "official-bundles.json"
HEADERS = {
    "Referer": "https://morphe-patches.software/",
    "User-Agent": "AwesomeMorphe/1.0 (+https://github.com/nvbangg/awesome-morphe)",
}


def discover():
    try:
        data = fetch(BUNDLES_URL, headers=HEADERS, timeout=30, as_json=True)
        save_json(SNAPSHOT_PATH, data)
    except Exception as error:
        existing_data = load_json(SNAPSHOT_PATH)
        print(
            f"::warning title=Discover:: [-] [official] Failed: {error}. Kept {len(existing_data)} sources in official.json"
        )
        if not existing_data:
            existing_data = load_json(OUTPUT_PATH)
            print(
                f"::warning title=Discover:: [-] [official] Empty result. Kept {len(existing_data)} sources in official.json"
            )
            return existing_data
        data = existing_data

    bundles = data.get("bundles", [])
    discovered = {}

    for bundle in bundles:
        source = bundle.get("source")
        repo = bundle.get("repo")
        if not source or not repo:
            continue

        discovered[f"{source.lower()}:{repo}"] = {}

    return export_provider("official", discovered, OUTPUT_PATH)


if __name__ == "__main__":
    result = discover()
    print(
        f"Saved {len(result)} repos to {OUTPUT_PATH.relative_to(OUTPUT_PATH.parents[2])}"
    )
