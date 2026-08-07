from pathlib import Path
from typing import Any

from utils import load_json, save_json


def export_provider(
    provider_name: str, discovered: dict[str, Any], output_path: Path
) -> dict[str, Any]:
    if not discovered:
        existing_data = load_json(output_path)
        print(
            f"::warning title=Discover:: [-] [{provider_name}] Empty result. Kept {len(existing_data)} sources in {output_path.name}"
        )
        return existing_data
    save_json(
        output_path, dict(sorted(discovered.items(), key=lambda item: item[0].lower()))
    )
    print(f"[{provider_name}] Exported {len(discovered)} sources to {output_path.name}")
    return discovered
