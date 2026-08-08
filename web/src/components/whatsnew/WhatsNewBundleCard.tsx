import { Package } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { WhatsNewBundleChange, ActiveData } from "@/types/data";
import { isNew } from "@/utils/formatters";
import { getAppMeta } from "@/utils";
import { WhatsNewAppCard } from "./WhatsNewAppCard";

interface WhatsNewBundleCardProps {
  bundleKey: string;
  bundleData: WhatsNewBundleChange;
  activeData: ActiveData | null;
  onBundleClick: (bundleKey: string) => void;
  onAppClick: (packageName: string) => void;
  onPatchClick: (packageName: string, patchName: string) => void;
}

export function WhatsNewBundleCard({
  bundleKey,
  bundleData,
  activeData,
  onBundleClick,
  onAppClick,
  onPatchClick,
}: WhatsNewBundleCardProps) {
  const fullBundleKey = `${bundleData.source}:${bundleData.repo}`;
  const bundleMeta = activeData?.bundleMap[fullBundleKey.toLowerCase()];
  const isBundleNew = !!bundleData.isNew || isNew(bundleMeta?.firstSeen);

  return (
    <div className="border border-divider bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => onBundleClick(fullBundleKey)}
        className="w-full flex items-center justify-between gap-3 p-3 bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20 border-b border-primary/10 dark:border-primary/20 text-left outline-none transition-colors group cursor-pointer"
        title="Open bundle details"
      >
        <div className="flex items-center gap-2 text-base font-semibold text-foreground group-hover:text-primary transition-colors min-w-0">
          <Package className="size-4 text-primary shrink-0" />
          <span className="truncate">{bundleMeta?.name || bundleKey}</span>
          {isBundleNew && <Badge variant="new" />}
        </div>
      </button>

      {bundleData.apps && Object.keys(bundleData.apps).length > 0 && (
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(bundleData.apps).map(([packageName, appData]) => {
            const meta = activeData
              ? getAppMeta(packageName, activeData.namesMap)
              : null;
            const icon = meta?.appIcon || null;
            const appName = appData.appName || meta?.appName || packageName;
            const isAppNew =
              !isBundleNew && (!!appData.isNew || isNew(meta?.firstSeen));

            return (
              <WhatsNewAppCard
                key={packageName}
                packageName={packageName}
                appData={appData}
                appName={appName}
                icon={icon}
                isAppNew={isAppNew}
                onAppClick={onAppClick}
                onPatchClick={onPatchClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
