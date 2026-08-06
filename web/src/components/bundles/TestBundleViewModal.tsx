import { useMemo, useState, useEffect } from "react";
import { ActiveData, getAppMeta, RowItem, simplifyString } from "@/data";
import { SearchInput } from "@/components/common/SearchInput";
import { useCopy } from "@/hooks/useCopy";
import { Avatar } from "@heroui/react";
import { Smartphone, ChevronDown, Plus, Play, Check, Copy } from "lucide-react";
import { PatchItemRow } from "@/components/common/PatchItemRow";
import { CustomModal, ModalHeader, ModalBody, CloseButton } from "@/components/common/CustomModal";
import { TestBundleData } from "@/utils/testBundleFetcher";

interface TestBundleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TestBundleData | null;
  activeData: ActiveData | null;
}

export function TestBundleViewModal({ isOpen, onClose, data, activeData }: TestBundleViewModalProps) {
  const { copiedText, copyToClipboard } = useCopy();
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAppKeys, setExpandedAppKeys] = useState<Set<string>>(new Set());

  const branches = ["main", "dev"];

  useEffect(() => {
    if (data && data.availableBranches.length > 0) {
      if (data.availableBranches.includes("main")) {
        setCurrentBranch("main");
      } else {
        setCurrentBranch(data.availableBranches[0]);
      }
    }
  }, [data]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const currentRows: RowItem[] = useMemo(() => {
    if (!data || !currentBranch || !data.branches[currentBranch]) return [];
    return data.branches[currentBranch];
  }, [data, currentBranch]);

  const deepLink = useMemo(() => {
    if (!data) return "";
    const repo = data.repoName;
    const platform = data.platform || "github";
    const branchPart = currentBranch === "dev" ? (platform === "gitlab" ? `${repo}/-/tree/dev` : `${repo}/tree/dev`) : repo;
    return `https://morphe.software/add-source?${platform}=${branchPart}`;
  }, [data, currentBranch]);

  const appGroups = useMemo(() => {
    if (!currentRows || !activeData) return [];

    const queryWords = searchQuery.trim().split(/\s+/).map(simplifyString).filter(Boolean);
    const filteredRows =
      queryWords.length > 0
        ? currentRows.filter((patchItem) => {
            const appMeta = getAppMeta(patchItem.packageName, activeData.namesMap);
            const appNameClean = simplifyString(appMeta.appName);
            const packageNameClean = simplifyString(patchItem.packageName);
            return queryWords.every((word) => patchItem.searchPatchesText.includes(word) || packageNameClean.includes(word) || appNameClean.includes(word));
          })
        : currentRows;

    const map = new Map<string, RowItem[]>();
    for (const row of filteredRows) {
      const packageName = row.packageName || "universal";
      const list = map.get(packageName) || [];
      list.push(row);
      map.set(packageName, list);
    }

    const groups = Array.from(map.entries()).map(([packageName, patches]) => {
      const appMeta = getAppMeta(packageName, activeData.namesMap);
      return { packageName, appMeta, patches };
    });

    groups.sort((groupA, groupB) => {
      if ((groupA.packageName === "universal") !== (groupB.packageName === "universal")) {
        return groupA.packageName === "universal" ? 1 : -1;
      }
      return groupA.appMeta.appName.localeCompare(groupB.appMeta.appName, undefined, { sensitivity: "base" });
    });

    return groups;
  }, [currentRows, searchQuery, activeData]);

  useEffect(() => {
    if (!isOpen) return;
    if (appGroups.length === 1 || searchQuery.trim().length > 0) {
      setExpandedAppKeys(new Set(appGroups.map((appGroup) => appGroup.packageName)));
    } else {
      setExpandedAppKeys(new Set());
    }
  }, [appGroups, searchQuery, isOpen]);

  const toggleAppGroup = (pkgName: string) => {
    setExpandedAppKeys((prev) => {
      const next = new Set(prev);
      if (next.has(pkgName)) {
        next.delete(pkgName);
      } else {
        next.add(pkgName);
      }
      return next;
    });
  };

  if (!data) return null;

  return (
    <CustomModal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center justify-between gap-4 w-full">
            <a href={data.repoUrl} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-primary hover:underline dark:text-[#3fe9e8] break-all whitespace-normal">
              {data.repoUrl}
            </a>
            <CloseButton onClose={onClose} />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-background-100 dark:bg-background-800 p-1 rounded-xl border border-divider">
              {branches.map((branch) => {
                const isAvailable = data.availableBranches.includes(branch);
                return (
                  <button
                    key={branch}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => isAvailable && setCurrentBranch(branch)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      currentBranch === branch
                        ? "bg-primary text-white shadow-xs"
                        : isAvailable
                          ? "text-foreground-600 hover:text-foreground hover:bg-background-200 dark:hover:bg-background-700 cursor-pointer"
                          : "text-foreground-300 dark:text-foreground-600 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {branch}
                  </button>
                );
              })}
            </div>

            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] shadow-sm select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="w-4 h-4" /> Add to Morphe
              </a>
            )}
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="flex items-center gap-3">
          <SearchInput id="test-patch-search" placeholder="Search patches…" value={searchQuery} onChange={setSearchQuery} className="flex-1" />
          <span className="inline-flex items-center justify-center font-semibold rounded-full text-xs px-3 py-1 bg-zinc-200 text-foreground-700 dark:text-zinc-300 dark:bg-zinc-700 shrink-0 whitespace-nowrap">
            {appGroups.length} {appGroups.length === 1 ? "app" : "apps"}
          </span>
        </div>

        <div className="flex flex-col gap-3 pr-1 mt-2">
          {appGroups.length === 0 ? (
            <div className="py-12 text-center text-foreground-400 text-sm font-medium">
              {data.availableBranches.includes(currentBranch) ? "No apps found" : `No patches-list.json found on '${currentBranch}' branch`}
            </div>
          ) : (
            appGroups.map((group) => {
              const isUniversal = group.packageName === "universal";
              const isNotOnPlayStore = group.packageName === "not-on-google-play";
              const showGooglePlay = !isUniversal && !isNotOnPlayStore;
              const isExpanded = expandedAppKeys.has(group.packageName);

              return (
                <div key={group.packageName} className="border border-divider rounded-xl bg-background flex flex-col">
                  <div
                    onClick={() => toggleAppGroup(group.packageName)}
                    className={`sticky -top-4 z-20 flex flex-col gap-2 px-4 py-3 bg-background cursor-pointer hover:bg-default-100/60 transition-colors rounded-t-xl shadow-sm ${isExpanded ? "border-b border-divider/60" : ""}`}
                  >
                    <div className="flex items-center gap-4 w-full">
                      <Avatar className="w-10 h-10 rounded-xl shrink-0 border border-border bg-zinc-100 dark:bg-zinc-800">
                        {group.appMeta.appIcon ? <Avatar.Image src={group.appMeta.appIcon} alt={group.appMeta.appName} /> : null}
                        <Avatar.Fallback className="bg-transparent flex items-center justify-center">
                          <Smartphone className="size-5 text-foreground-400" />
                        </Avatar.Fallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <div className="font-bold text-foreground text-sm truncate">{group.appMeta.appName}</div>
                        </div>
                        {!isUniversal && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(group.packageName);
                            }}
                            className="flex items-center gap-1.5 mt-0.5 text-xs text-primary cursor-pointer w-fit"
                            title="Copy Package Name"
                          >
                            {copiedText === group.packageName ? <Check className="size-3 text-success shrink-0" /> : <Copy className="size-3 shrink-0 text-foreground-500 hover:text-primary" />}
                            <span className="truncate text-primary font-medium dark:text-[#3fe9e8]">{group.packageName}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`${showGooglePlay ? "hidden sm:inline-flex" : "inline-flex"} items-center justify-center font-semibold rounded-full text-xs px-2.5 py-0.5 bg-zinc-200 text-foreground-700 dark:text-zinc-300 dark:bg-zinc-700 shrink-0`}
                        >
                          {group.patches.length} {group.patches.length === 1 ? "patch" : "patches"}
                        </span>
                        {showGooglePlay && (
                          <a
                            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] shadow-sm shrink-0"
                            href={`https://play.google.com/store/apps/details?id=${group.packageName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open on Google Play"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Google Play
                          </a>
                        )}
                        <ChevronDown className={`w-4 h-4 text-foreground-500 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    {showGooglePlay && (
                      <div className="sm:hidden flex items-center justify-between gap-2 pt-1">
                        <span className="inline-flex items-center justify-center font-semibold rounded-full text-xs px-2.5 py-0.5 bg-zinc-200 text-foreground-700 dark:text-zinc-300 dark:bg-zinc-700 shrink-0">
                          {group.patches.length} {group.patches.length === 1 ? "patch" : "patches"}
                        </span>
                        <a
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] shadow-sm shrink-0"
                          href={`https://play.google.com/store/apps/details?id=${group.packageName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open on Google Play"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Google Play
                        </a>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col">
                      {group.patches.map((patchItem) => (
                        <PatchItemRow key={patchItem.id} patchItem={patchItem} copiedText={copiedText} copyToClipboard={copyToClipboard} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ModalBody>
    </CustomModal>
  );
}
