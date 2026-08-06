import { Bundle } from "@/data";
import { Plus, Package, Calendar } from "lucide-react";
import { memo, useState } from "react";
import { isNew } from "@/utils/formatters";
import { Badge } from "@/components/common/Badge";

interface BundleCardProps {
  bundleItem: Bundle;
  onClick: (bundleKey: string) => void;
}

export const BundleCard = memo(function BundleCard({ bundleItem, onClick }: BundleCardProps) {
  const [imgError, setImgError] = useState(false);
  const { repoUrl, deepLink } = bundleItem;
  const isGitLab = bundleItem.source === "gitlab";
  const formattedDate = bundleItem.updatedAt
    ? new Date(bundleItem.updatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

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
            {bundleItem.stars > 0 && <Badge variant="stars" value={bundleItem.stars} />}
          </div>
          <div className="flex items-start gap-1.5 text-xs text-foreground-500 font-medium min-w-0">
            {isGitLab ? (
              <svg className="w-3.5 h-3.5 fill-current text-orange-500 shrink-0 mt-0.5" viewBox="0 0 24 24">
                <path d="m23.905 11.966-.02-.054L20.25 1.156a.458.458 0 0 0-.435-.312.463.463 0 0 0-.44.32l-2.078 6.4h-10.6l-2.07-6.4a.46.46 0 0 0-.441-.32c-.198 0-.374.126-.435.312L.116 11.912a.916.916 0 0 0 .332 1.025l11.235 8.163.023.016.03.018a.555.555 0 0 0 .528 0l.03-.018.022-.016 11.258-8.163a.916.916 0 0 0 .331-1.027Z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 fill-current text-foreground shrink-0 mt-0.5" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
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
        <p className="text-sm text-foreground-600 dark:text-foreground-500 leading-relaxed line-clamp-2">{bundleItem.repoDescription}</p>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto w-full">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {bundleItem.updatedAt > 0 && (
            <a
              href={bundleItem.changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-divider hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-primary dark:hover:text-[#3fe9e8] transition-colors text-xs font-semibold text-foreground-600 dark:text-zinc-300 no-underline shrink-0"
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
