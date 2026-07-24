### [nvbangg/awesome-morphe](https://github.com/nvbangg/awesome-morphe)

> [!NOTE]
> This document contains contribution guidelines, project structure details, and automation workflows for the [Awesome Morphe Website](https://awesome-morphe.vercel.app/).

## 📬 Contributing

- To add, remove, or customize a bundle source, please submit a [Bundle Request](https://github.com/nvbangg/awesome-morphe/issues/new?template=bundle-request.yml).
- For any other issues, suggestions, or questions, feel free to [open a new issue](https://github.com/nvbangg/awesome-morphe/issues/new).

## 📂 Project Structure & Data

```text
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── bundle-request.yml           # Issue template to add, remove, or customize a bundle source
│   └── workflows/
│       ├── ci.yml                       # Sync workflow (every 2 hours)
│       └── release.yml                  # Daily release workflow (23:00 UTC)
├── data/
│   ├── bundles/                         # Raw patch bundles downloaded from upstream
│   ├── patches/                         # Raw patch lists downloaded from upstream
│   ├── discover/                        # Discovered sources data
│   │   ├── custom.json                  # Custom entries to add, remove, or customize bundles
│   │   ├── discover.json                # Compiled list of all discovered bundles
│   │   ├── jman.json                    # Bundles discovered from Jman
│   │   ├── morphe-archive.json          # Bundles discovered from Morphe Archive
│   │   ├── official.json                # Bundles discovered from the Official Website
│   │   └── snapshot.json                # Snapshots of the discovered state
│   ├── history.json                     # Baseline sync state for tracking patch updates
│   ├── official-bundles.json            # Cached official bundle details
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
│   │   ├── official_sync.py             # Syncs official bundle details
│   │   └── repo_info.py                 # Fetches repository info
│   ├── discover.py                      # Scans providers and merges discoveries into data/discover/discover.json
│   ├── fetch.py                         # Fetches raw patch lists and bundles based on discovered repos
│   ├── update.py                        # Processes raw databases into optimized web formats
│   ├── telegram.py                      # Sends Telegram notifications
│   └── whats_new.py                     # Diffs updates and compiles rolling release logs
│   ├── utils.py                         # Shared utility functions
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
   - Compile optimized web assets: `python scripts/update.py`
   - Commit and push changes directly to the `main` branch.

### 2. Release Workflow (`release.yml` - Daily at 23:00 UTC)

Runs daily maintenance, builds release notes, and notifies subscribers:

1. Discover patch repositories: `python scripts/discover.py`
2. Fetch upstream updates: `python scripts/fetch.py`
3. Compile data: `python scripts/update.py --month` (on the 1st of the month) or `python scripts/update.py --daily` (other days).
4. Generate release changelog: `python scripts/whats_new.py`
5. Commit and push updates, then create a new GitHub Release.
6. Send notification to Telegram channel: `python scripts/telegram.py`

## 🛠️ Usage / Scripts

All core automation logic is written in Python inside the `scripts/` directory.

### `discover.py`

Scans community patch repositories and merges them into `data/discover/discover.json`.

- `python scripts/discover.py`

#### Discovered Sources

- [Morphe Community Patches](https://morphe-patches.software)
- [Jman's ReVanced Patch Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles)
- [Morphe Archive](https://github.com/rushiforai/morphe-archive)
- My custom sources defined in [`data/discover/custom.json`](data/discover/custom.json)

#### Customization

Customize target repositories in [`data/discover/custom.json`](data/discover/custom.json) to add, remove, or customize bundles. Supported fields include `name`, `enabled`, `bundleUrl:<branch>`, and `patchesUrl:<branch>`:

```json
{
  "github:owner/repo": {
    "name": "Custom Name"
  },
  "gitlab:owner/repo-to-exclude": {
    "enabled": false
  }
}
```

### `fetch.py`

Downloads raw patch lists and bundle metadata from remote sources based on `data/discover/discover.json`.
It checks for new SHAs and downloads updated files to `data/bundles/` and `data/patches/`, updating `data/repos.json` with the latest commit SHAs.

- `python scripts/fetch.py`

### `update.py`

Parses raw JSON files and compiles optimized web assets inside `docs/` for UI rendering. Data is extracted from `data/bundles/` and `data/patches/`. Missing data is retrieved from `data/official-bundles.json`, scraped from Google Play, or fetched via GitHub/GitLab APIs.

- `python scripts/update.py`: Compiles database index files with default mode.
- Optional flags:
  - `--daily`: Runs daily update (fetches GitHub/GitLab stars, avatars, and missing Google Play apps).
  - `--month`: Runs monthly update (forces Google Play scrape for all apps, along with daily tasks).

### `whats_new.py`

Generates the "What's New" changelog by diffing current patch data against the baseline.

- `python scripts/whats_new.py`

### `telegram.py`

Sends release updates from `whats-new.md` to a Telegram channel.

- `python scripts/telegram.py` (accepts optional `"Title"` and `"file.md"` arguments)
