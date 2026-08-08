import { Avatar } from "@heroui/react";
import { Smartphone, Check, Copy, ChevronDown, Play } from "lucide-react";
import { PatchItemRow } from "@/components/common/PatchItemRow";
import { Badge } from "@/components/common/Badge";
import { PACKAGE_UNIVERSAL } from "@/constants";
import { RowItem } from "@/types/data";

export interface TestAppGroupData {
  packageName: string;
  appMeta: {
    appName: string;
    appIcon: string;
    description: string;
    minInstalls: number;
    category: string;
    firstSeen: number;
  };
  patches: RowItem[];
}

interface TestBundleAppGroupProps {
  group: TestAppGroupData;
  isExpanded: boolean;
  toggleAppGroup: (pkgName: string) => void;
  copiedText: string | null;
  copyToClipboard: (text: string, key?: string) => void;
}

export function TestBundleAppGroup({
  group,
  isExpanded,
  toggleAppGroup,
  copiedText,
  copyToClipboard,
}: TestBundleAppGroupProps) {
  const isUniversal = group.packageName === PACKAGE_UNIVERSAL;
  const isNotOnPlayStore = !group.appMeta.minInstalls;
  const showGooglePlay = !isUniversal && !isNotOnPlayStore;

  return (
    <div className="border border-divider rounded-xl bg-background flex flex-col">
      <div
        onClick={() => toggleAppGroup(group.packageName)}
        className={`sticky -top-4 z-20 flex flex-col gap-2 px-4 py-3 bg-background cursor-pointer hover:bg-default-100/60 transition-colors rounded-t-xl shadow-sm ${isExpanded ? "border-b border-divider/60" : ""}`}
      >
        <div className="flex items-center gap-4 w-full">
          <Avatar className="w-10 h-10 rounded-xl shrink-0 border border-border bg-divider/40">
            {group.appMeta.appIcon ? (
              <Avatar.Image
                src={group.appMeta.appIcon}
                alt={group.appMeta.appName}
              />
            ) : null}
            <Avatar.Fallback className="bg-transparent flex items-center justify-center">
              <Smartphone className="size-5 text-foreground-400" />
            </Avatar.Fallback>
          </Avatar>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="font-bold text-foreground text-sm truncate">
                {group.appMeta.appName}
              </div>
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
                {copiedText === group.packageName ? (
                  <Check className="size-3 text-success shrink-0" />
                ) : (
                  <Copy className="size-3 shrink-0 text-foreground-500 hover:text-primary" />
                )}
                <span className="truncate text-primary font-medium dark:text-[#3fe9e8]">
                  {group.packageName}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="count"
              className={
                showGooglePlay ? "hidden sm:inline-flex" : "inline-flex"
              }
            >
              {group.patches.length}{" "}
              {group.patches.length === 1 ? "patch" : "patches"}
            </Badge>
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
            <ChevronDown
              className={`w-4 h-4 text-foreground-500 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {showGooglePlay && (
          <div className="sm:hidden flex items-center justify-between gap-2 pt-1">
            <Badge variant="count">
              {group.patches.length}{" "}
              {group.patches.length === 1 ? "patch" : "patches"}
            </Badge>
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
            <PatchItemRow
              key={patchItem.id}
              patchItem={patchItem}
              copiedText={copiedText}
              copyToClipboard={copyToClipboard}
            />
          ))}
        </div>
      )}
    </div>
  );
}
