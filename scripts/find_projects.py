# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import argparse
import contextlib
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime, timedelta
from pathlib import Path

from utils import (
    append_step_summary,
    build_raw_url,
    fetch,
    get_auth_headers,
    load_json,
    save_json,
)

ROOT_DIR = Path(__file__).resolve().parents[1]
PROJECTS_DIR = ROOT_DIR / "data" / "projects"
TEMP_DIR = ROOT_DIR / "scripts" / "temp"
README_PATH = ROOT_DIR / "README.md"
RAW_SEARCH_PATH = TEMP_DIR / "raw-search.json"
RAW_FILTER_PATH = TEMP_DIR / "raw-filter.json"
EXCLUDED_REPOS_PATH = PROJECTS_DIR / "excluded-repos.txt"
OUTPUT_TEXT_PATH = PROJECTS_DIR / "new-projects.txt"

SEARCH_KEYWORDS = ["morphe"]
CREATED_AFTER = "2026-01-01"
CREATED_WITHIN_DAYS = None
PUSHED_WITHIN_DAYS = 60
EXCLUDED_USERS = ["morpheapp"]
API_EXCLUDED_KEYWORDS = ["morpheus", "morpheme", "morphelab"]
API_EXCLUDED_NAME_KEYWORDS = ["patches", "builder"]
EXCLUDED_KEYWORDS = ["build", "magisk", "patched", "patcher", "youtube", "morphe-labs"]
CHECK_BRANCHES = ["main", "dev"]

PAGE_SIZE = 100
MAX_PAGES = 10
PAGE_DELAY_SECONDS = 1
SEARCH_TIMEOUT = 15
HEAD_TIMEOUT = 5
CONCURRENCY = 8

GITHUB_REPO_URL_RE = re.compile(r"https://github\.com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+")
MORPHE_NAME_RE = re.compile(r"(?<![a-zA-Z0-9])morphe(?![a-zA-Z0-9])", re.IGNORECASE)


def build_search_query(keyword: str) -> str:
    parts = [keyword, "size:>0", "archived:false", "fork:false"]
    parts.extend(f"-user:{user}" for user in EXCLUDED_USERS)

    if CREATED_WITHIN_DAYS:
        created_after = (
            datetime.now(UTC) - timedelta(days=CREATED_WITHIN_DAYS)
        ).strftime("%Y-%m-%d")
        parts.append(f"created:>{created_after}")
    elif CREATED_AFTER:
        parts.append(f"created:>{CREATED_AFTER}")

    if PUSHED_WITHIN_DAYS:
        pushed_after = (
            datetime.now(UTC) - timedelta(days=PUSHED_WITHIN_DAYS)
        ).strftime("%Y-%m-%d")
        parts.append(f"pushed:>{pushed_after}")

    parts.extend(f"NOT {forbidden}" for forbidden in API_EXCLUDED_KEYWORDS)
    parts.extend(f"NOT in:name {forbidden}" for forbidden in API_EXCLUDED_NAME_KEYWORDS)
    return " ".join(parts)


def sync_excluded_repos() -> set[str]:
    links = set()
    if EXCLUDED_REPOS_PATH.exists():
        links.update(
            line.strip()
            for line in EXCLUDED_REPOS_PATH.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        )

    if README_PATH.exists():
        links.update(
            GITHUB_REPO_URL_RE.findall(README_PATH.read_text(encoding="utf-8"))
        )

    sorted_links = sorted(links, key=str.lower)
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    EXCLUDED_REPOS_PATH.write_text("\n".join(sorted_links) + "\n", encoding="utf-8")
    return {link.removeprefix("https://github.com/").lower() for link in sorted_links}


def is_patch_bundle(owner_repo: str) -> bool:
    for branch in CHECK_BRANCHES:
        url = build_raw_url("github", owner_repo, branch, "patches-bundle.json")
        if not url:
            continue
        request = urllib.request.Request(
            url, headers=get_auth_headers(url), method="HEAD"
        )
        with (
            contextlib.suppress(Exception),
            urllib.request.urlopen(request, timeout=HEAD_TIMEOUT) as response,
        ):
            if response.status == 200:
                return True
    return False


def matches_filter_criteria(repo: dict) -> bool:
    repo_name = repo.get("name", "")
    description = repo.get("description") or ""
    combined_text = f"{repo.get('full_name', '')} {description}".lower()

    if any(keyword.lower() in combined_text for keyword in EXCLUDED_KEYWORDS):
        return False

    return bool(MORPHE_NAME_RE.search(repo_name))


def search_repositories() -> list[dict]:
    unique_repos = {}

    for keyword in SEARCH_KEYWORDS:
        query = build_search_query(keyword)
        print(f"Searching GitHub: {query}\n")
        page = 1

        while True:
            encoded_query = urllib.parse.quote(query)
            url = f"https://api.github.com/search/repositories?q={encoded_query}&sort=updated&per_page={PAGE_SIZE}&page={page}"
            try:
                page_data = fetch(url, timeout=SEARCH_TIMEOUT, as_json=True)
            except Exception as error:
                print(f"Failed to fetch page {page}: {error}")
                break

            items = page_data.get("items", []) if isinstance(page_data, dict) else []
            if not items:
                break

            total_count = page_data.get("total_count", 0)
            print(f"Fetched page {page} ({len(items)} items, total: {total_count})")

            for repo in items:
                if full_name := repo.get("full_name", "").lower():
                    unique_repos.setdefault(full_name, repo)

            if page * PAGE_SIZE >= total_count or page >= MAX_PAGES:
                break

            page += 1
            time.sleep(PAGE_DELAY_SECONDS)

        print(f"\nTotal raw repositories collected: {len(unique_repos)}")

    repos_list = list(unique_repos.values())
    save_json(RAW_SEARCH_PATH, repos_list)
    print(
        f"Saved {len(repos_list)} raw repositories to {RAW_SEARCH_PATH.relative_to(ROOT_DIR)}\n"
    )
    return repos_list


def filter_repositories(repositories: list[dict] | None = None) -> list[dict]:
    if repositories is None:
        if not RAW_SEARCH_PATH.exists():
            print(
                f"Raw search file not found: {RAW_SEARCH_PATH.relative_to(ROOT_DIR)}. Run with --search first."
            )
            return []
        repositories = load_json(RAW_SEARCH_PATH, [])
        print(
            f"Loaded {len(repositories)} repositories from {RAW_SEARCH_PATH.relative_to(ROOT_DIR)}"
        )

    if not repositories:
        print("Repository list is empty. Skipping filter step.")
        return []

    excluded_repos = sync_excluded_repos()
    print(
        f"Synced {len(excluded_repos)} excluded repositories from README & {EXCLUDED_REPOS_PATH.name}"
    )

    candidates = [
        repo
        for repo in repositories
        if repo.get("full_name", "").lower() not in excluded_repos
        and matches_filter_criteria(repo)
    ]
    print(
        f"Filtered {len(candidates)} candidate repositories (excluded {len(repositories) - len(candidates)} repos)."
    )

    save_json(RAW_FILTER_PATH, candidates)
    print(
        f"Saved {len(candidates)} candidates to {RAW_FILTER_PATH.relative_to(ROOT_DIR)}\n"
    )
    return candidates


def verify_and_export_projects(candidates: list[dict] | None = None) -> list[dict]:
    if candidates is None:
        if not RAW_FILTER_PATH.exists():
            print(
                f"Filtered file not found: {RAW_FILTER_PATH.relative_to(ROOT_DIR)}. Run with --filter first."
            )
            return []
        candidates = load_json(RAW_FILTER_PATH, [])
        print(
            f"Loaded {len(candidates)} candidates from {RAW_FILTER_PATH.relative_to(ROOT_DIR)}"
        )

    if not candidates:
        print("Candidate list is empty. Skipping verification.")
        return []

    print(
        f"Checking {len(candidates)} candidates for patches-bundle.json across branches {CHECK_BRANCHES}...\n"
    )
    valid_repos = []
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        future_to_repo = {
            executor.submit(is_patch_bundle, repo.get("full_name", "")): repo
            for repo in candidates
        }
        for future in as_completed(future_to_repo):
            repo = future_to_repo[future]
            if not future.result():
                valid_repos.append(repo)

    projects = [
        {
            "full_name": repo.get("full_name", ""),
            "stars": repo.get("stargazers_count", 0),
            "description": repo.get("description") or "",
            "created_at": (repo.get("created_at") or "")[:10],
            "pushed_at": (repo.get("pushed_at") or "")[:10],
            "url": repo.get("html_url", ""),
        }
        for repo in valid_repos
    ]
    projects.sort(
        key=lambda item: (
            item["stars"],
            item["pushed_at"],
            item["created_at"],
            item["full_name"].lower(),
        ),
        reverse=True,
    )

    query_summary = ", ".join(
        build_search_query(keyword) for keyword in SEARCH_KEYWORDS
    )
    excluded_keywords = ", ".join(EXCLUDED_KEYWORDS)
    markdown_lines = [
        "### 🔍 Found Projects",
        "",
        f"- **Query:** `{query_summary}`",
        f"- **Excluded Keywords:** {excluded_keywords}, non-standalone morphe variants",
        f"- **Total Found:** `{len(projects)}`",
        f"- **Scanned At:** `{datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}`",
        "",
    ]
    for project in projects:
        description = (
            f"- **Description:** {project['description']}\n"
            if project["description"]
            else ""
        )
        markdown_lines.append(
            f"#### [{project['full_name']}]({project['url']}) (⭐ {project['stars']})\n"
            f"- **Created:** `{project['created_at']}` | **Updated:** `{project['pushed_at']}`\n"
            f"{description}"
        )

    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_TEXT_PATH.write_text(
        "\n".join(project["url"] for project in projects) + "\n", encoding="utf-8"
    )
    append_step_summary("\n".join(markdown_lines))

    print(
        f"Saved {len(projects)} URLs to {OUTPUT_TEXT_PATH.relative_to(ROOT_DIR)} (excluded {len(candidates) - len(projects)} patch bundles)"
    )
    return projects


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Find and filter standalone repositories in the Morphe ecosystem."
    )
    parser.add_argument(
        "--search",
        action="store_true",
        help="Fetch raw repositories from GitHub Search API.",
    )
    parser.add_argument(
        "--filter",
        action="store_true",
        help="Filter raw repositories by keywords and exclusion list.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify patch bundle status and export output files.",
    )

    args = parser.parse_args()

    if args.search:
        search_repositories()
    elif args.filter:
        filter_repositories()
    elif args.check:
        verify_and_export_projects()
    else:
        raw_repos = search_repositories()
        candidates = filter_repositories(raw_repos)
        verify_and_export_projects(candidates)

    return 0


if __name__ == "__main__":
    sys.exit(main())
