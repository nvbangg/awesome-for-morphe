# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import sys
import os
import urllib.request
import urllib.parse
from pathlib import Path
import datetime
import re
import html

WHATS_NEW_PATH = Path("whats-new.md")


def convert_to_html(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"~~(.*?)~~", r"<s>\1</s>", escaped)
    escaped = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"\*(.*?)\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`(.*?)`", r"<code>\1</code>", escaped)

    def replace_link(match):
        link_text = match.group(1)
        url = html.unescape(match.group(2))
        url_quoted = urllib.parse.quote(url, safe=":/%#?=&@+$,-_.!~*'()")
        return f'<a href="{url_quoted}">{link_text}</a>'

    return re.sub(
        r"\[([^\]]+)\]\((https?://[^\s()]+(?:\([^\s()]+\)[^\s()]*)*)\)",
        replace_link,
        escaped,
    )


def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    title = sys.argv[1] if len(sys.argv) >= 2 else f"🔔 What's New ({now.strftime('%B')} {now.day})"
    filepath = Path(sys.argv[2]) if len(sys.argv) >= 3 else WHATS_NEW_PATH

    if not filepath.exists() or not (content := filepath.read_text(encoding="utf-8").strip()):
        print(f"File {filepath} not found or empty, skipping notification.")
        return

    lines = [line.lstrip("# ") if line.startswith("#") else line for line in content.splitlines() if not line.startswith(("📢 *Telegram:*", "📢 _Telegram:"))]
    formatted_content = convert_to_html("\n".join(lines).strip())
    formatted_title = f"<b>{html.escape(title)}</b>"

    token = os.environ.get("TG_TOKEN")
    chat_id = os.environ.get("TG_CHAT")
    if not token or not chat_id:
        raise SystemExit("Error: TG_TOKEN or TG_CHAT environment variables are not set.")

    data = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": f"{formatted_title}\n\n{formatted_content}",
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        }
    ).encode("utf-8")

    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data, method="POST")
    try:
        with urllib.request.urlopen(req):
            print("Telegram notification sent successfully.")
    except Exception as e:
        raise SystemExit(f"Failed to send Telegram notification: {e}")


if __name__ == "__main__":
    main()
