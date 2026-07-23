# Copyright (c) 2026 nvbangg (github.com/nvbangg)

from pathlib import Path
from typing import Dict, Any
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils import load_json


def process(bundle_sources: Dict[str, Any], apps_dict: Dict[str, Any], data_dir: Path) -> None:
    official_bundles_path = data_dir / "official-bundles.json"
    official_data_raw = load_json(official_bundles_path, [])
    if isinstance(official_data_raw, dict) and "bundles" in official_data_raw:
        official_data = official_data_raw["bundles"]
    else:
        official_data = official_data_raw

    print("Syncing official data...")

    for official_entry in official_data:
        source = official_entry.get("source")
        repo = official_entry.get("repo")
        if not source or not repo:
            continue

        base_key = f"{source}:{repo}"
        if base_key in bundle_sources:
            bundle = bundle_sources[base_key]
            if official_entry.get("name"):
                bundle["name"] = official_entry["name"]

            bundle_icon = official_entry.get("bundleIconUrl")
            if bundle_icon:
                bundle["avatarUrl"] = bundle_icon
