import re


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
