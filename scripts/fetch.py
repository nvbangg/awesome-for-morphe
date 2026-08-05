# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
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
MPP_DIR = BUNDLE_PARSER_DIR / "mpp"
PENDING_REPOS_PATH = BUNDLE_PARSER_DIR / "pending_repos.json"
UPDATED_FILES_PATH = BUNDLE_PARSER_DIR / "updated_files.txt"
BRANCHES = ["main", "dev"]
CONCURRENCY = 8


def extract_mpp_name(mpp_file: Path) -> Optional[str]:
    try:
        with zipfile.ZipFile(mpp_file, "r") as z:
            manifest_text = z.read("META-INF/MANIFEST.MF").decode("utf-8")
            for line in manifest_text.splitlines():
                if line.startswith("Name:"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return None


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


def get_file_sha(source: str, owner_repo: str, branch: str) -> Optional[str]:
    if source == "github":
        url = f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-bundle.json"
    elif source == "gitlab":
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        url = f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.json/raw?ref={branch}"
    else:
        return None
    return get_remote_file_hash(url, source, fallback=None)


def get_patches_list_url(source: str, owner_repo: str, branch: str) -> Optional[str]:
    if source == "github":
        return f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-list.json"
    elif source == "gitlab":
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        return f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-list.json/raw?ref={branch}"
    return None


def get_image_sha(source: str, owner_repo: str) -> Optional[str]:
    if source == "github":
        url = f"https://raw.githubusercontent.com/{owner_repo}/main/patches-bundle.png"
    elif source == "gitlab":
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        url = f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.png/raw?ref=main"
    else:
        return None
    return get_remote_file_hash(url, source, fallback="exists")


def process_repo_branch(source: str, owner_repo: str, branch: str, current_sha: Optional[str]) -> Tuple[str, str, str, Optional[str], Optional[str], bool, bool, bool, Optional[str]]:
    try:
        remote_sha = get_file_sha(source, owner_repo, branch)
    except Exception as error:
        print(f"[-] [{owner_repo}:{branch}] Network error: {error}")
        return source, owner_repo, branch, current_sha, None, False, False, False, None

    if remote_sha == current_sha:
        return source, owner_repo, branch, remote_sha, None, False, False, False, None

    if remote_sha is None:
        print(f"[-] [{owner_repo}:{branch}] patches-bundle.json not found")
        return source, owner_repo, branch, None, None, False, True, True, None

    if source == "github":
        raw_bundle_url = f"https://raw.githubusercontent.com/{owner_repo}/{branch}/patches-bundle.json"
    else:
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        raw_bundle_url = f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.json/raw?ref={branch}"

    owner, repo = owner_repo.split("/", 1)
    file_prefix = f"{source}~{owner}~{repo}~{branch}"

    try:
        bundle_text = fetch(raw_bundle_url)
    except Exception as error:
        if isinstance(error, urllib.error.HTTPError) and error.code == 404:
            print(f"[-] [{owner_repo}:{branch}] patches-bundle.json not found")
            return source, owner_repo, branch, remote_sha, None, False, True, True, None
        print(f"[-] [{owner_repo}:{branch}] Network error: {error}")
        return source, owner_repo, branch, current_sha, None, False, False, False, None

    has_mpp = False
    bundle_name = None
    try:
        bundle_data = json.loads(bundle_text)
        mpp_url = bundle_data.get("download_url")
        if mpp_url and mpp_url.endswith(".mpp"):
            mpp_file_path = MPP_DIR / f"{file_prefix}.mpp"
            try:
                mpp_bytes = fetch(mpp_url, binary=True)
                MPP_DIR.mkdir(parents=True, exist_ok=True)
                mpp_file_path.write_bytes(mpp_bytes)
                has_mpp = True
                bundle_name = extract_mpp_name(mpp_file_path)
            except Exception as error:
                if isinstance(error, urllib.error.HTTPError) and error.code == 404:
                    print(f"[-] [{owner_repo}:{branch}] .mpp file not found")
                    return source, owner_repo, branch, remote_sha, bundle_text, False, True, True, None
                print(f"[-] [{owner_repo}:{branch}] Network error: {error}")
                return source, owner_repo, branch, current_sha, None, False, False, False, None
    except Exception:
        pass

    return source, owner_repo, branch, remote_sha, bundle_text, has_mpp, True, False, bundle_name


def process_image(source: str, owner_repo: str, current_image: Optional[str]) -> Tuple[str, str, Optional[str], bool, bool]:
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
    MPP_DIR.mkdir(parents=True, exist_ok=True)

    tasks = []
    image_tasks = []
    for base_key, repo_meta in new_repos_data.items():
        source, owner_repo = base_key.split(":", 1)
        for branch in BRANCHES:
            current_sha = repo_meta.get(branch)
            tasks.append((source, owner_repo, branch, current_sha))
        if fetch_images:
            image_tasks.append((source, owner_repo, repo_meta.get("image")))

    print(f"Processing {len(tasks)} branch targets...")
    pending_repository_data = {}
    updated_count = 0
    updated_files = []

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(process_repo_branch, source, owner_repo, branch, current_sha) for source, owner_repo, branch, current_sha in tasks]

        for future in as_completed(futures):
            source, owner_repo, branch, new_sha, bundle_text, has_mpp, status_changed, is_404, bundle_name = future.result()
            base_key = f"{source}:{owner_repo}"

            if not status_changed:
                continue

            updated_count += 1
            pending_repository_data.setdefault(base_key, {})[branch] = new_sha
            if bundle_name:
                pending_repository_data.setdefault(base_key, {})["name"] = bundle_name

            if not is_404 and new_sha is not None:
                owner, repo = owner_repo.split("/", 1)
                file_prefix = f"{source}~{owner}~{repo}~{branch}"
                if bundle_text:
                    (BUNDLES_DIR / f"{file_prefix}.json").write_text(bundle_text, encoding="utf-8")

                repo_patch_list = None
                patches_list_url = get_patches_list_url(source, owner_repo, branch)
                if patches_list_url:
                    try:
                        content = fetch(patches_list_url)
                        json.loads(content)
                        (PATCHES_DIR / f"{file_prefix}.json").write_text(content, encoding="utf-8")
                        repo_patch_list = content
                    except Exception:
                        repo_patch_list = None

                if not repo_patch_list and has_mpp:
                    updated_files.append(f"mpp/{file_prefix}.mpp")

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

    print(f"Fetch completed. Updated {updated_count} targets.")

    if updated_files:
        UPDATED_FILES_PATH.write_text("\n".join(updated_files), encoding="utf-8")
        print(f"Saved {len(updated_files)} updated targets to updated_files.txt and pending_repos.json")
    elif UPDATED_FILES_PATH.exists():
        UPDATED_FILES_PATH.unlink()

    save_json(PENDING_REPOS_PATH, pending_repository_data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Morphe patches bundles")
    parser.add_argument("--image", action="store_true", help="Fetch bundle images")
    args = parser.parse_args()
    fetch_all_repos(fetch_images=args.image)


if __name__ == "__main__":
    main()
