import json
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Union


def fetch(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 15,
    as_json: bool = False,
) -> Any:
    if headers is None:
        headers = {}
    headers.setdefault("User-Agent", "AwesomeMorphe/1.0")

    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                content = response.read().decode("utf-8")
            return json.loads(content) if as_json else content

        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 429) and attempt < 2:
                wait = 2**attempt
                time.sleep(wait)
            else:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < 2:
                time.sleep(1)
            else:
                raise

    raise RuntimeError(f"Failed to fetch {url}")


def load_json(path: Union[str, Path], default: Any = None) -> Any:
    path = Path(path)
    if not path.exists():
        return default if default is not None else {}
    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError:
        print(f"[-] Corrupted JSON file: {path}")
        return default if default is not None else {}
    except IOError:
        return default if default is not None else {}


def save_json(path: Union[str, Path], data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as file:
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
        from datetime import timezone
        timestamp_str = str(timestamp).replace("Z", "+00:00")
        dt = datetime.fromisoformat(timestamp_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        utc_timestamp = dt.timestamp()
        return int(utc_timestamp * 1000)
    except Exception:
        return 0
