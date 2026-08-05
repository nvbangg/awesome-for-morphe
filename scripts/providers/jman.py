# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import json
import os
import re
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils import fetch, load_json, save_json

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DISCOVER_DIR = DATA_DIR / "discover"
TREE_API_URL = "https://api.github.com/repos/Jman-Github/ReVanced-Patch-Bundles/git/trees/bundles?recursive=1"
RAW_BASE = "https://raw.githubusercontent.com/Jman-Github/ReVanced-Patch-Bundles/bundles"
OUTPUT_PATH = DISCOVER_DIR / "jman.json"
SNAPSHOT_PATH = DISCOVER_DIR / "snapshot.json"
_REPO_RE = re.compile(r"(github|gitlab)\.com/([^/]+)/([^/\s\"']+)")


def _extract_canonical_key(bundle_json):
    download_url = bundle_json.get("download_url", "")
    if not (isinstance(download_url, str) and download_url.lower().endswith(".mpp")):
        return None

    for url in [
        bundle_json.get("download_url"),
        bundle_json.get("release_url"),
        (bundle_json.get("patches") or {}).get("url"),
        (bundle_json.get("integrations") or {}).get("url"),
    ]:
        if not url:
            continue

        match = _REPO_RE.search(url)
        if match:
            platform, owner, repo = match.groups()
            return f"{platform}:{owner}/{repo}"
    return None


def _process_bundle(bundle_name, bundle_path, blob_sha, cached):
    cached_sha = cached.get("sha") if cached else None
    if blob_sha and blob_sha == cached_sha:
        return bundle_name, blob_sha, cached.get("key")

    try:
        content = fetch(f"{RAW_BASE}/{bundle_path}", timeout=10)
        canonical_key = _extract_canonical_key(json.loads(content))
    except Exception as error:
        print(f"[-] [jman] Failed to fetch {bundle_name}: {error}")
        return bundle_name, None, None
    return bundle_name, blob_sha, canonical_key


def discover():
    headers = {}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"

    try:
        tree_data = fetch(TREE_API_URL, headers=headers, timeout=30, as_json=True)
    except Exception as error:
        existing_data = load_json(OUTPUT_PATH)
        print(f"::warning title=Discover:: [-] [jman] Failed to fetch tree: {error}. Kept {len(existing_data)} sources in jman.json")
        return existing_data

    tree_sha = tree_data.get("sha", "")
    snapshot = load_json(SNAPSHOT_PATH)

    if tree_sha and tree_sha == snapshot.get("jman_tree_sha"):
        existing_data = load_json(OUTPUT_PATH)
        print(f"[jman] No changes detected. Kept {len(existing_data)} sources in jman.json")
        return existing_data
    tree_files = tree_data.get("tree", [])

    bundles = {}
    for item in tree_files:
        path = item.get("path", "")
        parts = path.split("/")
        if len(parts) == 3 and parts[0] == "patch-bundles" and item.get("type") == "blob" and parts[2].endswith("-latest-patches-bundle.json"):
            folder = parts[1]
            name = folder.removesuffix("-patch-bundles").removesuffix("-patches")
            bundles[name] = (path, item.get("sha", ""))

    cached_bundles = snapshot.get("jman_bundles", {})
    changed_count = sum(1 for name, (_, blob_sha) in bundles.items() if blob_sha != (cached_bundles.get(name) or {}).get("sha"))
    print(f"[jman] Tree changed, {changed_count} bundles updated")
    new_bundles = {}
    discovered = {}

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_process_bundle, name, path, blob_sha, cached_bundles.get(name)): name for name, (path, blob_sha) in bundles.items()}
        for future in as_completed(futures):
            bundle_name, new_sha, canonical_key = future.result()
            if new_sha:
                new_bundles[bundle_name] = {"sha": new_sha, "key": canonical_key}
            if canonical_key:
                discovered[canonical_key] = {}

    snapshot["jman_tree_sha"] = tree_sha
    snapshot["jman_bundles"] = dict(sorted(new_bundles.items(), key=lambda item: item[0].lower()))
    save_json(SNAPSHOT_PATH, snapshot)

    if not discovered:
        existing_data = load_json(OUTPUT_PATH)
        print(f"::warning title=Discover:: [-] [jman] Empty result. Kept {len(existing_data)} sources in jman.json")
        return existing_data
    save_json(OUTPUT_PATH, dict(sorted(discovered.items(), key=lambda item: item[0].lower())))
    print(f"[jman] Exported {len(discovered)} sources to jman.json")
    return discovered


if __name__ == "__main__":
    result = discover()
    print(f"Saved {len(result)} repos to {OUTPUT_PATH.relative_to(OUTPUT_PATH.parents[2])}")
