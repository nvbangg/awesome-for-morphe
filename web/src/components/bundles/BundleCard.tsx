import { Bundle } from "@/types/data";
import { Plus, Package, Calendar } from "lucide-react";
import { memo, useState } from "react";
import { isNew, formatDate } from "@/utils/formatters";
import { Badge } from "@/components/common/Badge";
import { GitLabIcon } from "@/components/common/icons/GitLabIcon";
import { GitHubIcon } from "@/components/common/icons/GitHubIcon";

interface BundleCardProps {
  bundleItem: Bundle;
  onClick: (bundleKey: string) => void;
}

export const BundleCard = memo(function BundleCard({
  bundleItem,
  onClick,
}: BundleCardProps) {
  const [imgError, setImgError] = useState(false);
  const { repoUrl, deepLink } = bundleItem;
  const isGitLab = bundleItem.source === "gitlab";
  const formattedDate = formatDate(bundleItem.updatedAt);

  return (
    <div
      className="cursor-pointer p-5 md:p-4 flex flex-col gap-4 md:gap-3 bg-card border border-border rounded-2xl transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 h-full"
      onClick={() => onClick(bundleItem.key)}
    >
      <div className="flex items-center gap-3.5">
        {bundleItem.avatarUrl && !imgError ? (
          <img
            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-border bg-zinc-100 dark:bg-zinc-800"
            src={bundleItem.avatarUrl}
            alt={bundleItem.name}
            width={56}
            height={56}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl shrink-0 border border-border bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Package className="w-8 h-8 text-foreground-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-base font-bold text-foreground mb-0.5 whitespace-normal break-all flex flex-wrap items-center gap-1.5">
            {bundleItem.name}
            {isNew(bundleItem.firstSeen) && <Badge variant="new" />}
            {bundleItem.isPreRelease && <Badge variant="prerelease" />}
            {bundleItem.stars > 0 && (
              <Badge variant="stars" value={bundleItem.stars} />
            )}
          </div>
          <div className="flex items-start gap-1.5 text-xs text-foreground-500 font-medium min-w-0">
            {isGitLab ? (
              <GitLabIcon className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
            ) : (
              <GitHubIcon className="w-3.5 h-3.5 text-foreground shrink-0 mt-0.5" />
            )}
            <a
              className="break-all whitespace-normal text-primary hover:underline font-medium dark:text-[#3fe9e8] w-fit max-w-full"
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {bundleItem.repo}
            </a>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <p className="text-sm text-foreground-600 dark:text-foreground-500 leading-relaxed line-clamp-2">
          {bundleItem.repoDescription}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto w-full">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {bundleItem.updatedAt > 0 && (
            <a
              href={bundleItem.changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:underline transition-all text-xs font-semibold shrink-0"
              title="View Release Changelog"
            >
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </a>
          )}
        </div>
        <a
          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] whitespace-nowrap shrink-0 ml-auto select-none"
          href={deepLink}
          target="_blank"
          onClick={(event) => event.stopPropagation()}
        >
          <Plus className="w-4 h-4" />
          Add to Morphe
        </a>
      </div>
    </div>
  );
});
