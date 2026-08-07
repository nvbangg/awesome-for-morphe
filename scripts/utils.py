import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def fetch(
    url: str,
    headers: dict[str, str] | None = None,
    timeout: int = 15,
    as_json: bool = False,
    binary: bool = False,
) -> Any:
    if headers is None:
        headers = {}
    headers.setdefault("User-Agent", "AwesomeMorphe/1.0")

    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                content = response.read()
                if binary:
                    return content
                decoded = content.decode("utf-8")
                return json.loads(decoded) if as_json else decoded

        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 429) and attempt < 2:
                time.sleep(2**attempt)
            else:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < 2:
                time.sleep(1)
            else:
                raise

    raise RuntimeError(f"Failed to fetch {url}")


def load_json(path: str | Path, default: Any = None) -> Any:
    path = Path(path)
    if not path.exists():
        return default if default is not None else {}
    try:
        with path.open(encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return default if default is not None else {}


def save_json(path: str | Path, data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)
        file.write("\n")


def parse_timestamp(timestamp: Any) -> int:
    if not timestamp:
        return 0
    if isinstance(timestamp, int):
        return timestamp
    if isinstance(timestamp, str) and timestamp.isdigit():
        return int(timestamp)
    try:
        timestamp_str = str(timestamp).replace("Z", "+00:00")
        dt = datetime.fromisoformat(timestamp_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0


def build_raw_url(
    source: str, owner_repo: str, branch: str, file_path: str
) -> str | None:
    if source == "github":
        return f"https://raw.githubusercontent.com/{owner_repo}/{branch}/{file_path}"
    if source == "gitlab":
        encoded_repo = urllib.parse.quote(owner_repo, safe="")
        encoded_file = urllib.parse.quote(file_path, safe="")
        return f"https://gitlab.com/api/v4/projects/{encoded_repo}/repository/files/{encoded_file}/raw?ref={branch}"
    return None
