# Copyright (c) 2026 nvbangg (github.com/nvbangg)

from pathlib import Path

from providers import export_provider
from utils import build_repo_url, fetch, save_json

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
BUNDLES_URL = "https://morphe-patches.software/data/bundles.json"
OUTPUT_PATH = DATA_DIR / "discover" / "official.json"
SNAPSHOT_PATH = DATA_DIR / "official-bundles.json"
HEADERS = {
    "Referer": "https://morphe-patches.software/",
    "User-Agent": "AwesomeMorphe/1.0 (+https://github.com/nvbangg/awesome-morphe)",
}


def discover() -> str | None:
    try:
        data = fetch(BUNDLES_URL, headers=HEADERS, timeout=30, as_json=True)
        save_json(SNAPSHOT_PATH, data)
    except Exception as error:
        warning_message = (
            f"[official] Failed: {error}. Kept existing sources in official.json"
        )
        print(f"[-] {warning_message}")
        return warning_message

    discovered = {
        url: {}
        for bundle in data.get("bundles", [])
        if (url := build_repo_url(bundle.get("source"), bundle.get("repo")))
    }
    return export_provider("official", discovered, OUTPUT_PATH)


if __name__ == "__main__":
    discover()
