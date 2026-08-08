import { Avatar } from "@heroui/react";
import { Smartphone, Check, Copy, Play } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { CloseButton, ModalHeader } from "@/components/common/CustomModal";
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
          <Avatar className="w-14 h-14 rounded-2xl shrink-0 border border-border">
            {applicationMeta.appIcon ? (
              <Avatar.Image
                src={applicationMeta.appIcon}
                alt={applicationMeta.appName}
              />
            ) : (
              <Avatar.Fallback className="bg-divider/40 flex items-center justify-center">
                <Smartphone className="size-8 text-foreground-400" />
              </Avatar.Fallback>
            )}
          </Avatar>
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                {applicationMeta.appName}
              </h2>
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
            {packageName !== PACKAGE_UNIVERSAL && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(packageName || "");
                }}
                className="flex items-center gap-1.5 mt-0.5 text-xs text-primary cursor-pointer w-fit"
                title="Copy Package Name"
              >
                {copiedText === packageName ? (
                  <Check className="size-3 text-success shrink-0" />
                ) : (
                  <Copy className="size-3 shrink-0 text-foreground-500 hover:text-primary" />
                )}
                <span className="truncate text-primary font-medium dark:text-[#3fe9e8]">
                  {packageName}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {applicationMeta.category && (
            <Badge
              variant="category"
              className="hidden sm:inline-flex"
              title="Category"
            >
              {applicationMeta.categorySlug === CATEGORY_UNIVERSAL
                ? CATEGORY_LABEL_UNIVERSAL
                : applicationMeta.category}
            </Badge>
          )}
          {showGooglePlay && (
            <a
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] shadow-sm select-none"
              href={`https://play.google.com/store/apps/details?id=${packageName}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on Google Play"
            >
              <Play className="w-4 h-4 fill-current" />
              Google Play
            </a>
          )}
          <CloseButton onClose={onClose} />
        </div>

        <div className="sm:hidden shrink-0">
          <CloseButton onClose={onClose} />
        </div>
      </div>

      {applicationMeta.description && (
        <p className="text-sm text-foreground-600 dark:text-foreground-500 leading-relaxed wrap-break-word">
          {applicationMeta.description}
        </p>
      )}

      <div className="flex sm:hidden items-center justify-between gap-3 mt-1 w-full">
        {applicationMeta.category && (
          <Badge variant="category" title="Category">
            {applicationMeta.categorySlug === CATEGORY_UNIVERSAL
              ? CATEGORY_LABEL_UNIVERSAL
              : applicationMeta.category}
          </Badge>
        )}
        {showGooglePlay && (
          <a
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-(image:--primary-gradient) text-white text-sm font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] shadow-sm select-none shrink-0"
            href={`https://play.google.com/store/apps/details?id=${packageName}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on Google Play"
          >
            <Play className="w-4 h-4 fill-current" />
            Google Play
          </a>
        )}
      </div>
    </ModalHeader>
  );
}
