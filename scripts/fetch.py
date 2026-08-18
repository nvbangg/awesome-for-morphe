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

from utils import (
    append_step_summary,
    build_raw_url,
    fetch,
    get_auth_headers,
    load_json,
    save_json,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLES_DIR = DATA_DIR / "bundles"
PATCHES_DIR = DATA_DIR / "patches"
BUNDLE_PARSER_DIR = ROOT_DIR / "scripts" / "bundle-parser"
MPP_DIR = BUNDLE_PARSER_DIR / "mpp"
PENDING_REPOS_PATH = BUNDLE_PARSER_DIR / "pending_repos.json"
UPDATED_FILES_PATH = BUNDLE_PARSER_DIR / "updated_files.txt"
BRANCHES = ["main", "dev"]
CONCURRENCY = 8
UNAVAILABLE_HTTP_CODES = (404, 451)


def extract_mpp_name(mpp_file: Path) -> str | None:
    try:
        with zipfile.ZipFile(mpp_file, "r") as zip_file:
            manifest_text = zip_file.read("META-INF/MANIFEST.MF").decode("utf-8")
            for line in manifest_text.splitlines():
                if line.startswith("Name:"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return None


def get_remote_file_hash(
    url: str, source: str, fallback: str | None = None
) -> tuple[str | None, str | None]:
    try:
        request = urllib.request.Request(url, headers=get_auth_headers(url), method="HEAD")
        with urllib.request.urlopen(request, timeout=15) as response:
            final_url = response.geturl()
            redirected_owner_repo = None
            if source == "github" and "raw.githubusercontent.com/" in final_url:
                parts = final_url.split("raw.githubusercontent.com/")[1].split("/")
                if len(parts) >= 2:
                    redirected_owner_repo = f"{parts[0]}/{parts[1]}"
            elif source == "gitlab" and "gitlab.com/" in final_url and "/-/raw/" in final_url:
                after_domain = final_url.split("gitlab.com/")[1].split("/-/raw/")[0]
                redirected_owner_repo = after_domain.strip("/")

            if source == "github":
                etag = response.getheader("ETag")
                return (etag.strip('"') if etag else fallback), redirected_owner_repo
            if source == "gitlab":
                sha = response.getheader("x-gitlab-content-sha256")
                return (sha or fallback), redirected_owner_repo
            return fallback, redirected_owner_repo
    except urllib.error.HTTPError as error:
        if error.code in UNAVAILABLE_HTTP_CODES:
            return None, None
        raise
    return None, None


def get_file_sha(source: str, owner_repo: str, branch: str) -> tuple[str | None, str | None]:
    url = build_raw_url(source, owner_repo, branch, "patches-bundle.json")
    if not url:
        return None, None
    return get_remote_file_hash(url, source, fallback=None)


def get_patches_list_url(source: str, owner_repo: str, branch: str) -> str | None:
    return build_raw_url(source, owner_repo, branch, "patches-list.json")


def get_image_sha(source: str, owner_repo: str) -> str | None:
    url = build_raw_url(source, owner_repo, "main", "patches-bundle.png")
    if not url:
        return None
    sha, _ = get_remote_file_hash(url, source, fallback="exists")
    return sha


def process_repo_branch(
    source: str, owner_repo: str, branch: str, current_sha: str | None
) -> tuple[str, str, str, str | None, str | None, bool, bool, bool, str | None, str | None, str | None]:
    try:
        remote_sha, redirected_owner_repo = get_file_sha(source, owner_repo, branch)
    except Exception as error:
        error_message = f"[{owner_repo}:{branch}] Failed: {error}"
        print(f"[-] {error_message}")
        return source, owner_repo, branch, current_sha, None, False, False, False, None, None, error_message

    effective_owner_repo = redirected_owner_repo if redirected_owner_repo else owner_repo
    renamed_from = owner_repo if effective_owner_repo.lower() != owner_repo.lower() else None

    if not renamed_from and remote_sha == current_sha:
        return source, owner_repo, branch, remote_sha, None, False, False, False, None, None, None

    if remote_sha is None:
        print(f"[-] [{owner_repo}:{branch}] patches-bundle.json not found")
        return source, owner_repo, branch, None, None, False, True, True, None, None, None

    raw_bundle_url = build_raw_url(source, effective_owner_repo, branch, "patches-bundle.json")
    if not raw_bundle_url:
        return source, effective_owner_repo, branch, current_sha, None, False, False, False, None, renamed_from, None

    owner, repo = effective_owner_repo.split("/", 1)
    file_prefix = f"{source}~{owner}~{repo}~{branch}"

    try:
        bundle_text = fetch(raw_bundle_url)
    except Exception as error:
        if isinstance(error, urllib.error.HTTPError) and error.code in UNAVAILABLE_HTTP_CODES:
            print(f"[-] [{effective_owner_repo}:{branch}] patches-bundle.json not found or taken down (HTTP {error.code})")
            return source, effective_owner_repo, branch, remote_sha, None, False, True, True, None, renamed_from, None
        error_message = f"[{effective_owner_repo}:{branch}] Failed: {error}"
        print(f"[-] {error_message}")
        return source, effective_owner_repo, branch, current_sha, None, False, False, False, None, renamed_from, error_message

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
                if isinstance(error, urllib.error.HTTPError) and error.code in UNAVAILABLE_HTTP_CODES:
                    print(f"[-] [{effective_owner_repo}:{branch}] .mpp file not found or taken down (HTTP {error.code})")
                    return source, effective_owner_repo, branch, remote_sha, bundle_text, False, True, True, None, renamed_from, None
                error_message = f"[{effective_owner_repo}:{branch}] Failed: {error}"
                print(f"[-] {error_message}")
                return source, effective_owner_repo, branch, current_sha, None, False, False, False, None, renamed_from, error_message
    except Exception:
        pass

    return source, effective_owner_repo, branch, remote_sha, bundle_text, has_mpp, True, False, bundle_name, renamed_from, None


def process_image(
    source: str, owner_repo: str, current_image: str | None
) -> tuple[str, str, str | None, bool, bool, str | None]:
    try:
        remote_sha = get_image_sha(source, owner_repo)
    except Exception as error:
        if isinstance(error, urllib.error.HTTPError) and error.code in UNAVAILABLE_HTTP_CODES:
            return source, owner_repo, None, current_image is not None, True, None
        error_message = f"[{owner_repo}] Failed: {error}"
        print(f"[-] {error_message}")
        return source, owner_repo, current_image, False, False, error_message

    if remote_sha == current_image:
        return source, owner_repo, remote_sha, False, remote_sha is None, None
    return source, owner_repo, remote_sha, True, remote_sha is None, None


def fetch_all_repos(fetch_images: bool = False) -> None:
    repos_data = load_json(REPOS_JSON_PATH, {})

    BUNDLES_DIR.mkdir(parents=True, exist_ok=True)
    PATCHES_DIR.mkdir(parents=True, exist_ok=True)
    MPP_DIR.mkdir(parents=True, exist_ok=True)

    tasks = []
    image_tasks = []
    for base_key, repo_meta in repos_data.items():
        if ":" not in base_key:
            continue
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
    errors = []

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [
            executor.submit(process_repo_branch, source, owner_repo, branch, current_sha)
            for source, owner_repo, branch, current_sha in tasks
        ]

        for future in as_completed(futures):
            (
                source,
                owner_repo,
                branch,
                new_sha,
                bundle_text,
                has_mpp,
                status_changed,
                is_unavailable,
                bundle_name,
                renamed_from,
                error_message,
            ) = future.result()
            if error_message:
                errors.append(error_message)

            base_key = f"{source}:{owner_repo}"
            if renamed_from:
                old_key = f"{source}:{renamed_from}"
                rename_log = f"[RENAME DETECTED] `{old_key}` -> `{base_key}`"
                if rename_log not in errors:
                    print(f"[RENAME DETECTED] {old_key} -> {base_key}")
                    errors.append(rename_log)
                if old_key in repos_data:
                    repos_data[base_key] = repos_data.pop(old_key)
                    save_json(REPOS_JSON_PATH, repos_data)

            if not status_changed:
                continue

            updated_count += 1
            pending_repository_data.setdefault(base_key, {})[branch] = new_sha
            if bundle_name:
                pending_repository_data.setdefault(base_key, {})["name"] = bundle_name

            if not is_unavailable and new_sha is not None:
                owner, repo = owner_repo.split("/", 1)
                file_prefix = f"{source}~{owner}~{repo}~{branch}"
                if bundle_text:
                    (BUNDLES_DIR / f"{file_prefix}.json").write_text(bundle_text, encoding="utf-8")

                has_patch_list = False
                patches_list_url = get_patches_list_url(source, owner_repo, branch)
                if patches_list_url:
                    try:
                        content = fetch(patches_list_url)
                        json.loads(content)
                        (PATCHES_DIR / f"{file_prefix}.json").write_text(content, encoding="utf-8")
                        has_patch_list = True
                    except Exception:
                        pass

                if not has_patch_list and has_mpp:
                    updated_files.append(f"mpp/{file_prefix}.mpp")

    if fetch_images:
        print(f"Processing {len(image_tasks)} image targets...")
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
            image_futures = [
                executor.submit(process_image, source, owner_repo, current_image)
                for source, owner_repo, current_image in image_tasks
            ]
            for future in as_completed(image_futures):
                source, owner_repo, new_image_sha, status_changed, is_unavailable, error_message = future.result()
                if error_message:
                    errors.append(error_message)

                if status_changed:
                    updated_count += 1
                    base_key = f"{source}:{owner_repo}"
                    pending_repository_data.setdefault(base_key, {})["image"] = new_image_sha

    if errors:
        markdown_lines = ["### ⚠️ Fetch", *[f"- {error}" for error in sorted(errors)]]
        append_step_summary("\n".join(markdown_lines))

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
    sys.exit(main())
