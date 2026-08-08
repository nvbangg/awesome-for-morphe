import { useMemo, useState } from "react";
import { ActiveData, RowItem } from "@/types/data";
import { getAppMeta, simplifyString } from "@/utils";
import { SearchInput } from "@/components/common/SearchInput";
import { useCopy } from "@/hooks/useCopy";
import { CustomModal, ModalBody } from "@/components/common/CustomModal";
import { PACKAGE_UNIVERSAL } from "@/constants";
import { TestBundleData } from "@/utils/testBundleFetcher";
import { TestBundleViewModalHeader } from "./TestBundleViewModalHeader";
import { TestBundleAppGroup, TestAppGroupData } from "./TestBundleAppGroup";
import { Badge } from "@/components/common/Badge";

interface TestBundleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TestBundleData | null;
  activeData: ActiveData | null;
}

export function TestBundleViewModal({
  isOpen,
  onClose,
  data,
  activeData,
}: TestBundleViewModalProps) {
  const { copiedText, copyToClipboard } = useCopy();
  const [searchQuery, setSearchQuery] = useState("");

  const branches = ["main", "dev"];

  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData) {
    setPrevData(data);
    if (data && data.availableBranches.length > 0) {
      if (data.availableBranches.includes("main")) {
        setCurrentBranch("main");
      } else {
        setCurrentBranch(data.availableBranches[0]);
      }
    }
  }

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  }

  const currentRows: RowItem[] = useMemo(() => {
    if (!data || !currentBranch || !data.branches[currentBranch]) return [];
    return data.branches[currentBranch];
  }, [data, currentBranch]);

  const deepLink = useMemo(() => {
    if (!data) return "";
    const repo = data.repoName;
    const platform = data.platform || "github";
    const branchPart =
      currentBranch === "dev"
        ? platform === "gitlab"
          ? `${repo}/-/tree/dev`
          : `${repo}/tree/dev`
        : repo;
    return `https://morphe.software/add-source?${platform}=${branchPart}`;
  }, [data, currentBranch]);

  const appGroups = useMemo(() => {
    if (!currentRows || !activeData) return [];

    const queryWords = searchQuery
      .trim()
      .split(/\s+/)
      .map(simplifyString)
      .filter(Boolean);
    const filteredRows =
      queryWords.length > 0
        ? currentRows.filter((patchItem) => {
            const appMeta = getAppMeta(
              patchItem.packageName,
              activeData.namesMap,
            );
            const appNameClean = simplifyString(appMeta.appName);
            const packageNameClean = simplifyString(patchItem.packageName);
            return queryWords.every(
              (word) =>
                patchItem.searchPatchesText.includes(word) ||
                packageNameClean.includes(word) ||
                appNameClean.includes(word),
            );
          })
        : currentRows;

    const map = new Map<string, RowItem[]>();
    for (const row of filteredRows) {
      const packageName = row.packageName || PACKAGE_UNIVERSAL;
      const list = map.get(packageName) || [];
      list.push(row);
      map.set(packageName, list);
    }

    const groups: TestAppGroupData[] = Array.from(map.entries()).map(
      ([packageName, patches]) => {
        const appMeta = getAppMeta(packageName, activeData.namesMap);
        return { packageName, appMeta, patches };
      },
    );

    groups.sort((groupA, groupB) => {
      if (
        (groupA.packageName === PACKAGE_UNIVERSAL) !==
        (groupB.packageName === PACKAGE_UNIVERSAL)
      ) {
        return groupA.packageName === PACKAGE_UNIVERSAL ? 1 : -1;
      }
      return groupA.appMeta.appName.localeCompare(
        groupB.appMeta.appName,
        undefined,
        { sensitivity: "base" },
      );
    });

    return groups;
  }, [currentRows, searchQuery, activeData]);

  const [expandedAppKeys, setExpandedAppKeys] = useState<Set<string>>(
    new Set(),
  );
  const [syncState, setSyncState] = useState({
    isOpen,
    searchQuery,
    appGroups,
  });

  if (
    isOpen !== syncState.isOpen ||
    searchQuery !== syncState.searchQuery ||
    appGroups !== syncState.appGroups
  ) {
    setSyncState({ isOpen, searchQuery, appGroups });
    if (isOpen) {
      if (appGroups.length === 1 || searchQuery.trim().length > 0) {
        setExpandedAppKeys(
          new Set(appGroups.map((appGroup) => appGroup.packageName)),
        );
      } else {
        setExpandedAppKeys(new Set());
      }
    }
  }

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
      <TestBundleViewModalHeader
        repoUrl={data.repoUrl}
        branches={branches}
        availableBranches={data.availableBranches}
        currentBranch={currentBranch}
        setCurrentBranch={setCurrentBranch}
        deepLink={deepLink}
        onClose={onClose}
      />

      <ModalBody>
        <div className="flex items-center gap-3">
          <SearchInput
            id="test-patch-search"
            placeholder="Search patches…"
            value={searchQuery}
            onChange={setSearchQuery}
            className="flex-1"
          />
          <Badge variant="count" className="px-3 py-1 whitespace-nowrap">
            {appGroups.length} {appGroups.length === 1 ? "app" : "apps"}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 pr-1 mt-2">
          {appGroups.length === 0 ? (
            <div className="py-12 text-center text-foreground-400 text-sm font-medium">
              {data.availableBranches.includes(currentBranch)
                ? "No apps found"
                : `No patches-list.json found on '${currentBranch}' branch`}
            </div>
          ) : (
            appGroups.map((group) => {
              const isExpanded = expandedAppKeys.has(group.packageName);
              return (
                <TestBundleAppGroup
                  key={group.packageName}
                  group={group}
                  isExpanded={isExpanded}
                  toggleAppGroup={toggleAppGroup}
                  copiedText={copiedText}
                  copyToClipboard={copyToClipboard}
                />
              );
            })
          )}
        </div>
      </ModalBody>
    </CustomModal>
  );
}
