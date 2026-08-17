import { Badge } from "@/components/common/Badge";
import { GooglePlayButton } from "@/components/common/ActionButtons";
import { PackageNameCopy } from "@/components/common/PackageNameCopy";
import { AppAvatar } from "@/components/common/ItemAvatar";
import { ModalHeader, CloseButton } from "@/components/common/CustomModal";
import { isNew } from "@/utils/formatters";
import {
  PACKAGE_UNIVERSAL,
  CATEGORY_LABEL_UNIVERSAL,
  CATEGORY_UNIVERSAL,
} from "@/constants";

interface AppModalHeaderProps {
  applicationMeta: {
    appName: string;
    appIcon: string;
    description: string;
    minInstalls: number;
    category: string;
    categorySlug: string;
    firstSeen: number;
    isPreRelease: boolean;
  };
  packageName: string | null;
  copiedText: string | null;
  copyToClipboard: (text: string) => void;
  onClose: () => void;
}

export function AppModalHeader({
  applicationMeta,
  packageName,
  copiedText,
  copyToClipboard,
  onClose,
}: AppModalHeaderProps) {
  const showGooglePlay =
    packageName !== PACKAGE_UNIVERSAL &&
    applicationMeta.category !== CATEGORY_LABEL_UNIVERSAL;

  return (
    <ModalHeader>
      <div className="flex flex-row items-start justify-between gap-4 w-full">
        <div className="flex flex-row items-center gap-4 flex-1 min-w-0">
          <AppAvatar
            src={applicationMeta.appIcon}
            alt={applicationMeta.appName}
            size="lg"
          />
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                {applicationMeta.appName}
              </h2>
              {isNew(applicationMeta.firstSeen) && <Badge variant="new" />}
              {applicationMeta.isPreRelease && <Badge variant="prerelease" />}
              {applicationMeta.minInstalls !== undefined &&
                applicationMeta.minInstalls > 0 &&
                packageName !== PACKAGE_UNIVERSAL &&
                applicationMeta.category !== CATEGORY_LABEL_UNIVERSAL && (
                  <Badge
                    variant="downloads"
                    value={applicationMeta.minInstalls}
                  />
                )}
            </div>
            <PackageNameCopy
              packageName={packageName || undefined}
              copiedText={copiedText}
              copyToClipboard={copyToClipboard}
            />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {applicationMeta.category && (
            <Badge variant="category">
              {applicationMeta.categorySlug === CATEGORY_UNIVERSAL
                ? CATEGORY_LABEL_UNIVERSAL
                : applicationMeta.category}
            </Badge>
          )}
          {showGooglePlay && packageName && (
            <GooglePlayButton packageName={packageName} />
          )}
          <CloseButton onClose={onClose} />
        </div>

        <div className="sm:hidden shrink-0">
          <CloseButton onClose={onClose} />
        </div>
      </div>

      {applicationMeta.description && (
        <p className="text-sm text-foreground-muted leading-relaxed wrap-break-word">
          {applicationMeta.description}
        </p>
      )}

      <div className="flex sm:hidden items-center justify-between gap-3 mt-1 w-full">
        {applicationMeta.category && (
          <Badge variant="category">
            {applicationMeta.categorySlug === CATEGORY_UNIVERSAL
              ? CATEGORY_LABEL_UNIVERSAL
              : applicationMeta.category}
          </Badge>
        )}
        {showGooglePlay && packageName && (
          <GooglePlayButton packageName={packageName} className="shrink-0" />
        )}
      </div>
    </ModalHeader>
  );
}
