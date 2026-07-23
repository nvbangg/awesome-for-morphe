# Copyright (c) 2026 nvbangg (github.com/nvbangg)

import datetime
import re
import urllib.parse
from pathlib import Path

from utils import load_json, save_json

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PATCHES_DIR = DATA_DIR / "patches"
HISTORY_PATH = DATA_DIR / "history.json"
APPS_JSON_PATH = ROOT / "docs" / "apps.json"
SKIP_WORDS_PATH = ROOT / "docs" / "assets" / "skip-words.json"
WHATS_NEW_PATH = ROOT / "whats-new.md"
WHATS_NEW_JSON_PATH = ROOT / "docs" / "whats-new.json"


def collect_apps(list_json):
    patches_dict = {}
    for patch in list_json.get("patches") or []:
        patch_name = patch.get("name")
        if not patch_name:
            continue

        compatible = patch.get("compatiblePackages")
        package_names = set()

        if isinstance(compatible, dict):
            # Old format: dict of package names
            package_names.update(compatible.keys())
        elif isinstance(compatible, list):
            # New format: list of objects
            for item in compatible:
                if isinstance(item, dict) and (package_name := item.get("packageName")):
                    package_names.add(package_name)

        for package_name in package_names or {"universal"}:
            patches_dict.setdefault(package_name, set()).add(patch_name)

    return {package_name: sorted(list(patches_dict[package_name])) for package_name in sorted(patches_dict)}


def build_current_bundles():
    main_dict, dev_dict = {}, {}
    for patch_file in sorted(PATCHES_DIR.glob("*.json"), key=lambda p: p.name.lower()):
        match = re.match(r"(.*)~(main|dev)\.json$", patch_file.name)
        if not match:
            continue
        base, channel = match.groups()
        # base here is something like "github~AlexNaga~android-patches"
        # we need to convert it to "github:AlexNaga/android-patches"
        if "~" in base:
            parts = base.split("~")
            if len(parts) >= 3:
                base = f"{parts[0]}:{parts[1]}/{parts[2]}"

        list_json = load_json(patch_file)
        if not list_json:
            continue
        target = main_dict if channel == "main" else dev_dict
        target[base] = collect_apps(list_json)

    return main_dict, dev_dict


# Inspired by code from Paresh Maheshwari
def derive_name(package_name, skip_words):
    parts = [part for part in package_name.split(".") if part not in skip_words and len(part) > 1]
    name = parts[-1] if parts else package_name.split(".")[-1]
    return name.replace("-", " ").replace("_", " ").title()


def format_app_name(package_name, app_metadata, skip_words):
    meta = app_metadata.get(package_name)
    if isinstance(meta, dict) and meta.get("name"):
        return meta["name"]
    if isinstance(meta, str):
        return meta
    return derive_name(package_name, skip_words)


def format_patch(patch_name):
    if any(char in patch_name for char in [":", ",", "(", ")"]):
        return f'"{patch_name}"'
    return patch_name


def stringify_trie(bundles_dict):
    bundle_strs = []
    for bundle, apps in bundles_dict.items():
        if not apps:
            bundle_strs.append(bundle)
        else:
            app_strs = []
            for app, patches in apps.items():
                if not patches:
                    app_strs.append(app)
                elif len(patches) == 1:
                    app_strs.append(f"{app}:{format_patch(patches[0])}")
                else:
                    patch_strs = [format_patch(patch_name) for patch_name in patches]
                    app_strs.append(f"{app}:({','.join(patch_strs)})")

            if len(app_strs) == 1:
                bundle_strs.append(f"{bundle}:{app_strs[0]}")
            else:
                bundle_strs.append(f"{bundle}:({','.join(app_strs)})")
    return ",".join(bundle_strs)


def make_url(bundle, app=None, patches=None):
    url = "https://awesome-morphe.vercel.app/"
    query = []

    if patches:
        trie_dict = {bundle: {app: list(patches)}}
        trie_str = stringify_trie(trie_dict)
        q = urllib.parse.quote(trie_str, safe=':,"()')
        query.append(f"show={q}")
    elif app:
        query.append(f"show={bundle}:{app}")
    else:
        query.append(f"show={bundle}")

    if query:
        url += "?" + "&".join(query)
    url += "#whats-new"
    return url


def is_valid_pkg(package_name):
    return ("." in package_name and " " not in package_name) or package_name == "universal"


def build_json_diff(old_bundles, new_bundles, app_metadata, skip_words):
    json_diff = {}

    def app_sort_key(pkg):
        return (
            pkg == "universal",
            format_app_name(pkg, app_metadata, skip_words).lower(),
        )

    for key, patches_dict in sorted(new_bundles.items(), key=lambda x: x[0].lower()):
        new_package_names = {pkg for pkg in patches_dict if is_valid_pkg(pkg)}

        if key not in old_bundles:
            json_diff[key] = {
                "isNew": True,
                "apps": {
                    pkg: {
                        "isNew": True,
                        "patches": sorted(list(patches_dict.get(pkg, []))),
                    }
                    for pkg in sorted(new_package_names, key=app_sort_key)
                },
            }
        else:
            old_patches_dict = old_bundles[key]
            old_package_names = {pkg for pkg in old_patches_dict if is_valid_pkg(pkg)}
            apps_dict = {}

            for pkg in sorted(new_package_names, key=app_sort_key):
                if pkg not in old_package_names:
                    apps_dict[pkg] = {
                        "isNew": True,
                        "patches": sorted(list(patches_dict.get(pkg, []))),
                    }
                else:
                    added_patches = set(patches_dict.get(pkg, [])) - set(old_patches_dict.get(pkg, []))
                    if added_patches:
                        apps_dict[pkg] = {
                            "isNew": False,
                            "patches": sorted(list(added_patches)),
                        }

            if apps_dict:
                json_diff[key] = {"isNew": False, "apps": apps_dict}

    return json_diff


def generate_markdown(json_diff, app_metadata, skip_words):
    all_changes = {}
    markdown_lines = []

    for bundle_key, bundle_data in json_diff.items():
        is_new_bundle = bundle_data.get("isNew", False)
        apps_data = bundle_data.get("apps", {})

        if is_new_bundle:
            all_changes[bundle_key] = {}
        else:
            added_package_names = [package_name for package_name, data in apps_data.items() if data.get("isNew", False)]
            patched_package_names = [package_name for package_name, data in apps_data.items() if not data.get("isNew", False)]

            if added_package_names:
                if bundle_key not in all_changes:
                    all_changes[bundle_key] = {}
                for package_name in added_package_names:
                    all_changes[bundle_key][package_name] = []

            if patched_package_names:
                if bundle_key not in all_changes:
                    all_changes[bundle_key] = {}
                for package_name in patched_package_names:
                    if package_name not in all_changes[bundle_key]:
                        all_changes[bundle_key][package_name] = []
                    all_changes[bundle_key][package_name].extend(apps_data[package_name].get("patches", []))

        if is_new_bundle:
            url = make_url(bundle_key)
            link = f"[{bundle_key}]({url})"
            bundle_md = [f"+ 📦 {link} (✨New)"]

            for package_name in apps_data.keys():
                app_name = format_app_name(package_name, app_metadata, skip_words)
                bundle_md.append(f"    - 📱 {app_name}")

            markdown_lines.append("\n".join(bundle_md))
        else:
            bundle_changes = {}
            for package_name, data in apps_data.items():
                if data.get("isNew", False):
                    bundle_changes[package_name] = []
                else:
                    bundle_changes[package_name] = sorted(data.get("patches", []))

            trie_dict = {bundle_key: bundle_changes}
            trie_str = stringify_trie(trie_dict)
            q = urllib.parse.quote(trie_str, safe=':,"')
            url = f"https://awesome-morphe.vercel.app/?show={q}#whats-new"

            link = f"[{bundle_key}]({url})"
            bundle_md = [f"- 📦 {link}"]

            for package_name in apps_data.keys():
                app_data = apps_data[package_name]
                app_name = format_app_name(package_name, app_metadata, skip_words)

                if app_data.get("isNew", False):
                    bundle_md.append(f"    + 📱 {app_name} (✨New)")
                else:
                    bundle_md.append(f"    - 📱 {app_name}")
                    for p in sorted(app_data.get("patches", [])):
                        bundle_md.append(f"        + 🧩 `{p}` (✨New)")

            markdown_lines.append("\n".join(bundle_md))

    sections = []
    if all_changes:
        full_url = "https://awesome-morphe.vercel.app/#whats-new"
        sections.append(f"✨ [_View full changelog_]({full_url})")

    if markdown_lines:
        sections.append("\n".join(markdown_lines))

    if not sections:
        return ""

    sections.insert(0, "📢 _Telegram: [@awesome_morphe](https://t.me/awesome_morphe)_")
    return "\n\n".join(sections)


def main():
    if not any(PATCHES_DIR.glob("*.json")):
        raise SystemExit("No patches found — run download.py first")

    old_history = load_json(HISTORY_PATH, {}) or {}
    app_metadata = load_json(APPS_JSON_PATH, {})
    skip_words = load_json(SKIP_WORDS_PATH, []) or []
    whats_new_data = load_json(WHATS_NEW_JSON_PATH, []) or []

    # Shift time back by 12 hours to handle GitHub Actions delays
    now = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=12)
    today_str = now.strftime(f"%B {now.day}, %Y")

    _, new_dev = build_current_bundles()
    json_diff = build_json_diff(old_history, new_dev, app_metadata, skip_words)

    if not json_diff:
        print("No changes found.")
        return

    # Create markdown
    markdown_str = generate_markdown(json_diff, app_metadata, skip_words)
    if markdown_str:
        WHATS_NEW_PATH.write_text(markdown_str + "\n", encoding="utf8")
        print("What's New MD created.")
    else:
        print("No changes to write to MD.")

    # Insert today's JSON entry
    whats_new_data.insert(0, {"date": today_str, "bundles": json_diff})

    whats_new_data = whats_new_data[:30]
    save_json(WHATS_NEW_JSON_PATH, whats_new_data)
    print("Updated whats-new.json.")

    save_json(HISTORY_PATH, new_dev)
    print("History updated for a new baseline.")


if __name__ == "__main__":
    main()
