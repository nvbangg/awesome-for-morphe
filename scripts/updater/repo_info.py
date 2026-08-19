# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import os
import time
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from updater import normalize_image_url
from utils import build_raw_url, fetch, load_json, save_json

GITHUB_CONCURRENCY = 8
ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
CUSTOM_JSON_PATH = DATA_DIR / "discover" / "custom.json"
HISTORY_PATH = DATA_DIR / "history.json"
REPOS_JSON_PATH = DATA_DIR / "repos.json"


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
                        headers["Authorization"] = (
                            f"Bearer {os.environ['GITHUB_TOKEN']}"
                        )
                    response = fetch(api_url, headers=headers, timeout=10, as_json=True)
                    if not response:
                        return {}
                    avatar = response.get("owner", {}).get("avatar_url")
                    return {
                        "stars": response.get("stargazers_count", 0),
                        "description": response.get("description"),
                        "avatar_url": avatar,
                        "full_name": response.get("full_name"),
                        "is_archived": bool(response.get("archived")),
                    }

                try:
                    time.sleep(0.2)
                    return fetch_details(use_token=True)
                except urllib.error.HTTPError as error:
                    if error.code in (401, 403, 429):
                        try:
                            time.sleep(1)
                            return fetch_details(use_token=False)
                        except Exception as inner_exception:
                            if (
                                isinstance(inner_exception, urllib.error.HTTPError)
                                and inner_exception.code == 404
                            ):
                                print(f"[-] Repo not found (404) for {repo_url}")
                                return {"is_404": True}
                            print(
                                f"[-] Error fetching details (no token) for {repo_url}: {inner_exception}"
                            )
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
                    avatar = response.get("avatar_url") or response.get(
                        "namespace", {}
                    ).get("avatar_url")
                    return {
                        "stars": response.get("star_count", 0),
                        "description": response.get("description"),
                        "avatar_url": avatar,
                        "full_name": response.get("path_with_namespace"),
                        "is_archived": bool(response.get("archived")),
                    }
            except Exception as error:
                print(f"[-] Error fetching GitLab details for {repo_url}: {error}")
                return {}
    return {}


def process(
    bundle_sources: dict,
    mode: str,
    existing_bundles: dict,
    errors: dict[str, list[str]] | None = None,
) -> None:
    tasks = {}
    for base_key, source_entry in bundle_sources.items():
        if mode == "default" and base_key in existing_bundles:
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
    with ThreadPoolExecutor(max_workers=GITHUB_CONCURRENCY) as executor:
        future_to_base_key = {
            executor.submit(fetch_repo_details, url): base_key
            for base_key, url in tasks.items()
        }
        for future in as_completed(future_to_base_key):
            base_key = future_to_base_key[future]
            try:
                details = future.result()
                if not details:
                    continue
                if details.get("is_404"):
                    print(f"[-] Excluding {base_key} due to 404 Not Found")
                    if errors is not None:
                        errors["unavailable"].append(f"`{base_key}`: Not found or no release bundle")
                    bundle_sources.pop(base_key, None)
                    continue

                if details.get("is_archived"):
                    print(f"[-] Repository archived: {base_key}")
                    if errors is not None:
                        errors["warnings"].append(f"`{base_key}`: Repository is archived")

                source_entry = bundle_sources[base_key]
                source_entry["stars"] = details.get("stars", 0) - custom_data.get(
                    base_key, {}
                ).get("revancedStars", 0)

                source_entry["repoDescription"] = details.get("description") or ""

                source = source_entry.get("source")
                owner_repo = source_entry.get("repo")
                image_sha = repos_data.get(base_key, {}).get("image")

                if image_sha and source and owner_repo:
                    avatar_url = build_raw_url(
                        source, owner_repo, "main", "patches-bundle.png"
                    )
                    if avatar_url:
                        source_entry["avatarUrl"] = avatar_url
                elif details.get("avatar_url"):
                    source_entry["avatarUrl"] = normalize_image_url(
                        details["avatar_url"]
                    )
                else:
                    source_entry["avatarUrl"] = ""

                full_name = details.get("full_name")
                old_repo = source_entry.get("repo")
                if full_name and old_repo and full_name.lower() != old_repo.lower():
                    source = source_entry.get("source")
                    old_key = f"{source}:{old_repo}"
                    new_key = f"{source}:{full_name}"
                    print(f"[RENAME DETECTED] {old_key} -> {new_key}")
                    if errors is not None:
                        errors["warnings"].append(f"`{old_key}`: Renamed to `{new_key}`")

                    repos_json_data = load_json(REPOS_JSON_PATH, {})
                    if old_key in repos_json_data:
                        repos_json_data.setdefault(new_key, repos_json_data.pop(old_key))
                        save_json(REPOS_JSON_PATH, repos_json_data)

                    custom_json_data = load_json(CUSTOM_JSON_PATH, {})
                    custom_json_data[old_key] = {
                        "enabled": False,
                        "note": f"Automatically disabled by GitHub Actions (Redirected/Renamed to {full_name})",
                    }
                    if new_key not in custom_json_data:
                        custom_json_data[new_key] = {
                            "note": f"Automatically added by GitHub Actions (Redirected/Renamed from {old_repo})"
                        }
                    save_json(CUSTOM_JSON_PATH, custom_json_data)

                    history_data = load_json(HISTORY_PATH, {})
                    if old_key in history_data:
                        history_data.setdefault(new_key, history_data.pop(old_key))
                        save_json(HISTORY_PATH, history_data)

                    if new_key in bundle_sources:
                        bundle_sources.pop(base_key, None)
                    else:
                        source_entry["repo"] = full_name
            except Exception as error:
                print(f"[-] Failed to fetch details for {base_key}: {error}")
