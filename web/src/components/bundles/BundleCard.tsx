import { Bundle } from "@/types/data";
import { memo } from "react";
import { isNew, formatDate } from "@/utils/formatters";
import { Badge } from "@/components/common/Badge";
import { AddToMorpheButton } from "@/components/common/ActionButtons";
import { RepoLink } from "@/components/common/RepoLink";
import { BundleAvatar } from "@/components/common/ItemAvatar";
import { Card } from "@heroui/react";

interface BundleCardProps {
  bundleItem: Bundle;
  onClick: (bundleKey: string) => void;
}

export const BundleCard = memo(function BundleCard({
  bundleItem,
  onClick,
}: BundleCardProps) {
  const { repoUrl, deepLink } = bundleItem;
  const formattedDate = formatDate(bundleItem.updatedAt);

  return (
    <Card
      className="cursor-pointer p-5 md:p-4 flex flex-col gap-4 md:gap-3 border border-divider rounded-2xl transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 h-full bg-card"
      onClick={() => onClick(bundleItem.key)}
    >
      <div className="flex items-center gap-3.5">
        <BundleAvatar
          src={bundleItem.avatarUrl}
          alt={bundleItem.name}
          size="lg"
        />

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-base font-bold text-foreground mb-0.5 whitespace-normal break-all flex flex-wrap items-center gap-1.5">
            {bundleItem.name}
            {isNew(bundleItem.firstSeen) && <Badge variant="new" />}
            {bundleItem.isPreRelease && <Badge variant="prerelease" />}
            {bundleItem.stars > 0 && (
              <Badge variant="stars" value={bundleItem.stars} />
            )}
          </div>
          <RepoLink
            repo={bundleItem.repo}
            repoUrl={repoUrl}
            source={bundleItem.source}
          />
        </div>
      </div>

      <div className="flex-1">
        <p className="text-sm text-foreground-muted leading-relaxed line-clamp-2">
          {bundleItem.repoDescription}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto w-full">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {bundleItem.updatedAt > 0 && (
            <Badge variant="updated" href={bundleItem.changelogUrl}>
              {formattedDate}
            </Badge>
          )}
        </div>
        <AddToMorpheButton deepLink={deepLink} className="ml-auto" />
      </div>
    </Card>
  );
});
