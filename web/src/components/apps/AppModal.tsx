import { useMemo } from "react";
import { ActiveData } from "@/types/data";
import { getAppMeta } from "@/utils/domainUtils";
import { isNew } from "@/utils/formatters";
import { getAppBundleGroups } from "@/services";
import { ModalSearchBar } from "@/components/common/ModalSearchBar";
import { CustomModal, ModalBody } from "@/components/common/CustomModal";
import { AppModalHeader } from "./AppModalHeader";
import { AppBundleGroup } from "./AppBundleGroup";
import { useCopy } from "@/hooks/useCopy";
import { useExpandedKeys } from "@/hooks/useExpandedKeys";

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

  const applicationMeta = useMemo(() => {
    if (!packageName || !activeData) return null;
    return getAppMeta(packageName, activeData.namesMap);
  }, [packageName, activeData]);

  const bundleGroups = useMemo(() => {
    if (!packageName || !activeData) return [];
    return getAppBundleGroups(activeData, packageName, searchQuery);
  }, [packageName, activeData, searchQuery]);

  const bundleKeys = useMemo(
    () => bundleGroups.map((group) => group.bundleKey),
    [bundleGroups],
  );

  const { expandedKeys, toggleKey: toggleBundleGroup } = useExpandedKeys(
    isOpen,
    bundleKeys,
    searchQuery,
  );

  const totalBundlesCount = useMemo(() => {
    if (!packageName || !activeData) return 0;
    const rawPatches = activeData.appPatchesMap[packageName] || [];
    return new Set(
      rawPatches.map((patchItem) => patchItem.bundleKey.toLowerCase()),
    ).size;
  }, [packageName, activeData]);

  if (!applicationMeta || !packageName) return null;

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
        <ModalSearchBar
          value={searchQuery}
          onChange={onSearchChange}
          count={totalBundlesCount}
          label="bundle"
        />

        <div className="flex flex-col gap-3 pr-1">
          {bundleGroups.length === 0 ? (
            <div className="py-12 text-center text-foreground-subtle text-sm font-medium">
              No patches found
            </div>
          ) : (
            bundleGroups.map((group) => {
              const isExpanded = expandedKeys.has(group.bundleKey);
              return (
                <AppBundleGroup
                  key={group.bundleKey}
                  group={group}
                  displayPackage={packageName}
                  isExpanded={isExpanded}
                  toggleBundleGroup={toggleBundleGroup}
                  copiedText={copiedText}
                  copyToClipboard={copyToClipboard}
                  isAppNew={isNew(applicationMeta.firstSeen)}
                  isAppPreRelease={applicationMeta.isPreRelease}
                />
              );
            })
          )}
        </div>
      </ModalBody>
    </CustomModal>
  );
}
