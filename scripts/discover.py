# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from providers import jman, morphe_archive, official
from utils import append_step_summary, load_json, parse_repo_url, save_json

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
DISCOVER_DIR = DATA_DIR / "discover"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
PROVIDERS = [
    "custom",
    "official",
    "morphe-archive",
    "jman",
]
PROVIDER_MODULES = [official, jman, morphe_archive]
PROVIDER_PRIORITY = {f"{name}.json": index for index, name in enumerate(PROVIDERS)}


def _run_providers() -> list[str]:
    warnings = []
    with ThreadPoolExecutor(max_workers=len(PROVIDER_MODULES)) as executor:
        futures = [executor.submit(module.discover) for module in PROVIDER_MODULES]
        for future in as_completed(futures):
            try:
                warning_message = future.result()
                if warning_message:
                    warnings.append(warning_message)
            except Exception as error:
                warnings.append(f"Unhandled exception: {error}")
    return warnings


def _load_provider_files() -> list[tuple[str, dict]]:
    return [
        (f"{provider}.json", data)
        for provider in PROVIDERS
        if (data := load_json(DISCOVER_DIR / f"{provider}.json"))
    ]


def _merge(provider_files: list[tuple[str, dict]]) -> dict:
    groups = {}
    for filename, provider_dict in provider_files:
        priority = PROVIDER_PRIORITY.get(filename, 99)
        for raw_key, data in provider_dict.items():
            groups.setdefault(raw_key.lower(), []).append((priority, raw_key, data))

    merged = {}
    for entries in groups.values():
        entries.sort(key=lambda entry: (entry[0], entry[1]))
        final_key = entries[0][1]
        merged_data = {}
        for _, _, data in entries:
            for key, value in data.items():
                if key not in merged_data:
                    merged_data[key] = value
        merged[final_key] = merged_data
    return merged


def _sync_repos(merged: dict, existing_repos: dict) -> dict:
    new_repos_data = {}
    for repo_url, entry in sorted(merged.items(), key=lambda item: item[0].lower()):
        if entry.get("enabled") is not False:
            source, repo = parse_repo_url(repo_url)
            if not source or not repo:
                continue
            canonical_key = f"{source}:{repo}"
            old_entry = existing_repos.get(canonical_key, {})
            new_repos_data[canonical_key] = {
                field: old_entry[field]
                for field in ("name", "image")
                if old_entry.get(field)
            } | {"main": old_entry.get("main"), "dev": old_entry.get("dev")}
    return new_repos_data


def main() -> int:
    warnings = _run_providers()
    print()
    provider_files = _load_provider_files()
    if not provider_files:
        print("No provider files found.")
        append_step_summary(
            "### ⚠️ Discover\n- No provider files found in `data/discover/`."
        )
        return 1

    if warnings:
        markdown_lines = [
            "### ⚠️ Discover",
            *[f"- {warning}" for warning in sorted(warnings)],
        ]
        append_step_summary("\n".join(markdown_lines))

    merged = _merge(provider_files)
    print(f"Merged {len(merged)} unique sources")

    existing_repos = load_json(REPOS_JSON_PATH, {})
    synced_repos = _sync_repos(merged, existing_repos)
    print(f"Synced {len(synced_repos)} repos")
    save_json(REPOS_JSON_PATH, synced_repos)
    print(f"Saved to {REPOS_JSON_PATH.relative_to(ROOT_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
