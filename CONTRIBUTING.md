### [nvbangg/awesome-morphe](https://github.com/nvbangg/awesome-morphe)

> [!NOTE]
> This document contains the project structure and automation workflows for the [Awesome Morphe Website](https://awesome-morphe.vercel.app/).

## 📂 Project Structure

```text
awesome-morphe/
├── .github/                            # CI/CD workflows & configurations
├── data/                               # Raw data storage
├── scripts/                            # Automated scripts for data processing
│   ├── discover.py                     # Discovers all bundles from providers
│   ├── fetch.py                        # Checks for updates
│   ├── parse.py                        # Extracts patch metadata via bundle-parser
│   ├── update.py                       # Compiles raw data into production JSONs
│   ├── telegram.py                     # Telegram notification service
│   ├── whats_new.py                    # Generates release changelog
│   └── ...                             # Other supporting files
├── web/                                # Website source code
│   ├── public/
│   │   ├── bundles.json                # Metadata of all active bundles and apps
│   │   └── whats-new.json              # Rolling changelog (last 21 releases)
│   └── ...                             # Other supporting files
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## 🤖 Automation Workflows

### 1. Sync Workflow (`ci.yml` - Every 2 hours)

```mermaid
flowchart TD
    A["Sync Workflow (ci.yml)"] --> B["Discover bundles (discover.py)"]
    B --> C["Check updates (fetch.py)"]
    C --> D{Changes?}

    D -->|Yes| E["Parse bundles (parse.py) + Compile data (update.py)"]
    D -->|No| F[Skip]

    E --> G[Commit & push]
    G --> H[Complete]
    F --> H
```

### 2. Release Workflow (`release.yml` - Daily at 23:30 UTC)

```mermaid
flowchart TD
    J["Release Workflow (release.yml)"] --> K["Discover bundles (discover.py)"]
    K --> L["Check updates + images (fetch.py --image)"]
    L --> M["Parse bundles (parse.py)"]
    M --> N["Compile data (update.py --daily/--month)"]
    N --> O["Generate changelog (whats_new.py)"]
    O --> P[Commit & push]
    P --> Q{Changes?}

    Q -->|Yes| R["Send notifications (telegram.py)"]
    Q -->|No| S[Complete]
    R --> S
```

## 🛠️ Usage / Scripts

All core automation logic is written in Python inside the `scripts/` directory.

### `discover.py`

Scans community patch repositories and synchronizes them directly into `data/repos.json` (adding new repositories and auto-pruning removed ones).

#### Discovered Sources

- nvbangg's custom sources defined in [`data/discover/custom.json`](data/discover/custom.json)
- [Morphe Community Patches](https://morphe-patches.software)
- [Jman's ReVanced Patch Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles)
- [Morphe Archive](https://github.com/rushiforai/morphe-archive)

#### Customization

Manually add or remove target repositories in [`data/discover/custom.json`](data/discover/custom.json).

```json
{
  "github:owner/repo": {},
  "gitlab:owner/repo-to-exclude": {
    "enabled": false
  }
}
```

### `fetch.py`

Downloads raw patch lists and bundle metadata from remote sources based on `data/repos.json`.
It checks for new SHAs, downloads `patches-bundle.json` into `data/bundles/`, the corresponding `.mpp` file into `scripts/bundle-parser/mpp/` to extract the bundle name, and `patches-list.json` (if available) into `data/patches/`. Pending SHA and name updates are written to `scripts/bundle-parser/pending_repos.json`. Updated `.mpp` target paths are written to `scripts/bundle-parser/updated_files.txt` (only generated when there are bundles without a `patches-list.json`). With the `--image` flag, it also fetches the bundle avatar image SHA for each repo.

### `parse.py`

Executes the Kotlin-based `bundle-parser` (adapted from [Jman's ReVanced Patch Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles) to fit this project and Morphe) to parse `.mpp` files listed in `scripts/bundle-parser/updated_files.txt` and extract structured patch lists into `data/patches/`. Upon successful parsing, it commits pending commit SHAs and bundle names from `scripts/bundle-parser/pending_repos.json` into `data/repos.json`.

### `update.py`

Compiles and syncs data from raw JSON files (`data/repos.json`, `data/bundles/`, and `data/patches/`) into the main public database file (`web/public/bundles.json`). Missing metadata is scraped from Google Play (with a fallback to official Morphe data) or fetched via GitHub/GitLab APIs. It automatically cleans up orphaned bundle and patch files from local storage if they no longer exist in `data/repos.json`.

Supported execution modes:

- **Default mode**: Compiles data from local JSON files, fetches GitHub/GitLab repository info (stars, avatar, and repository description) for new bundles, and retrieves any missing app metadata (name, icon, or description) from Google Play for newly discovered apps not yet available locally.
- `--daily`: Same as default, but also refreshes GitHub/GitLab repository info for all bundles and retrieves any missing app metadata from Google Play for all existing apps.
- `--month`: Same as `--daily`, but also forces a full re-scrape of all app metadata from Google Play for all existing applications, overwriting current values.

### `whats_new.py`

Generates `web/public/whats-new.json` (rolling changelog for the website) and `whats-new.md` (used for GitHub release notes and Telegram notifications) by comparing current patch data against the previous release state in `data/history.json`.

### `telegram.py`

Sends release notifications to a Telegram channel (`TG_CHAT`) using the Telegram Bot API (`TG_TOKEN`). Supports the following usage:

- **Default**: Posts `whats-new.md` with an auto-generated title (`🔔 What's New (Month Day)`).
- With `"Custom Title"`: Posts `whats-new.md` with the specified title.
- With `"Custom Title" "path/to/file.md"`: Posts the specified markdown file with the specified title.
