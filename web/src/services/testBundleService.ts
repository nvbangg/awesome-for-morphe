import { RowItem, VersionItem, PatchOption } from "@/types/data";
import { PACKAGE_UNIVERSAL } from "@/constants";

export interface TestBundleData {
  repoName: string;
  platform: "github" | "gitlab";
  repoUrl: string;
  branches: Record<string, RowItem[]>;
  availableBranches: string[];
}

const BRANCHES_TO_TRY = ["main", "dev"];

function parseRepoInput(
  input: string,
): { owner: string; repo: string; platform: "github" | "gitlab" } | null {
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

function getRawUrls(
  platform: "github" | "gitlab",
  owner: string,
  repo: string,
  branch: string,
): string[] {
  const file = "patches-list.json";
  if (platform === "gitlab") {
    const encodedProject = encodeURIComponent(`${owner}/${repo}`);
    const encodedFile = encodeURIComponent(file);
    return [
      `https://gitlab.com/api/v4/projects/${encodedProject}/repository/files/${encodedFile}/raw?ref=${branch}`,
      `https://gitlab.com/${owner}/${repo}/-/raw/${branch}/${file}`,
    ];
  }
  return [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`,
  ];
}

async function fetchFromUrls(urls: string[]): Promise<unknown | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const text = await response.text();
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

function parsePatchesToRows(data: unknown, bundleKey: string): RowItem[] {
  const dataObject = data as Record<string, unknown>;
  const patchesList = Array.isArray(data)
    ? data
    : Array.isArray(dataObject?.patches)
      ? dataObject.patches
      : [];

  const rows: RowItem[] = [];

  for (const patch of patchesList) {
    if (!patch || typeof patch !== "object" || !patch.name) continue;

    const patchName = patch.name;
    const patchDescription = patch.description || "";
    const isPatchPreRelease = !!patch.isPreRelease;
    const options: PatchOption[] = patch.options || [];
    const isDefault = patch.default !== false;

    const compatiblePackages: Array<{
      packageName: string;
      targets?: unknown[];
      isPreRelease?: boolean;
    }> = Array.isArray(patch.compatiblePackages)
      ? patch.compatiblePackages
      : patch.compatiblePackages && typeof patch.compatiblePackages === "object"
        ? Object.entries(patch.compatiblePackages).map(
            ([packageNameString, targets]) => ({
              packageName: packageNameString,
              targets: Array.isArray(targets) ? targets : [],
            }),
          )
        : [];

    if (compatiblePackages.length === 0) {
      rows.push({
        id: `${bundleKey}-no-pkg-${patchName}`,
        bundleKey,
        patchName,
        patchDescription,
        packageName: PACKAGE_UNIVERSAL,
        isPatchPreRelease,
        versions: [],
        searchPatchesText: `${patchName} ${patchDescription}`.toLowerCase(),
        options,
        default: isDefault,
      });
      continue;
    }

    for (const packageItem of compatiblePackages) {
      if (
        !packageItem ||
        typeof packageItem !== "object" ||
        !packageItem.packageName
      )
        continue;

      const packageName = packageItem.packageName;
      const versions: VersionItem[] = [];

      if (Array.isArray(packageItem.targets)) {
        for (const target of packageItem.targets) {
          if (typeof target === "string") {
            versions.push({ version: target, isExperimental: false });
          } else if (
            target &&
            typeof target === "object" &&
            "version" in target
          ) {
            const targetObject = target as {
              version: unknown;
              isExperimental?: unknown;
            };
            if (typeof targetObject.version === "string") {
              versions.push({
                version: targetObject.version,
                isExperimental: !!targetObject.isExperimental,
              });
            }
          }
        }
      }

      rows.push({
        id: `${bundleKey}-${packageName}-${patchName}`,
        bundleKey,
        patchName,
        patchDescription,
        packageName,
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
    throw new Error(
      "Found patches-list.json, but no valid patches could be parsed.",
    );
  }

  return {
    repoName,
    platform,
    repoUrl:
      platform === "github"
        ? `https://github.com/${repoName}`
        : `https://gitlab.com/${repoName}`,
    branches: branchesData,
    availableBranches,
  };
}
