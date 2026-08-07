# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import concurrent.futures
import os
import time
import urllib.error
import urllib.parse
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from updater import normalize_image_url
from utils import build_raw_url, fetch, load_json, save_json

GITHUB_CONCURRENCY = 8
ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
CUSTOM_JSON_PATH = DATA_DIR / "discover" / "custom.json"
REPOS_JSON_PATH = DATA_DIR / "repos.json"
STAR_HISTORY_JSON_PATH = DATA_DIR / "star-history.json"


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
                    avatar = response.get("avatar_url")
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
    bundle_sources: dict[str, Any], mode: str, existing_bundles: dict[str, Any]
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
    has_changes = False
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=GITHUB_CONCURRENCY
    ) as executor:
        future_to_base_key = {
            executor.submit(fetch_repo_details, url): base_key
            for base_key, url in tasks.items()
        }
        for future in concurrent.futures.as_completed(future_to_base_key):
            base_key = future_to_base_key[future]
            try:
                details = future.result()
                if not details:
                    continue
                if details.get("is_404"):
                    print(f"[-] Disabling {base_key} due to 404 Not Found")
                    custom_data[base_key] = {
                        "enabled": False,
                        "note": "Automatically disabled by GitHub Actions (404 Not Found)",
                    }
                    has_changes = True
                    bundle_sources.pop(base_key, None)
                    continue

                if details.get("is_archived"):
                    print(f"[-] Disabling {base_key} due to Repository Archived")
                    custom_data[base_key] = {
                        "enabled": False,
                        "note": "Automatically disabled by GitHub Actions (Repository Archived)",
                    }
                    has_changes = True
                    bundle_sources.pop(base_key, None)
                    continue

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

                # Handle repo rename
                if full_name and old_repo and full_name.lower() != old_repo.lower():
                    source = source_entry.get("source")
                    print(
                        f"[RENAME DETECTED] {source}:{old_repo} -> {source}:{full_name}"
                    )
                    has_changes = True

                    old_key = f"{source}:{old_repo}"
                    new_key = f"{source}:{full_name}"
                    custom_data[old_key] = {
                        "enabled": False,
                        "note": f"Automatically disabled by GitHub Actions (Redirected/Renamed to {full_name})",
                    }
                    custom_data[new_key] = {
                        "note": f"Automatically added by GitHub Actions (Redirected/Renamed from {old_repo})"
                    }

                    source_entry["repo"] = full_name
                    bundle_sources[new_key] = source_entry
                    if old_key in bundle_sources:
                        bundle_sources.pop(old_key, None)
                    if old_key in repos_data:
                        repos_data[new_key] = repos_data.pop(old_key)
            except Exception as error:
                print(f"[-] Failed to fetch details for {base_key}: {error}")

    if has_changes:
        save_json(CUSTOM_JSON_PATH, custom_data)
        save_json(REPOS_JSON_PATH, repos_data)
        print("Updated custom.json and repos.json for repository status changes.")

    update_star_history(bundle_sources, list(tasks.keys()))


def get_stars_on_or_before(
    star_record_map: dict[str, int], target_date_string: str, fallback_stars: int
) -> int:
    if target_date_string in star_record_map:
        return star_record_map[target_date_string]
    valid_dates = [
        date_key for date_key in star_record_map if date_key <= target_date_string
    ]
    if valid_dates:
        closest_date = max(valid_dates)
        return star_record_map[closest_date]
    if star_record_map:
        oldest_date = min(star_record_map.keys())
        return star_record_map[oldest_date]
    return fallback_stars


def update_star_history(
    bundle_sources: dict[str, Any], updated_keys: list[str]
) -> None:
    star_history_data = load_json(STAR_HISTORY_JSON_PATH, {})
    current_time = datetime.now(UTC) - timedelta(hours=12)
    current_date_string = current_time.strftime("%Y-%m-%d")
    date_7d_string = (current_time - timedelta(days=7)).strftime("%Y-%m-%d")
    date_40d_string = (current_time - timedelta(days=40)).strftime("%Y-%m-%d")

    for base_key in updated_keys:
        if base_key in bundle_sources:
            stars_current = bundle_sources[base_key].get("stars", 0)
            if base_key not in star_history_data:
                star_history_data[base_key] = {}
            star_history_data[base_key][current_date_string] = stars_current

    for base_key, source_entry in bundle_sources.items():
        stars_current = source_entry.get("stars", 0)
        star_record_for_bundle = star_history_data.get(base_key, {})
        stars_7d_ago = get_stars_on_or_before(
            star_record_for_bundle, date_7d_string, stars_current
        )
        stars_40d_ago = get_stars_on_or_before(
            star_record_for_bundle, date_40d_string, stars_current
        )

        source_entry["starsGained7d"] = max(0, stars_current - stars_7d_ago)
        source_entry["starsGained40d"] = max(0, stars_current - stars_40d_ago)

    if updated_keys:
        for base_key, history_map in list(star_history_data.items()):
            if isinstance(history_map, dict) and len(history_map) > 40:
                sorted_dates = sorted(history_map.keys())[-40:]
                star_history_data[base_key] = {
                    date: history_map[date] for date in sorted_dates
                }
        save_json(STAR_HISTORY_JSON_PATH, star_history_data)
