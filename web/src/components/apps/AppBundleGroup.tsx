import { Avatar } from "@heroui/react";
import { Package, Calendar, Plus, ChevronDown } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { PatchItemRow } from "@/components/common/PatchItemRow";
import { isNew, formatDate } from "@/utils/formatters";
import { BundleGroupData } from "@/services/queryService";
import { RowItem } from "@/types/data";

interface AppBundleGroupProps {
  group: BundleGroupData;
  displayPackage: string | null;
  isExpanded: boolean;
  toggleBundleGroup: (bundleKey: string) => void;
  copiedText: string | null;
  copyToClipboard: (text: string, key?: string) => void;
}

export function AppBundleGroup({
  group,
  displayPackage,
  isExpanded,
  toggleBundleGroup,
  copiedText,
  copyToClipboard,
}: AppBundleGroupProps) {
  const patchBadge = (
    <Badge variant="count">
      {group.patches.length} {group.patches.length === 1 ? "patch" : "patches"}
    </Badge>
  );

  const dateBadge = group.bundleMeta.updatedAt > 0 && (
    <a
      href={group.bundleMeta.changelogUrl}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:underline transition-all text-xs font-semibold shrink-0"
      title="View Release Changelog"
    >
      <Calendar className="w-3 h-3" />
      {formatDate(group.bundleMeta.updatedAt)}
    </a>
  );

  return (
    <div className="border border-divider rounded-xl bg-background flex flex-col">
      <div
        onClick={() => toggleBundleGroup(group.bundleKey)}
        className={`sticky -top-4 z-20 flex flex-col gap-2 px-4 py-3 bg-background cursor-pointer hover:bg-default-100/60 transition-colors rounded-t-xl shadow-sm ${isExpanded ? "border-b border-divider/60" : ""}`}
      >
        <div className="flex items-center justify-between gap-3 w-full">
          <Avatar className="w-10 h-10 rounded-xl shrink-0 border border-border bg-divider/40">
            <Avatar.Image
              src={group.bundleMeta.avatarUrl}
              alt={group.bundleMeta.name}
            />
            <Avatar.Fallback className="bg-transparent flex items-center justify-center">
              <Package className="size-5 text-foreground-400" />
            </Avatar.Fallback>
          </Avatar>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="font-bold text-foreground text-sm truncate">
                {group.bundleMeta.name}
              </div>
              {displayPackage &&
                isNew(group.bundleMeta.appFirstSeen?.[displayPackage]) && (
                  <Badge variant="new" />
                )}
              {group.bundleMeta.isPreRelease && <Badge variant="prerelease" />}
              {group.bundleMeta.stars > 0 && (
                <Badge variant="stars" value={group.bundleMeta.stars} />
              )}
            </div>

            {group.bundleMeta.repoUrl && (
              <a
                href={group.bundleMeta.repoUrl}
                target="_blank"
                className="text-xs text-primary hover:underline font-medium dark:text-[#3fe9e8] inline-flex items-center gap-1.5 mt-0.5 w-fit max-w-full flex-wrap break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {group.bundleMeta.source === "gitlab" ? (
                  <svg
                    className="w-3 h-3 fill-current text-orange-500 shrink-0"
                    viewBox="0 0 24 24"
                  >
                    <path d="m23.905 11.966-.02-.054L20.25 1.156a.458.458 0 0 0-.435-.312.463.463 0 0 0-.44.32l-2.078 6.4h-10.6l-2.07-6.4a.46.46 0 0 0-.441-.32c-.198 0-.374.126-.435.312L.116 11.912a.916.916 0 0 0 .332 1.025l11.235 8.163.023.016.03.018a.555.555 0 0 0 .528 0l.03-.018.022-.016 11.258-8.163a.916.916 0 0 0 .331-1.027Z" />
                  </svg>
                ) : (
                  <svg
                    className="w-3 h-3 fill-current text-foreground shrink-0"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                )}
                <span className="break-all whitespace-normal">
                  {group.bundleMeta.repo}
                </span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {group.bundleMeta.deepLink ? (
              <div className="hidden sm:flex items-center gap-2">
                {patchBadge}
                {dateBadge}
              </div>
            ) : (
              <>
                {patchBadge}
                {dateBadge}
              </>
            )}
            {group.bundleMeta.deepLink && (
              <a
                href={group.bundleMeta.deepLink}
                target="_blank"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] whitespace-nowrap shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="w-3.5 h-3.5" /> Add to Morphe
              </a>
            )}
            <ChevronDown
              className={`w-4 h-4 text-foreground-500 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {group.bundleMeta.deepLink && (
          <div className="sm:hidden flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {patchBadge}
              {dateBadge}
            </div>
            <a
              href={group.bundleMeta.deepLink}
              target="_blank"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] shadow-sm shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="w-3.5 h-3.5" /> Add to Morphe
            </a>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-col">
          {group.patches.map((patchItem: RowItem) => (
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
