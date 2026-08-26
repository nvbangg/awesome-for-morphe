# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

from updater import normalize_image_url
from utils import (
    CONCURRENCY,
    CUSTOM_JSON_PATH,
    HISTORY_PATH,
    REPOS_JSON_PATH,
    UNAVAILABLE_HTTP_CODES,
    build_raw_url,
    build_repo_url,
    fetch,
    load_json,
    parse_repo_url,
    save_json,
)


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
        if (
            isinstance(error, urllib.error.HTTPError)
            and error.code in UNAVAILABLE_HTTP_CODES
        ):
            if error.code == 451:
                return {"is_451": True, "error": "451 DMCA Takedown"}
            return {"is_404": True, "error": "404 Not Found"}
        return {"error": str(error)}


def process(
    bundle_sources: dict,
    mode: str,
    existing_bundles: dict,
    errors: dict[str, list[str]] | None = None,
) -> None:
    tasks = {}
    for repo, source_entry in bundle_sources.items():
        if mode == "default" and repo in existing_bundles:
            continue
        source = source_entry.get("source")
        if not source or not repo:
            continue
        tasks[repo] = build_repo_url(source, repo)

    if not tasks:
        return

    print(f"\nFetching repo info for {len(tasks)} bundles...")
    if mode == "default":
        for key in tasks:
            print(f"  -> {key}")

    custom_data = load_json(CUSTOM_JSON_PATH, {})
    repos_data = load_json(REPOS_JSON_PATH, {})
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        future_to_repo = {
            executor.submit(fetch_repo_details, url): repo
            for repo, url in tasks.items()
        }
        for future in as_completed(future_to_repo):
            repo = future_to_repo[future]
            try:
                details = future.result()
                if not details:
                    continue
                if details.get("is_404") or details.get("is_451"):
                    reason = (
                        "451 DMCA Takedown"
                        if details.get("is_451")
                        else "404 Not Found"
                    )
                    print(f"[-] Excluding {repo} due to {reason}")
                    if errors is not None:
                        errors["unavailable"].append(f"{tasks[repo]}: {reason}")
                    bundle_sources.pop(repo, None)
                    continue

                if details.get("is_archived"):
                    print(f"[-] Repository archived: {repo}")
                    if errors is not None:
                        errors["warnings"].append(
                            f"{tasks[repo]}: Repository is archived"
                        )

                source_entry = bundle_sources[repo]
                repo_url = tasks[repo]
                custom_entry = custom_data.get(repo_url, {})
                source_entry["stars"] = details.get("stars", 0) - custom_entry.get(
                    "revancedStars", 0
                )

                source_entry["repoDescription"] = details.get("description") or ""

                source = source_entry.get("source")
                image_sha = (
                    repos_data.get(repo, {}).get(source, {}).get("image")
                    if source
                    else None
                )

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
                    old_url = build_repo_url(source, old_repo)
                    new_url = build_repo_url(source, full_name)
                    print(f"[+] Rename detected: {old_repo} -> {full_name}")
                    if errors is not None:
                        errors["warnings"].append(f"{old_url} -> {new_url}")

                    repos_json_data = load_json(REPOS_JSON_PATH, {})
                    if old_repo in repos_json_data:
                        repos_json_data.setdefault(
                            full_name, repos_json_data.pop(old_repo)
                        )
                        save_json(REPOS_JSON_PATH, repos_json_data)

                    custom_json_data = load_json(CUSTOM_JSON_PATH, {})
                    if old_url:
                        custom_json_data[old_url] = {
                            "enabled": False,
                            "note": f"Automatically disabled by GitHub Actions (Redirected/Renamed to {full_name})",
                        }
                    if new_url and new_url not in custom_json_data:
                        custom_json_data[new_url] = {
                            "note": f"Automatically added by GitHub Actions (Redirected/Renamed from {old_repo})"
                        }
                    save_json(CUSTOM_JSON_PATH, custom_json_data)

                    history_data = load_json(HISTORY_PATH, {})
                    if old_repo in history_data:
                        history_data.setdefault(full_name, history_data.pop(old_repo))
                        save_json(HISTORY_PATH, history_data)

                    if full_name in bundle_sources:
                        bundle_sources.pop(repo, None)
                    else:
                        source_entry["repo"] = full_name
            except Exception as error:
                print(f"[-] Failed to fetch details for {repo}: {error}")
