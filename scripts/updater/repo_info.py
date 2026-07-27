# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import concurrent.futures
import os
import sys
import time
import urllib.error
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils import fetch, load_json, save_json

GITHUB_CONCURRENCY = 8
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CUSTOM_JSON_PATH = DATA_DIR / "discover" / "custom.json"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
BUNDLES_DIR = DATA_DIR / "bundles"
PATCHES_DIR = DATA_DIR / "patches"


def fetch_repo_details(repo_url: str) -> dict:
    if not repo_url:
        return {}

    if "github.com" in repo_url:
        parts = repo_url.split("github.com/")
        if len(parts) > 1:
            repo_path = parts[1].split("/")
            if len(repo_path) >= 2:
                owner, name = repo_path[0], repo_path[1]
                api_url = f"https://api.github.com/repos/{owner}/{name}"

                def fetch_details(use_token: bool = True) -> dict:
                    headers = {"User-Agent": "Awesome-Morphe"}
                    if use_token and os.environ.get("GITHUB_TOKEN"):
                        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
                    response = fetch(api_url, headers=headers, timeout=10, as_json=True)
                    if not response:
                        return {}
                    avatar = response.get("owner", {}).get("avatar_url")
                    if avatar and isinstance(avatar, str):
                        avatar = f"{avatar}&size=128" if "?" in avatar else f"{avatar}?size=128"
                    return {"stars": response.get("stargazers_count", 0), "description": response.get("description"), "avatar_url": avatar, "full_name": response.get("full_name")}

                try:
                    time.sleep(0.2)
                    return fetch_details(use_token=True)
                except urllib.error.HTTPError as error:
                    if error.code in (401, 403, 429):
                        try:
                            time.sleep(1)
                            return fetch_details(use_token=False)
                        except Exception as inner_exception:
                            if isinstance(inner_exception, urllib.error.HTTPError) and inner_exception.code == 404:
                                print(f"[-] Repo not found (404) for {repo_url}")
                                return {"is_404": True}
                            print(f"[-] Error fetching details (no token) for {repo_url}: {inner_exception}")
                            return {}
                    if error.code == 404:
                        print(f"[-] Repo not found (404) for {repo_url}")
                        return {"is_404": True}
                    print(f"[-] Error fetching details for {repo_url}: {error}")
                    return {}
                except Exception as error:
                    print(f"[-] Error fetching details for {repo_url}: {error}")
                    return {}

    elif "gitlab.com" in repo_url:
        parts = repo_url.split("gitlab.com/")
        if len(parts) > 1:
            repo_path = parts[1].strip("/")
            encoded_path = urllib.parse.quote(repo_path, safe="")
            api_url = f"https://gitlab.com/api/v4/projects/{encoded_path}"
            try:
                time.sleep(0.2)
                response = fetch(api_url, timeout=10, as_json=True)
                if response:
                    avatar = response.get("avatar_url")
                    if avatar and isinstance(avatar, str):
                        avatar = avatar.replace("s=80", "s=128")
                    return {"stars": response.get("star_count", 0), "description": response.get("description"), "avatar_url": avatar, "full_name": response.get("path_with_namespace")}
            except Exception as error:
                print(f"[-] Error fetching GitLab details for {repo_url}: {error}")
                return {}
    return {}


def process(bundle_sources: Dict[str, Any], mode: str, existing_bundles: Dict[str, Any]) -> None:
    tasks = {}
    for base_key, source_entry in bundle_sources.items():
        if mode == "default":
            if base_key in existing_bundles:
                continue
        source = source_entry.get("source")
        owner_repo = source_entry.get("repo")
        if not source or not owner_repo:
            continue
        repo_url = f"https://{source}.com/{owner_repo}"
        tasks[base_key] = repo_url

    if not tasks:
        return

    print(f"\nFetching repo info for {len(tasks)} bundles...")
    if mode == "default":
        for key in tasks:
            print(f"  -> {key}")

    custom_data = load_json(CUSTOM_JSON_PATH, {})
    repos_data = load_json(REPOS_JSON_PATH, {})
    has_renames = False
    with concurrent.futures.ThreadPoolExecutor(max_workers=GITHUB_CONCURRENCY) as executor:
        future_to_base_key = {executor.submit(fetch_repo_details, url): base_key for base_key, url in tasks.items()}
        for future in concurrent.futures.as_completed(future_to_base_key):
            base_key = future_to_base_key[future]
            try:
                details = future.result()
                if not details:
                    continue
                if details.get("is_404"):
                    print(f"[-] Disabling {base_key} due to 404 Not Found")
                    custom_data[base_key] = {"enabled": False, "note": "Automatically disabled by GitHub Actions (404 Not Found)"}
                    has_renames = True
                    continue

                source_entry = bundle_sources[base_key]
                source_entry["stars"] = details.get("stars", 0)

                if details.get("description"):
                    source_entry["repoDescription"] = details["description"]

                source = source_entry.get("source")
                owner_repo = source_entry.get("repo")
                image_sha = repos_data.get(base_key, {}).get("image")

                if image_sha and source and owner_repo:
                    if source == "github":
                        source_entry["avatarUrl"] = f"https://raw.githubusercontent.com/{owner_repo}/main/patches-bundle.png"
                    elif source == "gitlab":
                        encoded_repo = urllib.parse.quote(owner_repo, safe="")
                        source_entry["avatarUrl"] = f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/patches-bundle.png/raw?ref=main"
                elif details.get("avatar_url"):
                    source_entry["avatarUrl"] = details["avatar_url"]

                full_name = details.get("full_name")
                old_repo = source_entry.get("repo")

                # Handle repo rename
                if full_name and old_repo and full_name.lower() != old_repo.lower():
                    source = source_entry.get("source")
                    print(f"[RENAME DETECTED] {source}:{old_repo} -> {source}:{full_name}")
                    has_renames = True

                    old_key = f"{source}:{old_repo}"
                    new_key = f"{source}:{full_name}"
                    custom_data[old_key] = {"enabled": False, "note": f"Automatically disabled by GitHub Actions (Redirected/Renamed to {full_name})"}
                    custom_data[new_key] = {"note": f"Automatically added by GitHub Actions (Redirected/Renamed from {old_repo})"}
            except Exception as error:
                print(f"[-] Failed to fetch details for {base_key}: {error}")

    if has_renames:
        save_json(CUSTOM_JSON_PATH, custom_data)
        save_json(REPOS_JSON_PATH, repos_data)
        print("Updated custom.json and repos.json for renamed repositories.")
