# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from providers import export_provider
from utils import fetch, load_json, save_json

ROOT_DIR = Path(__file__).resolve().parents[2]
DISCOVER_DIR = ROOT_DIR / "data" / "discover"
TREE_API_URL = "https://api.github.com/repos/Jman-Github/ReVanced-Patch-Bundles/git/trees/bundles?recursive=1"
RAW_BASE = (
    "https://raw.githubusercontent.com/Jman-Github/ReVanced-Patch-Bundles/bundles"
)
OUTPUT_PATH = DISCOVER_DIR / "jman.json"
SNAPSHOT_PATH = DISCOVER_DIR / "snapshot.json"
CONCURRENCY = 8
_REPO_RE = re.compile(r"(github|gitlab)\.com/([^/]+)/([^/\s\"']+)")


def _extract_canonical_key(bundle_json: dict) -> str | None:
    download_url = bundle_json.get("download_url", "")
    if not (isinstance(download_url, str) and download_url.lower().endswith(".mpp")):
        return None

    match = _REPO_RE.search(download_url)
    if match:
        platform, owner, repo = match.groups()
        return f"{platform}:{owner}/{repo}"
    return None


def _process_bundle(
    bundle_name: str, bundle_path: str, blob_sha: str, cached: dict | None
) -> tuple[str, str | None, str | None]:
    cached_sha = cached.get("sha") if cached else None
    if blob_sha and blob_sha == cached_sha:
        return bundle_name, blob_sha, cached.get("key")

    try:
        bundle_data = fetch(f"{RAW_BASE}/{bundle_path}", timeout=10, as_json=True)
        canonical_key = (
            _extract_canonical_key(bundle_data)
            if isinstance(bundle_data, dict)
            else None
        )
    except Exception as error:
        print(f"[-] [jman] Failed to fetch {bundle_name}: {error}")
        return bundle_name, None, None
    return bundle_name, blob_sha, canonical_key


def discover() -> str | None:
    try:
        tree_data = fetch(TREE_API_URL, timeout=30, as_json=True)
    except Exception as error:
        warning_message = (
            f"[jman] Failed to fetch tree: {error}. Kept existing sources in jman.json"
        )
        print(f"[-] {warning_message}")
        return warning_message

    tree_sha = tree_data.get("sha", "")
    snapshot = load_json(SNAPSHOT_PATH)

    if tree_sha and tree_sha == snapshot.get("jman_tree_sha"):
        print("[jman] No changes detected. Kept existing sources in jman.json")
        return None

    tree_files = tree_data.get("tree", [])

    bundles = {
        parts[1].removesuffix("-patch-bundles").removesuffix("-patches"): (
            path,
            item.get("sha", ""),
        )
        for item in tree_files
        if (path := item.get("path", ""))
        and len(parts := path.split("/")) == 3
        and parts[0] == "patch-bundles"
        and item.get("type") == "blob"
        and parts[2].endswith("-latest-patches-bundle.json")
    }

    cached_bundles = snapshot.get("jman_bundles", {})
    changed_count = sum(
        1
        for name, (_, blob_sha) in bundles.items()
        if blob_sha != (cached_bundles.get(name) or {}).get("sha")
    )
    print(f"[jman] Tree changed, {changed_count} bundles updated")
    new_bundles = {}
    discovered = {}

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = {
            executor.submit(
                _process_bundle, name, path, blob_sha, cached_bundles.get(name)
            ): name
            for name, (path, blob_sha) in bundles.items()
        }
        for future in as_completed(futures):
            bundle_name, new_sha, canonical_key = future.result()
            if new_sha:
                new_bundles[bundle_name] = {"sha": new_sha, "key": canonical_key}
            if canonical_key:
                discovered[canonical_key] = {}

    snapshot["jman_tree_sha"] = tree_sha
    snapshot["jman_bundles"] = dict(
        sorted(new_bundles.items(), key=lambda item: item[0].lower())
    )
    save_json(SNAPSHOT_PATH, snapshot)

    return export_provider("jman", discovered, OUTPUT_PATH)


if __name__ == "__main__":
    discover()
