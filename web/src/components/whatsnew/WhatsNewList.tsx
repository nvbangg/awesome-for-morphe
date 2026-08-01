import { ActiveData, WhatsNewHistoryItem, WhatsNewBundleChange, WhatsNewAppChange, getAppMeta } from "@/data";
import { Spinner, Avatar } from "@heroui/react";
import { Sparkles, Package, Smartphone, Calendar } from "lucide-react";
import { isNew } from "@/utils/formatters";
import { Badge } from "@/components/common/Badge";

interface WhatsNewListProps {
  history: WhatsNewHistoryItem[];
  isLoading: boolean;
  activeData: ActiveData | null;
  onBundleClick: (bundleKey: string) => void;
  onAppClick: (packageName: string) => void;
  onPatchClick: (packageName: string, patchName: string) => void;
}

export function WhatsNewList({ history, isLoading, activeData, onBundleClick, onAppClick, onPatchClick }: WhatsNewListProps) {
  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
        <Spinner size="lg" color="warning" />
        <p className="text-sm font-medium text-foreground-500">Loading What's New data...</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center text-foreground-400 gap-2">
        <Sparkles className="size-8" />
        <p className="text-sm font-medium">No changes recorded.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {history.map((dayItem, dayIndex) => (
        <div key={dayIndex} className="flex flex-col gap-3">
          <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-xs py-3 flex items-center gap-2 text-xs font-bold text-primary dark:text-[#3fe9e8] uppercase tracking-wider border-b border-divider/40 mb-2">
            <Calendar className="size-3.5" />
            <span>{dayItem.date}</span>
          </div>

          <div className="flex flex-col gap-3">
            {Object.entries(dayItem.bundles || {}).map(([bundleKey, bundleData]: [string, WhatsNewBundleChange]) => {
              const fullBundleKey = `${bundleData.source}:${bundleData.repo}`;
              const isMorningEntree = bundleKey.toLowerCase().includes("morning") || fullBundleKey.toLowerCase().includes("morning");

              if (isMorningEntree) return null;

              const bundleMeta = activeData?.bundleMap[fullBundleKey.toLowerCase()];
              const isBundleNew = !!bundleData.isNew || isNew(bundleMeta?.firstSeen);

              return (
                <div key={bundleKey} className="border border-divider bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="flex items-center justify-between gap-3 p-3 bg-zinc-100/80 dark:bg-zinc-800/50 border-b border-divider">
                    <button
                      type="button"
                      onClick={() => onBundleClick(fullBundleKey)}
                      className="flex items-center gap-2 text-base font-semibold text-foreground hover:text-primary transition-colors text-left outline-none min-w-0"
                    >
                      <Package className="size-4 text-primary shrink-0" />
                      <span className="truncate">{bundleMeta?.name || bundleKey}</span>
                      {isBundleNew && <Badge variant="new" />}
                    </button>
                  </div>

                  {bundleData.apps && Object.keys(bundleData.apps).length > 0 && (
                    <div className="p-3 flex flex-col gap-3">
                      {Object.entries(bundleData.apps).map(([packageName, appData]: [string, WhatsNewAppChange]) => {
                        const meta = activeData ? getAppMeta(packageName, activeData.namesMap) : null;
                        const icon = meta?.appIcon || null;
                        const appName = appData.appName || meta?.appName || packageName;
                        const isAppNew = !isBundleNew && (!!appData.isNew || isNew(meta?.firstSeen));

                        return (
                          <div key={packageName} className="flex flex-col gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-divider/60">
                            <button
                              type="button"
                              onClick={() => onAppClick(packageName)}
                              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors text-left outline-none min-w-0"
                            >
                              <Avatar className="w-6 h-6 rounded-md shrink-0">
                                {icon ? <Avatar.Image src={icon} alt={appName} /> : null}
                                <Avatar.Fallback className="bg-default-100 flex items-center justify-center">
                                  <Smartphone className="size-3.5 text-foreground-400" />
                                </Avatar.Fallback>
                              </Avatar>
                              <span className="truncate">{appName}</span>
                              {isAppNew && <Badge variant="new" />}
                            </button>

                            {appData.patches && appData.patches.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pl-0">
                                {appData.patches.map((patchName: string, patchIndex: number) => (
                                  <button
                                    key={patchIndex}
                                    type="button"
                                    onClick={() => onPatchClick(packageName, patchName)}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-foreground-700 dark:text-zinc-300 transition-colors text-xs font-semibold cursor-pointer outline-none shrink-0 border-none"
                                  >
                                    {patchName}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
