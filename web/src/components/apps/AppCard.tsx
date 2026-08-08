import { AppItem } from "@/types/data";
import { Smartphone, Copy, Check, Play } from "lucide-react";
import { useCopy } from "@/hooks/useCopy";
import { memo, useState } from "react";
import { isNew } from "@/utils/formatters";
import { Badge } from "@/components/common/Badge";
import {
  PACKAGE_UNIVERSAL,
  CATEGORY_UNIVERSAL,
  CATEGORY_LABEL_UNIVERSAL,
} from "@/constants";

interface AppCardProps {
  appItem: AppItem;
  onClick: (packageName: string) => void;
}

export const AppCard = memo(function AppCard({
  appItem,
  onClick,
}: AppCardProps) {
  const [imgError, setImgError] = useState(false);
  const { copiedText, copyToClipboard } = useCopy();

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    copyToClipboard(appItem.packageName);
  };

  const showGooglePlay =
    appItem.packageName !== PACKAGE_UNIVERSAL &&
    appItem.categorySlug !== CATEGORY_UNIVERSAL;

  return (
    <div
      className="cursor-pointer p-5 md:p-4 flex flex-col gap-4 md:gap-3 bg-card border border-border rounded-2xl transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 h-full"
      onClick={() => onClick(appItem.packageName)}
    >
      <div className="flex items-center gap-3.5">
        {appItem.appIcon && !imgError ? (
          <img
            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-border bg-divider/40"
            src={appItem.appIcon}
            alt={appItem.appName}
            width={56}
            height={56}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl shrink-0 border border-border bg-divider/40 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-foreground-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-base font-bold text-foreground mb-0.5 whitespace-normal break-all flex flex-wrap items-center gap-1.5">
            {appItem.appName}
            {isNew(appItem.firstSeen) && <Badge variant="new" />}
            {appItem.minInstalls > 0 &&
              appItem.packageName !== PACKAGE_UNIVERSAL &&
              appItem.categorySlug !== CATEGORY_UNIVERSAL && (
                <Badge variant="downloads" value={appItem.minInstalls} />
              )}
          </div>
          {appItem.packageName !== PACKAGE_UNIVERSAL && (
            <div
              onClick={handleCopy}
              className="flex items-start gap-1.5 text-xs cursor-pointer w-fit text-foreground-500 hover:text-primary transition-colors"
              title="Copy Package Name"
            >
              {copiedText === appItem.packageName ? (
                <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0 mt-0.5 text-foreground-500 hover:text-primary" />
              )}
              <span className="break-all whitespace-normal text-primary font-medium dark:text-[#3fe9e8]">
                {appItem.packageName}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1">
        <p className="text-sm text-foreground-600 dark:text-foreground-500 leading-relaxed line-clamp-2">
          {appItem.description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto w-full">
        <Badge
          variant="category"
          className="whitespace-nowrap truncate max-w-[60%]"
          title="Category"
        >
          {appItem.categorySlug === CATEGORY_UNIVERSAL
            ? CATEGORY_LABEL_UNIVERSAL
            : appItem.category}
        </Badge>

        {showGooglePlay && (
          <a
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-(image:--primary-gradient) text-white text-xs font-semibold no-underline border-none cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] whitespace-nowrap shrink-0 ml-auto select-none"
            href={`https://play.google.com/store/apps/details?id=${appItem.packageName}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open on Google Play"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Google Play
          </a>
        )}
      </div>
    </div>
  );
});
