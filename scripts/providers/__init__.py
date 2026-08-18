from pathlib import Path

from utils import save_json


def export_provider(provider_name: str, discovered: dict, output_path: Path) -> str | None:
    if not discovered:
        warning_message = f"[{provider_name}] Empty result. Kept existing {output_path.name}"
        print(f"[-] {warning_message}")
        return warning_message

    save_json(output_path, dict(sorted(discovered.items(), key=lambda item: item[0].lower())))
    print(f"[{provider_name}] Exported {len(discovered)} sources to {output_path.name}")
    return None
