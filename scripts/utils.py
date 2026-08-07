import json
import re
import time
import urllib.error
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


def _set_query_param(url: str, pattern: str, param: str) -> str:
    if re.search(pattern, url):
        return re.sub(pattern, rf"\1{param}", url)
    return f"{url}&{param}" if "?" in url else f"{url}?{param}"


def normalize_image_url(url: str) -> str:
    if not url or not isinstance(url, str):
        return ""
    if "googleusercontent.com" in url or "ggpht.com" in url:
        return re.sub(r"=(?:s|w)\d+.*$", "", url) + "=s64-rw"
    if "avatars.githubusercontent.com" in url or "gravatar.com" in url:
        return _set_query_param(url, r"([?&])(?:size|s)=\d+", "s=64")
    if "gitlab.com" in url:
        return _set_query_param(url, r"([?&])width=\d+", "width=64")
    return url
