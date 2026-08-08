import { useMemo, useState } from "react";
import { ActiveData } from "@/types/data";
import { getAppMeta } from "@/utils/domainUtils";

import { getAppBundleGroups } from "@/services";
import { SearchInput } from "@/components/common/SearchInput";
import { CustomModal, ModalBody } from "@/components/common/CustomModal";
import { AppModalHeader } from "./AppModalHeader";
import { AppBundleGroup } from "./AppBundleGroup";
import { Badge } from "@/components/common/Badge";
import { useCopy } from "@/hooks/useCopy";

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageName: string | null;
  activeData: ActiveData | null;
  searchQuery: string;
  onSearchChange: (searchValue: string) => void;
}

export function AppModal({
  isOpen,
  onClose,
  packageName,
  activeData,
  searchQuery,
  onSearchChange,
}: AppModalProps) {
  const { copiedText, copyToClipboard } = useCopy();

  const [activePackage, setActivePackage] = useState<string | null>(null);
  const [prevPackageName, setPrevPackageName] = useState<string | null>(null);

  if (packageName !== prevPackageName) {
    setPrevPackageName(packageName);
    if (packageName) setActivePackage(packageName);
  }

  const displayPackage = packageName || activePackage;

  const applicationMeta = useMemo(() => {
    if (!displayPackage || !activeData) return null;
    return getAppMeta(displayPackage, activeData.namesMap);
  }, [displayPackage, activeData]);

  const bundleGroups = useMemo(() => {
    if (!displayPackage || !activeData) return [];
    return getAppBundleGroups(activeData, displayPackage, searchQuery);
  }, [displayPackage, activeData, searchQuery]);

  const [expandedBundleKeys, setExpandedBundleKeys] = useState<Set<string>>(
    new Set(),
  );
  const [syncState, setSyncState] = useState({
    isOpen,
    searchQuery,
    bundleGroups,
  });

  if (
    isOpen !== syncState.isOpen ||
    searchQuery !== syncState.searchQuery ||
    bundleGroups !== syncState.bundleGroups
  ) {
    setSyncState({ isOpen, searchQuery, bundleGroups });
    if (isOpen) {
      if (bundleGroups.length === 1 || searchQuery.trim().length > 0) {
        setExpandedBundleKeys(new Set(bundleGroups.map((g) => g.bundleKey)));
      } else {
        setExpandedBundleKeys(new Set());
      }
    }
  }

  const toggleBundleGroup = (bundleKey: string) => {
    setExpandedBundleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(bundleKey)) {
        next.delete(bundleKey);
      } else {
        next.add(bundleKey);
      }
      return next;
    });
  };

  if (!applicationMeta) return null;

  return (
    <CustomModal isOpen={isOpen} onClose={onClose}>
      <AppModalHeader
        applicationMeta={applicationMeta}
        packageName={packageName}
        copiedText={copiedText}
        copyToClipboard={copyToClipboard}
        onClose={onClose}
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
            {bundleGroups.length}{" "}
            {bundleGroups.length === 1 ? "bundle" : "bundles"}
          </Badge>
        </div>

        <div className="flex flex-col gap-4 pr-1">
          {bundleGroups.length === 0 ? (
            <div className="py-12 text-center text-foreground-400 text-sm font-medium">
              No patches found
            </div>
          ) : (
            bundleGroups.map((group) => {
              const isExpanded = expandedBundleKeys.has(group.bundleKey);
              return (
                <AppBundleGroup
                  key={group.bundleKey}
                  group={group}
                  displayPackage={displayPackage}
                  isExpanded={isExpanded}
                  toggleBundleGroup={toggleBundleGroup}
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
