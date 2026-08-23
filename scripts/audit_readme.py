# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from updater.repo_info import fetch_repo_details
from utils import (
    append_step_summary,
    build_repo_url,
    check_link_status,
    load_lines,
    parse_repo_url,
)

ROOT_DIR = Path(__file__).resolve().parents[1]
PROJECTS_DIR = ROOT_DIR / "data" / "projects"
README_REPOS_PATH = PROJECTS_DIR / "readme-repos.txt"
README_LINKS_PATH = PROJECTS_DIR / "readme-links.txt"
CONCURRENCY = 8


def audit_repos_and_links() -> dict[str, list[str]]:
    repo_urls = load_lines(README_REPOS_PATH)
    link_urls = load_lines(README_LINKS_PATH)
    print(
        f"Auditing {len(repo_urls)} repositories and {len(link_urls)} links from README..."
    )

    errors: dict[str, list[str]] = {"unavailable": [], "warnings": [], "other": []}

    if repo_urls:
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
            future_to_url = {
                executor.submit(fetch_repo_details, url): url for url in repo_urls
            }
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    details = future.result()
                except Exception as error:
                    details = {"error": str(error)}

                if details.get("is_404"):
                    errors["unavailable"].append(f"{url}: Not Found (404)")
                elif details.get("is_451"):
                    errors["unavailable"].append(f"{url}: DMCA Takedown (451)")
                elif details.get("is_archived"):
                    errors["warnings"].append(f"{url}: Archived")
                elif full_name := details.get("full_name"):
                    source, original_repo = parse_repo_url(url)
                    if original_repo and full_name.lower() != original_repo.lower():
                        errors["warnings"].append(
                            f"{url} -> {build_repo_url(source, full_name)}"
                        )
                elif details.get("error"):
                    errors["other"].append(f"{url}: {details['error']}")

    if link_urls:
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
            future_to_link = {
                executor.submit(check_link_status, url): url for url in link_urls
            }
            for future in as_completed(future_to_link):
                url = future_to_link[future]
                try:
                    status = future.result()
                except Exception as error:
                    status = {"error": str(error)}

                if status.get("is_dead"):
                    errors["unavailable"].append(
                        f"{url}: {status.get('error', 'Dead')}"
                    )
                elif status.get("is_redirect"):
                    errors["warnings"].append(f"{url} -> {status.get('final_url', '')}")
                elif status.get("error"):
                    errors["other"].append(f"{url}: {status['error']}")

    completed_message = (
        f"Audited {len(repo_urls)} repositories and {len(link_urls)} links."
    )
    print(completed_message)

    summary_sections = [f"## 📋 Audit Readme\n{completed_message}"]
    for category_name, category_icon, category_errors in (
        ("Unavailable", "⛔", errors["unavailable"]),
        ("Warnings", "⚠️", errors["warnings"]),
        ("Other Errors", "🌐", errors["other"]),
    ):
        if category_errors:
            summary_sections.append(
                f"### {category_icon} {category_name} ({len(category_errors)})\n"
                + "\n".join(f"- {error}" for error in sorted(category_errors))
            )

    append_step_summary("\n\n".join(summary_sections))
    return errors


def main() -> int:
    audit_repos_and_links()
    return 0


if __name__ == "__main__":
    sys.exit(main())
