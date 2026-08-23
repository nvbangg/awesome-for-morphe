# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from updater import normalize_image_url
from utils import (
    build_raw_url,
    build_repo_url,
    fetch,
    load_json,
    parse_repo_url,
    save_json,
)

GITHUB_CONCURRENCY = 8
ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
CUSTOM_JSON_PATH = DATA_DIR / "discover" / "custom.json"
HISTORY_PATH = DATA_DIR / "history.json"
REPOS_JSON_PATH = DATA_DIR / "repos.json"


def fetch_repo_details(repo_url: str) -> dict:
    source, repo = parse_repo_url(repo_url)
    if not source or not repo:
        return {}

    api_url = build_repo_url(source, repo, mode="api")
    if not api_url:
        return {}

    try:
        time.sleep(0.1)
        response = fetch(api_url, timeout=10, as_json=True)
        if not response or not isinstance(response, dict):
            return {}

        if source == "github":
            avatar = response.get("owner", {}).get("avatar_url")
            full_name = response.get("full_name")
            stars = response.get("stargazers_count", 0)
        else:
            avatar = response.get("avatar_url") or response.get("namespace", {}).get(
                "avatar_url"
            )
            full_name = response.get("path_with_namespace")
            stars = response.get("star_count", 0)

        return {
            "stars": stars,
            "description": response.get("description"),
            "avatar_url": avatar,
            "full_name": full_name,
            "is_archived": bool(response.get("archived")),
        }
    except Exception as error:
        if isinstance(error, urllib.error.HTTPError):
            if error.code == 404:
                return {"is_404": True, "error": "404 Not Found"}
            if error.code == 451:
                return {"is_451": True, "error": "451 DMCA Takedown"}
        return {"error": str(error)}


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
        repo = source_entry.get("repo")
        if not source or not repo:
            continue
        tasks[base_key] = build_repo_url(source, repo)

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
                        errors["unavailable"].append(
                            f"`{base_key}`: Not found or no release bundle"
                        )
                    bundle_sources.pop(base_key, None)
                    continue

                if details.get("is_archived"):
                    print(f"[-] Repository archived: {base_key}")
                    if errors is not None:
                        errors["warnings"].append(
                            f"`{base_key}`: Repository is archived"
                        )

                source_entry = bundle_sources[base_key]
                source_entry["stars"] = details.get("stars", 0) - custom_data.get(
                    base_key, {}
                ).get("revancedStars", 0)

                source_entry["repoDescription"] = details.get("description") or ""

                source = source_entry.get("source")
                repo = source_entry.get("repo")
                image_sha = repos_data.get(base_key, {}).get("image")

                if image_sha and source and repo:
                    avatar_url = build_raw_url(
                        source, repo, "main", "patches-bundle.png"
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
                        errors["warnings"].append(
                            f"`{old_key}`: Renamed to `{new_key}`"
                        )

                    repos_json_data = load_json(REPOS_JSON_PATH, {})
                    if old_key in repos_json_data:
                        repos_json_data.setdefault(
                            new_key, repos_json_data.pop(old_key)
                        )
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
