import { useMemo, useState } from "react";
import { ActiveData } from "@/types/data";
import { getBundleAppGroups } from "@/services";
import { SearchInput } from "@/components/common/SearchInput";
import { useCopy } from "@/hooks/useCopy";
import { CustomModal, ModalBody } from "@/components/common/CustomModal";
import { BundleModalHeader } from "./BundleModalHeader";
import { BundleAppGroup } from "./BundleAppGroup";
import { Badge } from "@/components/common/Badge";

interface BundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundleKey: string | null;
  activeData: ActiveData | null;
  searchQuery: string;
  onSearchChange: (searchValue: string) => void;
}

export function BundleModal({
  isOpen,
  onClose,
  bundleKey,
  activeData,
  searchQuery,
  onSearchChange,
}: BundleModalProps) {
  const { copiedText, copyToClipboard } = useCopy();

  const [activeBundle, setActiveBundle] = useState<string | null>(null);
  const [prevBundleKey, setPrevBundleKey] = useState<string | null>(null);

  if (bundleKey !== prevBundleKey) {
    setPrevBundleKey(bundleKey);
    if (bundleKey) setActiveBundle(bundleKey);
  }

  const displayBundle = bundleKey || activeBundle;

  const bundleMeta = useMemo(() => {
    if (!displayBundle || !activeData) return null;

    const lowerKey = displayBundle.toLowerCase();
    const bundle = activeData.bundleMap[lowerKey];
    if (!bundle) return null;

    return {
      name: bundle.name || bundle.repo,
      repo: bundle.repo,
      repoUrl: bundle.repoUrl,
      avatarUrl: bundle.avatarUrl,
      deepLink: bundle.deepLink,
      rawKey: bundle.key,
      repoDescription: bundle.repoDescription,
      firstSeen: bundle.firstSeen,
      appFirstSeen: bundle.appFirstSeen,
      isPreRelease: bundle.isPreRelease,
      stars: bundle.stars,
      updatedAt: bundle.updatedAt,
      changelogUrl: bundle.changelogUrl,
      source: bundle.source,
    };
  }, [displayBundle, activeData]);

  const formattedDate = bundleMeta?.updatedAt
    ? new Date(bundleMeta.updatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const appGroups = useMemo(() => {
    if (!displayBundle || !activeData) return [];
    return getBundleAppGroups(activeData, displayBundle, searchQuery);
  }, [displayBundle, activeData, searchQuery]);

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
        setExpandedAppKeys(new Set(appGroups.map((g) => g.packageName)));
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

  if (!bundleMeta) return null;

  return (
    <CustomModal isOpen={isOpen} onClose={onClose}>
      <BundleModalHeader
        bundleMeta={bundleMeta}
        onClose={onClose}
        formattedDate={formattedDate}
      />

      <ModalBody>
        <div className="flex items-center gap-3">
          <SearchInput
            id="patch-search"
            placeholder="Search patches…"
            value={searchQuery}
            onChange={onSearchChange}
            className="flex-1"
          />
          <Badge variant="count" className="px-3 py-1 whitespace-nowrap">
            {appGroups.length} {appGroups.length === 1 ? "app" : "apps"}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 pr-1">
          {appGroups.length === 0 ? (
            <div className="py-12 text-center text-foreground-400 text-sm font-medium">
              No apps found
            </div>
          ) : (
            appGroups.map((group) => {
              const isExpanded = expandedAppKeys.has(group.packageName);
              return (
                <BundleAppGroup
                  key={group.packageName}
                  group={group}
                  bundleMeta={bundleMeta}
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
