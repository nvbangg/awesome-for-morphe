# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import sys
import json
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Dict, Any, Tuple
import argparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import fetch, load_json, save_json

DATA_DIR = Path("data")
DISCOVER_JSON_PATH = DATA_DIR / "discover" / "discover.json"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLES_DIR = DATA_DIR / "bundles"
PATCHES_DIR = DATA_DIR / "patches"
BRANCHES = ["main", "dev"]
CONCURRENCY = 8


def get_file_sha(source: str, owner_repo: str, branch: str, bundle_url: Optional[str] = None) -> Optional[str]:
    if source == "github":
        url = bundle_url if bundle_url else f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-bundle.json"
        try:
            request = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(request) as response:
                etag = response.getheader("ETag")
                if etag:
                    return etag.strip('"')
                return None
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise error
    elif source == "gitlab":
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        url = bundle_url if bundle_url else f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.json/raw?ref={branch}"
        try:
            request = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(request) as response:
                return response.getheader("x-gitlab-content-sha256")
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise error
    return None


def process_repo_branch(
    source: str,
    owner_repo: str,
    branch: str,
    current_sha: Optional[str],
    patches_url: Optional[str] = None,
    bundle_url: Optional[str] = None
) -> Tuple[str, str, str, Optional[str], Optional[str], Optional[str], bool, bool]:
    key = f"{source}:{owner_repo}:{branch}"
    try:
        remote_sha = get_file_sha(source, owner_repo, branch, bundle_url)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return source, owner_repo, branch, None, None, None, current_sha is not None, True
        print(f"[{key}] Error fetching sha: {error}")
        return source, owner_repo, branch, current_sha, None, None, False, False
    except Exception as error:
        print(f"[{key}] Error fetching sha: {error}")
        return source, owner_repo, branch, current_sha, None, None, False, False

    if remote_sha == current_sha:
        return source, owner_repo, branch, remote_sha, None, None, False, remote_sha is None

    if remote_sha is None:
        return source, owner_repo, branch, None, None, None, True, True

    if source == "github":
        raw_bundle_url = bundle_url if bundle_url else f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-bundle.json"
        raw_patches_list_url = patches_url if patches_url else f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-list.json"
    else:
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        raw_bundle_url = bundle_url if bundle_url else f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.json/raw?ref={branch}"
        raw_patches_list_url = patches_url if patches_url else f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-list.json/raw?ref={branch}"

    bundle_text = None
    try:
        bundle_text = fetch(raw_bundle_url)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return source, owner_repo, branch, None, None, None, True, True
        print(f"[{key}] Failed to download patches-bundle.json: {error}")
        return source, owner_repo, branch, current_sha, None, None, False, False
    except Exception as error:
        print(f"[{key}] Failed to download patches-bundle.json: {error}")
        return source, owner_repo, branch, current_sha, None, None, False, False

    patches_text = None
    try:
        patches_text = fetch(raw_patches_list_url)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return source, owner_repo, branch, None, None, None, True, True
        print(f"[{key}] Failed to download patches-list.json: {error}")
        return source, owner_repo, branch, current_sha, None, None, False, False
    except Exception as error:
        print(f"[{key}] Failed to download patches-list.json: {error}")
        return source, owner_repo, branch, current_sha, None, None, False, False

    return source, owner_repo, branch, remote_sha, bundle_text, patches_text, True, False


def fetch_all_repos() -> None:
    discover_data = load_json(DISCOVER_JSON_PATH, {})
    old_repos_data = load_json(REPOS_JSON_PATH, {})
    new_repos_data = {}

    for base_key, discover_meta in discover_data.items():
        if ":" not in base_key:
            continue
        new_repos_data[base_key] = {}
        if "name" in discover_meta:
            new_repos_data[base_key]["name"] = discover_meta["name"]

        old_meta = old_repos_data.get(base_key, {})
        new_repos_data[base_key]["main"] = old_meta.get("main")
        new_repos_data[base_key]["dev"] = old_meta.get("dev")

    BUNDLES_DIR.mkdir(parents=True, exist_ok=True)
    PATCHES_DIR.mkdir(parents=True, exist_ok=True)

    tasks = []
    for base_key, repo_meta in new_repos_data.items():
        source, owner_repo = base_key.split(":", 1)
        for branch in BRANCHES:
            current_sha = repo_meta.get(branch)
            patches_url = discover_data.get(base_key, {}).get(f"patchesUrl:{branch}")
            bundle_url = discover_data.get(base_key, {}).get(f"bundleUrl:{branch}")
            tasks.append((source, owner_repo, branch, current_sha, patches_url, bundle_url))

    print(f"[+] Processing {len(tasks)} branch targets...")
    updated_count = 0

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(process_repo_branch, source, owner_repo, branch, current_sha, p_url, b_url) for source, owner_repo, branch, current_sha, p_url, b_url in tasks]

        for future in as_completed(futures):
            source, owner_repo, branch, new_sha, bundle_text, patches_text, status_changed, is_404 = future.result()
            base_key = f"{source}:{owner_repo}"

            if not status_changed:
                continue

            updated_count += 1
            new_repos_data[base_key][branch] = new_sha

            if not is_404 and new_sha is not None:
                owner, repo = owner_repo.split("/", 1)
                file_prefix = f"{source}~{owner}~{repo}~{branch}.json"
                if bundle_text:
                    (BUNDLES_DIR / file_prefix).write_text(bundle_text, encoding="utf-8")
                if patches_text:
                    (PATCHES_DIR / file_prefix).write_text(patches_text, encoding="utf-8")

    save_json(REPOS_JSON_PATH, new_repos_data)
    print(f"[+] Fetch completed. Updated {updated_count} targets.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch patch bundles and extract patch lists directly from repos.")
    parser.parse_args()
    fetch_all_repos()


if __name__ == "__main__":
    main()
