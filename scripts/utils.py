import contextlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def get_auth_headers(url: str, headers: dict[str, str] | None = None) -> dict[str, str]:
    result_headers = dict(headers) if headers else {}
    parsed_url = urllib.parse.urlparse(url)
    hostname = parsed_url.hostname or ""
    is_github = hostname.endswith(("github.com", "githubusercontent.com"))

    if "User-Agent" not in result_headers:
        if is_github:
            result_headers["User-Agent"] = (
                "AwesomeMorphe/1.0 (+https://github.com/nvbangg/awesome-morphe)"
            )
        else:
            result_headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

    github_token = os.environ.get("GITHUB_TOKEN")
    if is_github and github_token and "Authorization" not in result_headers:
        result_headers["Authorization"] = f"Bearer {github_token}"

    return result_headers


def fetch(
    url: str,
    headers: dict[str, str] | None = None,
    timeout: int = 15,
    as_json: bool = False,
    binary: bool = False,
) -> Any:
    request_headers = get_auth_headers(url, headers)

    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=request_headers)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                content = response.read()
                if binary:
                    return content
                decoded = content.decode("utf-8")
                return json.loads(decoded) if as_json else decoded

        except Exception as error:
            if isinstance(error, urllib.error.HTTPError) and error.code not in (
                401,
                403,
                429,
            ):
                raise
            if attempt < 2:
                time.sleep(1)
            else:
                raise

    raise RuntimeError(f"Failed to fetch {url}")


def append_step_summary(markdown_content: str) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path and markdown_content.strip():
        with (
            contextlib.suppress(Exception),
            Path(summary_path).open("a", encoding="utf-8") as file,
        ):
            file.write(markdown_content.strip() + "\n\n")


def load_json(path: str | Path, default: Any = None) -> Any:
    path = Path(path)
    if path.exists():
        with (
            contextlib.suppress(OSError, json.JSONDecodeError),
            path.open(encoding="utf-8") as file,
        ):
            return json.load(file)
    return default if default is not None else {}


def save_json(path: str | Path, data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
        file.write("\n")


def load_lines(path: str | Path) -> list[str]:
    path = Path(path)
    if not path.exists():
        return []
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]


def parse_timestamp(timestamp: Any) -> int:
    if not timestamp:
        return 0
    if isinstance(timestamp, (int, float)):
        return int(timestamp)
    if isinstance(timestamp, str) and timestamp.isdigit():
        return int(timestamp)
    with contextlib.suppress(Exception):
        parsed_datetime = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
        tz_aware = (
            parsed_datetime
            if parsed_datetime.tzinfo
            else parsed_datetime.replace(tzinfo=UTC)
        )
        return int(tz_aware.timestamp() * 1000)
    return 0


_REPO_URL_RE = re.compile(
    r"(github|gitlab)\.com/([^/#?]+)/([^/#?]+?)(?:\.git)?(?:[/#?]|$)", re.IGNORECASE
)


def parse_repo_url(repo_url: str) -> tuple[str, str] | tuple[None, None]:
    if repo_url and (match := _REPO_URL_RE.search(repo_url)):
        source, owner, repo = match.groups()
        return source.lower(), f"{owner}/{repo}"
    return None, None


def build_api_url(source: str, repo: str) -> str | None:
    if source == "github":
        return f"https://api.github.com/repos/{repo}"
    if source == "gitlab":
        encoded_repo = urllib.parse.quote(repo, safe="")
        return f"https://gitlab.com/api/v4/projects/{encoded_repo}"
    return None


def build_raw_url(source: str, repo: str, branch: str, file_path: str) -> str | None:
    if source == "github":
        return f"https://raw.githubusercontent.com/{repo}/{branch}/{file_path}"
    if source == "gitlab":
        encoded_repo = urllib.parse.quote(repo, safe="")
        encoded_file = urllib.parse.quote(file_path, safe="")
        return f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/{encoded_file}/raw?ref={branch}"
    return None


def check_link_status(url: str, timeout: int = 5) -> dict:
    try:
        headers = get_auth_headers(url)
        request = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(request, timeout=timeout) as response:
            final_url = response.geturl().rstrip("/")
            original_url = url.rstrip("/")
            if final_url.lower() != original_url.lower():
                return {"is_redirect": True, "final_url": final_url}
            return {"is_active": True}
    except urllib.error.HTTPError as error:
        if error.code in (404, 410):
            return {"is_dead": True, "error": f"HTTP {error.code}"}
        return {"error": f"HTTP {error.code}"}
    except Exception as error:
        return {"error": str(error)}
