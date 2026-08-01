import { PatchOption, RowItem, VersionItem } from "../data";

export interface TestBundleData {
  repoName: string;
  platform: "github" | "gitlab";
  repoUrl: string;
  branches: Record<string, RowItem[]>;
  availableBranches: string[];
}

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";
const GITLAB_RAW_BASE = "https://gitlab.com";

const FILES_TO_TRY = ["patches-list.json"];
const BRANCHES_TO_TRY = ["main", "dev"];

function parseRepoInput(input: string): { owner: string; repo: string; platform: "github" | "gitlab" } | null {
  try {
    const cleanInput = input.trim();
    if (!cleanInput.startsWith("http")) return null;

    const url = new URL(cleanInput);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length >= 2) {
      return {
        owner: parts[0],
        repo: parts[1].replace(/\.git$/, ""),
        platform: url.hostname.includes("gitlab") ? "gitlab" : "github",
      };
    }
  } catch {
    // Ignore error
  }
  return null;
}

function getRawUrls(platform: "github" | "gitlab", owner: string, repo: string, branch: string): string[] {
  const urls: string[] = [];
  for (const file of FILES_TO_TRY) {
    if (platform === "gitlab") {
      const encodedProject = encodeURIComponent(`${owner}/${repo}`);
      const encodedFile = encodeURIComponent(file);
      urls.push(`https://gitlab.com/api/v4/projects/${encodedProject}/repository/files/${encodedFile}/raw?ref=${branch}`);
      urls.push(`${GITLAB_RAW_BASE}/${owner}/${repo}/-/raw/${branch}/${file}`);
    } else {
      urls.push(`${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${file}`);
    }
  }
  return urls;
}

async function fetchFromUrls(urls: string[]): Promise<any | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json) || (json && Array.isArray(json.patches))) {
            return json;
          }
        } catch {
          // not json
        }
      }
    } catch {
      // fetch error, try next
    }
  }
  return null;
}

function parsePatchesToRows(data: any, bundleKey: string): RowItem[] {
  let patchesList = Array.isArray(data) ? data : [];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (data.patches && Array.isArray(data.patches)) {
      patchesList = data.patches;
    }
  }

  const rows: RowItem[] = [];

  for (const patch of patchesList) {
    if (!patch || typeof patch !== "object" || !patch.name) continue;

    const patchName = patch.name;
    const patchDescription = patch.description || "";
    const isPatchPreRelease = !!patch.isPreRelease;
    const options: PatchOption[] = patch.options || [];
    const isDefault = patch.default !== false;

    let compatiblePackages: any[] = [];
    if (Array.isArray(patch.compatiblePackages)) {
      compatiblePackages = patch.compatiblePackages;
    } else if (patch.compatiblePackages && typeof patch.compatiblePackages === "object") {
      compatiblePackages = Object.entries(patch.compatiblePackages).map(([pkg, targets]) => ({
        packageName: pkg,
        targets: Array.isArray(targets) ? targets : [],
      }));
    }

    if (compatiblePackages.length === 0) {
      rows.push({
        id: `${bundleKey}-no-pkg-${patchName}`,
        bundleKey,
        patchName,
        patchDescription,
        packageName: "universal",
        isAppPreRelease: false,
        isPatchPreRelease,
        versions: [],
        searchPatchesText: `${patchName} ${patchDescription}`.toLowerCase(),
        options,
        default: isDefault,
      });
      continue;
    }

    for (const pkg of compatiblePackages) {
      if (!pkg || typeof pkg !== "object" || !pkg.packageName) continue;

      const packageName = pkg.packageName;
      const isAppPreRelease = !!pkg.isPreRelease;
      const versions: VersionItem[] = [];

      if (Array.isArray(pkg.targets)) {
        for (const target of pkg.targets) {
          if (typeof target === "string") {
            versions.push({ version: target, isExperimental: false });
          } else if (target && typeof target === "object" && target.version) {
            versions.push({
              version: target.version,
              isExperimental: !!target.isExperimental,
            });
          }
        }
      }

      rows.push({
        id: `${bundleKey}-${packageName}-${patchName}`,
        bundleKey,
        patchName,
        patchDescription,
        packageName,
        isAppPreRelease,
        isPatchPreRelease,
        versions,
        searchPatchesText: `${patchName} ${patchDescription}`.toLowerCase(),
        options,
        default: isDefault,
      });
    }
  }

  return rows;
}

export async function fetchTestBundle(input: string): Promise<TestBundleData> {
  const repoInfo = parseRepoInput(input);
  if (!repoInfo) {
    throw new Error("Invalid repository link format.");
  }

  const { owner, repo, platform } = repoInfo;
  const repoName = `${owner}/${repo}`;
  const branchesData: Record<string, RowItem[]> = {};
  const availableBranches: string[] = [];

  let fetchSuccess = false;

  for (const branch of BRANCHES_TO_TRY) {
    const urls = getRawUrls(platform, owner, repo, branch);
    const data = await fetchFromUrls(urls);
    if (data) {
      fetchSuccess = true;
      const rows = parsePatchesToRows(data, `test-${repoName}-${branch}`);
      if (rows.length > 0) {
        branchesData[branch] = rows;
        availableBranches.push(branch);
      }
    }
  }

  if (!fetchSuccess) {
    throw new Error("Could not find patches-list.json file in the repository.");
  }

  if (availableBranches.length === 0) {
    throw new Error("Found patches-list.json, but no valid patches could be parsed.");
  }

  return {
    repoName,
    platform,
    repoUrl: platform === "github" ? `https://github.com/${repoName}` : `https://gitlab.com/${repoName}`,
    branches: branchesData,
    availableBranches,
  };
}
