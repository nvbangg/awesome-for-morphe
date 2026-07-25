### [nvbangg/awesome-morphe](https://github.com/nvbangg/awesome-morphe)

> [!NOTE]
> This document contains contribution guidelines, project structure details, and automation workflows for the [Awesome Morphe Website](https://awesome-morphe.vercel.app/).

## 📬 Contributing

- To add or remove a bundle source, please submit a [Bundle Request](https://github.com/nvbangg/awesome-morphe/issues/new?template=bundle-request.yml).
- For any other issues, suggestions, or questions, feel free to [open a new issue](https://github.com/nvbangg/awesome-morphe/issues/new).

## 📂 Project Structure & Data

```text
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── bundle-request.yml           # Issue template to add or remove a bundle source
│   └── workflows/
│       ├── ci.yml                       # Sync workflow (every 2 hours)
│       └── release.yml                  # Daily release workflow (23:00 UTC)
├── data/
│   ├── bundles/                         # Raw patch bundles downloaded from upstream
│   ├── patches/                         # Raw patch lists downloaded from upstream
│   ├── discover/                        # Discovered sources data
│   │   ├── custom.json                  # Custom entries to add or remove bundles
│   │   ├── discover.json                # Compiled list of all discovered bundles
│   │   ├── jman.json                    # Bundles discovered from Jman
│   │   ├── morphe-archive.json          # Bundles discovered from Morphe Archive
│   │   ├── official.json                # Bundles discovered from the Official Website
│   │   └── snapshot.json                # Snapshots of the discovered state
│   ├── history.json                     # Baseline sync state for tracking patch updates
│   └── repos.json                       # Database tracking remote ETags/SHAs of all discovered bundles
├── docs/                                # Website deployment folder
│   ├── assets/                          # Contains assets needed for the website
│   ├── apps.json                        # Metadata of all apps
│   ├── bundles.json                     # Central compiled index of all active bundles
│   ├── index.html                       # Frontend main webpage interface (compiled)
│   └── whats-new.json                   # Rolling changelog JSON of last 30 releases
├── scripts/
│   ├── providers/                       # Scraper providers for discovery
│   │   ├── jman.py                      # Jman repository parser
│   │   ├── morphe_archive.py            # Morphe Archive parser
│   │   └── official.py                  # Official Website parser
│   ├── updater/                         # Modules for data compilation
│   │   ├── gplay_scrape.py              # Scrapes app metadata from Google Play
│   │   ├── local_parse.py               # Parses local bundle and patch data
│   │   └── repo_info.py                 # Fetches repository info
│   ├── bundle-parser/                   # Kotlin parser for patch lists
│   ├── discover.py                      # Scans providers and merges discoveries into data/discover/discover.json
│   ├── fetch.py                         # Fetches raw patch lists and bundles based on discovered repos
│   ├── parse.py                         # Runs bundle-parser to extract patches from downloaded files
│   ├── update.py                        # Processes raw databases into optimized web formats
│   ├── telegram.py                      # Sends Telegram notifications
│   ├── utils.py                         # Shared utility functions
│   └── whats_new.py                     # Diffs updates and compiles rolling release logs
├── web/                                 # Website source code and Vite bundler configuration
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## 🤖 Automation

This project uses GitHub Actions to automate data synchronization and release cycles:

### 1. Sync Workflow (`ci.yml` - Every 2 hours)

Checks for upstream bundle changes and updates the compiled website database:

1. Discover patch repositories: `python scripts/discover.py`
2. Fetch raw bundle metadata and patch lists: `python scripts/fetch.py`
3. If changes are detected:
   - Parse downloaded bundles into patches: `python scripts/parse.py`
   - Compile optimized web assets: `python scripts/update.py`
   - Commit and push changes directly to the `main` branch.

### 2. Release Workflow (`release.yml` - Daily at 23:00 UTC)

Runs daily maintenance, builds release notes, and notifies subscribers:

1. Discover patch repositories: `python scripts/discover.py`
2. Fetch upstream updates: `python scripts/fetch.py`
3. Parse downloaded bundles into patches: `python scripts/parse.py`
4. Compile data: `python scripts/update.py --month` (on the 1st of the month) or `python scripts/update.py --daily` (other days).
5. Generate release changelog: `python scripts/whats_new.py`
6. Commit and push updates, then create a new GitHub Release.
7. Send notification to Telegram channel: `python scripts/telegram.py`

## 🛠️ Usage / Scripts

All core automation logic is written in Python inside the `scripts/` directory.

### `discover.py`

Scans community patch repositories and merges them into `data/discover/discover.json`.

#### Discovered Sources

- [Morphe Community Patches](https://morphe-patches.software)
- [Jman's ReVanced Patch Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles)
- [Morphe Archive](https://github.com/rushiforai/morphe-archive)
- My custom sources defined in [`data/discover/custom.json`](data/discover/custom.json)

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

Downloads raw patch lists and bundle metadata from remote sources based on `data/discover/discover.json`.
It checks for new SHAs, downloads updated bundle files to `data/bundles/`, updates `data/repos.json` with the latest commit SHAs, and outputs the list of updated bundle targets to `scripts/bundle-parser/updated_files.txt`.

### `parse.py`

Executes the Kotlin-based `bundle-parser` (taken from [Jman's ReVanced Patch Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles) and modified to fit this project and Morphe) to parse updated bundle files listed in `scripts/bundle-parser/updated_files.txt` and extract structured patch lists into `data/patches/`.

### `update.py`

Compiles and syncs data from raw JSON files (`data/repos.json`, `data/bundles/`, and `data/patches/`) into the main database files (`docs/bundles.json` and `docs/apps.json`). Missing metadata is scraped from Google Play (with a fallback to official Morphe data) or fetched via GitHub/GitLab APIs. It automatically cleans up orphaned bundle and patch files from local storage if they no longer exist in `data/repos.json`.

Supported execution modes:
- **Default mode**: Compiles data from local JSON files, fetches GitHub/GitLab repository info (stars, avatar, and repository description) for new bundles, and retrieves any missing app metadata (name, icon, or description) from Google Play for newly discovered apps not yet available locally.
- `--daily`: Same as default, but also refreshes GitHub/GitLab repository info for all bundles and retrieves any missing app metadata from Google Play for all existing apps.
- `--month`: Same as `--daily`, but also forces a full re-scrape of all app metadata from Google Play for all existing applications, overwriting current values.

### `whats_new.py`

Generates `docs/whats-new.json` (rolling changelog for the website) and `whats-new.md` (used for GitHub release notes and Telegram notifications) by comparing current patch data against the previous release state in `data/history.json`.

### `telegram.py`

Sends release notifications to a Telegram channel (`TG_CHAT`) using the Telegram Bot API (`TG_TOKEN`). Supports the following usage:
- **Default**: Posts `whats-new.md` with an auto-generated title (`🔔 What's New (Month Day)`).
- With `"Custom Title"`: Posts `whats-new.md` with the specified title.
- With `"Custom Title" "path/to/file.md"`: Posts the specified markdown file with the specified title.
