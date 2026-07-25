# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_json, save_json
from providers import official, jman, morphe_archive

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DISCOVER_DIR = DATA_DIR / "discover"
OUTPUT_PATH = DISCOVER_DIR / "discover.json"
PROVIDERS = [
    "custom",
    "official",
    "jman",
    "morphe-archive",
]
PROVIDER_MODULES = [official, jman, morphe_archive]
PROVIDER_PRIORITY = {f"{name}.json": index for index, name in enumerate(PROVIDERS)}


def _run_providers():
    with ThreadPoolExecutor(max_workers=len(PROVIDER_MODULES)) as executor:
        futures = {executor.submit(module.discover): module.__name__ for module in PROVIDER_MODULES}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as error:
                print(f"[-] [{futures[future]}] Failed: {error}")


def _load_provider_files():
    results = []
    for provider in PROVIDERS:
        file_name = f"{provider}.json"
        path = DISCOVER_DIR / file_name
        if path.exists():
            data = load_json(path)
            if data:
                results.append((file_name, data))
    return results


def _merge(provider_files):
    groups = {}
    for filename, provider_dict in provider_files:
        priority = PROVIDER_PRIORITY.get(filename, 99)
        for raw_key, data in provider_dict.items():
            lower_key = raw_key.lower()
            groups.setdefault(lower_key, []).append((priority, raw_key, data))

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


def _build_output(merged):
    repos_output = {}
    for canonical_key, entry in sorted(merged.items()):
        if entry.get("enabled") is False:
            continue
        repo_data = {}
        for bundle_url_key in ["bundleUrl:main", "bundleUrl:dev"]:
            if entry.get(bundle_url_key):
                repo_data[bundle_url_key] = entry[bundle_url_key]
        repos_output[canonical_key] = repo_data
    return repos_output


def main():
    _run_providers()
    print()
    provider_files = _load_provider_files()
    if not provider_files:
        print("No provider files found.")
        return 1
    merged = _merge(provider_files)
    print(f"Merged {len(merged)} unique sources")
    repos = dict(sorted(_build_output(merged).items(), key=lambda item: item[0].lower()))
    print(f"Generated {len(repos)} repos")
    save_json(OUTPUT_PATH, repos)
    print(f"Saved to {OUTPUT_PATH.relative_to(ROOT_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
