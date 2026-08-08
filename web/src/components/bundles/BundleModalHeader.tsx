import { Avatar } from "@heroui/react";
import { Package, Calendar, Plus } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { CloseButton, ModalHeader } from "@/components/common/CustomModal";
import { isNew } from "@/utils/formatters";

export interface BundleModalMeta {
  name: string;
  repo: string;
  repoUrl: string;
  avatarUrl: string;
  deepLink: string;
  rawKey: string;
  repoDescription: string;
  firstSeen: number;
  appFirstSeen: Record<string, number>;
  isPreRelease: boolean;
  stars: number;
  updatedAt: number;
  changelogUrl: string;
  source: string;
}

interface BundleModalHeaderProps {
  bundleMeta: BundleModalMeta;
  onClose: () => void;
  formattedDate: string;
}

export function BundleModalHeader({
  bundleMeta,
  onClose,
  formattedDate,
}: BundleModalHeaderProps) {
  return (
    <ModalHeader>
      <div className="flex flex-row items-start justify-between gap-4 w-full">
        <div className="flex flex-row items-center gap-4 flex-1 min-w-0">
          <Avatar className="w-14 h-14 rounded-2xl shrink-0 border border-border">
            <Avatar.Image src={bundleMeta.avatarUrl} alt={bundleMeta.name} />
            <Avatar.Fallback className="bg-divider/40 flex items-center justify-center">
              <Package className="size-8 text-foreground-400" />
            </Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                {bundleMeta.name}
              </h2>
              {isNew(bundleMeta.firstSeen) && <Badge variant="new" />}
              {bundleMeta.isPreRelease && <Badge variant="prerelease" />}
              {bundleMeta.stars > 0 && (
                <Badge variant="stars" value={bundleMeta.stars} />
              )}
            </div>
            <a
              href={bundleMeta.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline font-medium dark:text-[#3fe9e8] inline-flex items-center gap-1.5 mt-0.5 w-fit max-w-full flex-wrap break-all"
            >
              {bundleMeta.source === "gitlab" ? (
                <svg
                  className="w-3.5 h-3.5 fill-current text-orange-500 shrink-0"
                  viewBox="0 0 24 24"
                >
                  <path d="m23.905 11.966-.02-.054L20.25 1.156a.458.458 0 0 0-.435-.312.463.463 0 0 0-.44.32l-2.078 6.4h-10.6l-2.07-6.4a.46.46 0 0 0-.441-.32c-.198 0-.374.126-.435.312L.116 11.912a.916.916 0 0 0 .332 1.025l11.235 8.163.023.016.03.018a.555.555 0 0 0 .528 0l.03-.018.022-.016 11.258-8.163a.916.916 0 0 0 .331-1.027Z" />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5 fill-current text-foreground shrink-0"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              <span className="break-all whitespace-normal">
                {bundleMeta.repo}
              </span>
            </a>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {bundleMeta.updatedAt > 0 && (
            <a
              href={bundleMeta.changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:underline transition-all text-xs font-semibold shrink-0"
              title="View Release Changelog"
            >
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </a>
          )}
          {bundleMeta.deepLink && (
            <a
              href={bundleMeta.deepLink}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] shadow-sm select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="w-4 h-4" /> Add to Morphe
            </a>
          )}
          <CloseButton onClose={onClose} />
        </div>

        <div className="sm:hidden shrink-0">
          <CloseButton onClose={onClose} />
        </div>
      </div>

      {bundleMeta.repoDescription && (
        <p className="text-sm text-foreground-600 dark:text-foreground-500 leading-relaxed wrap-break-word">
          {bundleMeta.repoDescription}
        </p>
      )}

      <div className="flex sm:hidden items-center justify-between gap-3 mt-1 w-full">
        {bundleMeta.updatedAt > 0 && (
          <a
            href={bundleMeta.changelogUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:underline transition-all text-xs font-semibold shrink-0"
            title="View Release Changelog"
          >
            <Calendar className="w-3.5 h-3.5" />
            {formattedDate}
          </a>
        )}
        {bundleMeta.deepLink && (
          <a
            href={bundleMeta.deepLink}
            target="_blank"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] shadow-sm select-none shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-4 h-4" /> Add to Morphe
          </a>
        )}
      </div>
    </ModalHeader>
  );
}
