# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import fetch, load_json, save_json

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DISCOVER_JSON_PATH = DATA_DIR / "discover" / "discover.json"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLES_DIR = DATA_DIR / "bundles"
PATCHES_DIR = DATA_DIR / "patches"
BUNDLE_PARSER_DIR = ROOT_DIR / "scripts" / "bundle-parser"
BRANCHES = ["main", "dev"]
CONCURRENCY = 8


def get_remote_file_hash(url: str, source: str, fallback: Optional[str] = None) -> Optional[str]:
    try:
        request = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(request) as response:
            if source == "github":
                etag = response.getheader("ETag")
                return etag.strip('"') if etag else fallback
            elif source == "gitlab":
                sha = response.getheader("x-gitlab-content-sha256")
                return sha if sha else fallback
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise error
    return None


def get_file_sha(source: str, owner_repo: str, branch: str, custom_url: Optional[str] = None) -> Optional[str]:
    if source == "github":
        url = custom_url or f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-bundle.json"
    elif source == "gitlab":
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        url = custom_url or f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.json/raw?ref={branch}"
    else:
        return None
    return get_remote_file_hash(url, source, fallback=None)


def get_image_sha(source: str, owner_repo: str) -> Optional[str]:
    if source == "github":
        url = f"https://raw.githubusercontent.com/{owner_repo}/main/patches-bundle.png"
    elif source == "gitlab":
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        url = f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.png/raw?ref=main"
    else:
        return None
    return get_remote_file_hash(url, source, fallback="exists")


def process_repo_branch(source: str, owner_repo: str, branch: str, current_sha: Optional[str], custom_url: Optional[str] = None) -> Tuple[str, str, str, Optional[str], Optional[str], bool, bool]:
    key = f"{source}:{owner_repo}:{branch}"
    try:
        remote_sha = get_file_sha(source, owner_repo, branch, custom_url)
    except Exception as error:
        if isinstance(error, urllib.error.HTTPError) and error.code == 404:
            return source, owner_repo, branch, None, None, current_sha is not None, True
        print(f"[-] [{key}] Error fetching sha: {error}")
        return source, owner_repo, branch, current_sha, None, False, False

    if remote_sha == current_sha:
        return source, owner_repo, branch, remote_sha, None, False, remote_sha is None

    if remote_sha is None:
        return source, owner_repo, branch, None, None, True, True

    if source == "github":
        raw_bundle_url = custom_url or f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-bundle.json"
    else:
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        raw_bundle_url = custom_url or f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.json/raw?ref={branch}"

    bundle_text = None
    try:
        bundle_text = fetch(raw_bundle_url)
    except Exception as error:
        if isinstance(error, urllib.error.HTTPError) and error.code == 404:
            return source, owner_repo, branch, None, None, True, True
        print(f"[-] [{key}] Failed to download patches-bundle.json: {error}")
        return source, owner_repo, branch, current_sha, None, False, False
    return source, owner_repo, branch, remote_sha, bundle_text, True, False


def process_image(source: str, owner_repo: str, current_image: Optional[str]) -> Tuple[str, str, Optional[str], bool, bool]:
    key = f"{source}:{owner_repo}:image"
    try:
        remote_sha = get_image_sha(source, owner_repo)
    except Exception as error:
        if isinstance(error, urllib.error.HTTPError) and error.code == 404:
            return source, owner_repo, None, current_image is not None, True
        return source, owner_repo, current_image, False, False

    if remote_sha == current_image:
        return source, owner_repo, remote_sha, False, remote_sha is None
    return source, owner_repo, remote_sha, True, remote_sha is None


def fetch_all_repos(fetch_images: bool = False) -> None:
    discover_data = load_json(DISCOVER_JSON_PATH, {})
    old_repos_data = load_json(REPOS_JSON_PATH, {})
    new_repos_data = {}

    for base_key, discover_meta in discover_data.items():
        if ":" not in base_key:
            continue

        repo_data = {"main": old_repos_data.get(base_key, {}).get("main"), "dev": old_repos_data.get(base_key, {}).get("dev")}
        if "image" in old_repos_data.get(base_key, {}):
            repo_data["image"] = old_repos_data[base_key]["image"]
        new_repos_data[base_key] = repo_data

    BUNDLES_DIR.mkdir(parents=True, exist_ok=True)
    PATCHES_DIR.mkdir(parents=True, exist_ok=True)

    tasks = []
    image_tasks = []
    for base_key, repo_meta in new_repos_data.items():
        source, owner_repo = base_key.split(":", 1)
        for branch in BRANCHES:
            current_sha = repo_meta.get(branch)
            custom_url = discover_data.get(base_key, {}).get(f"bundleUrl:{branch}")
            tasks.append((source, owner_repo, branch, current_sha, custom_url))
        if fetch_images:
            image_tasks.append((source, owner_repo, repo_meta.get("image")))

    print(f"Processing {len(tasks)} branch targets...")
    pending_repositories_file_path = BUNDLE_PARSER_DIR / "pending_repos.json"
    pending_repository_data = {}
    updated_count = 0
    updated_files = []

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(process_repo_branch, source, owner_repo, branch, current_sha, custom_url) for source, owner_repo, branch, current_sha, custom_url in tasks]

        for future in as_completed(futures):
            source, owner_repo, branch, new_sha, bundle_text, status_changed, is_404 = future.result()
            base_key = f"{source}:{owner_repo}"

            if not status_changed:
                continue

            updated_count += 1
            pending_repository_data.setdefault(base_key, {})[branch] = new_sha

            if not is_404 and new_sha is not None:
                owner, repo = owner_repo.split("/", 1)
                file_prefix = f"{source}~{owner}~{repo}~{branch}.json"
                if bundle_text:
                    (BUNDLES_DIR / file_prefix).write_text(bundle_text, encoding="utf-8")
                    updated_files.append(file_prefix)

    if fetch_images:
        print(f"Processing {len(image_tasks)} image targets...")
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
            img_futures = [executor.submit(process_image, source, owner_repo, current_image) for source, owner_repo, current_image in image_tasks]
            for future in as_completed(img_futures):
                source, owner_repo, new_image_sha, status_changed, is_404 = future.result()
                if status_changed:
                    updated_count += 1
                    base_key = f"{source}:{owner_repo}"
                    pending_repository_data.setdefault(base_key, {})["image"] = new_image_sha

    null_repos = [key for key, repo in new_repos_data.items() if repo.get("main") is None and repo.get("dev") is None]
    print(f"Fetch completed. Updated {updated_count} targets.")
    if null_repos:
        print(f"::warning title=Fetch:: [-] Note: {len(null_repos)}/{len(new_repos_data)} repos have both branches as null: {', '.join(null_repos)}")

    list_file = BUNDLE_PARSER_DIR / "updated_files.txt"
    list_file.write_text("\n".join(updated_files), encoding="utf-8")
    save_json(pending_repositories_file_path, pending_repository_data)
    if updated_files:
        print(f"Saved {len(updated_files)} updated targets to updated_files.txt and pending_repos.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Morphe patches bundles")
    parser.add_argument("--image", action="store_true", help="Fetch bundle images")
    args = parser.parse_args()
    fetch_all_repos(fetch_images=args.image)


if __name__ == "__main__":
    main()
