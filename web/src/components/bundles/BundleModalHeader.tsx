import { Badge } from "@/components/common/Badge";
import { AddToMorpheButton } from "@/components/common/ActionButtons";
import { RepoLink } from "@/components/common/RepoLink";
import { BundleAvatar } from "@/components/common/ItemAvatar";
import { ModalHeader, CloseButton } from "@/components/common/CustomModal";
import { isNew } from "@/utils/formatters";

export interface BundleModalMeta {
  source: string;
  repo: string;
  name: string;
  repoDescription: string;
  avatarUrl: string;
  stars: number;
  updatedAt: number;
  firstSeen: number;
  appFirstSeen: Record<string, number>;
  isPreRelease: boolean;
  hotRank: number | null;

  key: string;
  repoUrl: string;
  deepLink: string;
  changelogUrl: string;
  appCount: number;
  patchCount: number;
  isUnofficial: boolean;
}

interface BundleModalHeaderProps {
  bundleMeta: BundleModalMeta;
  formattedDate: string;
  onClose: () => void;
}

export function BundleModalHeader({
  bundleMeta,
  formattedDate,
  onClose,
}: BundleModalHeaderProps) {
  return (
    <ModalHeader>
      <div className="flex flex-row items-start justify-between gap-4 w-full">
        <div className="flex flex-row items-center gap-4 flex-1 min-w-0">
          <BundleAvatar
            src={bundleMeta.avatarUrl}
            alt={bundleMeta.name}
            size="lg"
          />
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                {bundleMeta.name}
              </h2>
              {isNew(bundleMeta.firstSeen) && <Badge variant="new" />}
              {bundleMeta.isPreRelease && <Badge variant="prerelease" />}
              {bundleMeta.isUnofficial && <Badge variant="unofficial" />}
              {bundleMeta.stars > 0 && (
                <Badge variant="stars" value={bundleMeta.stars} />
              )}
            </div>
            <RepoLink
              repo={bundleMeta.repo}
              repoUrl={bundleMeta.repoUrl}
              source={bundleMeta.source}
              className="text-sm"
            />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {bundleMeta.updatedAt > 0 && (
            <Badge variant="updated" href={bundleMeta.changelogUrl}>
              {formattedDate}
            </Badge>
          )}
          {bundleMeta.deepLink && (
            <AddToMorpheButton deepLink={bundleMeta.deepLink} />
          )}
          <CloseButton onClose={onClose} />
        </div>

        <div className="sm:hidden shrink-0">
          <CloseButton onClose={onClose} />
        </div>
      </div>

      {bundleMeta.repoDescription && (
        <p className="text-sm text-foreground-muted leading-relaxed wrap-break-word">
          {bundleMeta.repoDescription}
        </p>
      )}

      <div className="flex sm:hidden items-center justify-between gap-3 mt-1 w-full">
        {bundleMeta.updatedAt > 0 && (
          <Badge variant="updated" href={bundleMeta.changelogUrl}>
            {formattedDate}
          </Badge>
        )}
        {bundleMeta.deepLink && (
          <AddToMorpheButton
            deepLink={bundleMeta.deepLink}
            className="shrink-0"
          />
        )}
      </div>
    </ModalHeader>
  );
}
