import { AppItem } from "@/data";
import { Smartphone, Copy, Check, Play } from "lucide-react";
import { useCopy } from "@/hooks/useCopy";
import { memo } from "react";
import { Badge } from "@/components/common/Badge";

interface AppCardProps {
  appItem: AppItem;
  onClick: (packageName: string) => void;
}

export const AppCard = memo(function AppCard({ appItem, onClick }: AppCardProps) {
  const { copiedText, copyToClipboard } = useCopy();

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    copyToClipboard(appItem.packageName);
  };

  const showGooglePlay = appItem.packageName !== "universal" && appItem.categorySlug !== "not-on-google-play";

  return (
    <div
      className="cursor-pointer p-5 md:p-4 flex flex-col gap-4 md:gap-3 bg-card border border-border rounded-2xl transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 h-full"
      onClick={() => onClick(appItem.packageName)}
    >
      <div className="flex items-center gap-3.5">
        {appItem.appIcon ? (
          <img
            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-border bg-zinc-100 dark:bg-zinc-800"
            src={appItem.appIcon}
            alt={appItem.appName}
            width={56}
            height={56}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
              const nextSibling = (e.target as HTMLElement).nextElementSibling;
              if (nextSibling) {
                nextSibling.classList.remove("hidden");
                nextSibling.classList.add("flex");
              }
            }}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl shrink-0 border border-border bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-foreground-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-base font-bold text-foreground mb-0.5 whitespace-normal break-all flex flex-wrap items-center gap-1.5">
            {appItem.appName}
            {appItem.minInstalls > 0 && appItem.packageName !== "universal" && appItem.categorySlug !== "not-on-google-play" && <Badge variant="downloads" value={appItem.minInstalls} />}
          </div>
          {appItem.packageName !== "universal" && (
            <div onClick={handleCopy} className="flex items-start gap-1.5 text-xs cursor-pointer w-fit text-foreground-500 hover:text-primary transition-colors" title="Copy Package Name">
              {copiedText === appItem.packageName ? (
                <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0 mt-0.5 text-foreground-500 hover:text-primary" />
              )}
              <span className="break-all whitespace-normal text-primary font-medium dark:text-[#3fe9e8]">{appItem.packageName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1">
        <p className="text-sm text-foreground-600 dark:text-foreground-500 leading-relaxed line-clamp-2">{appItem.description}</p>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto w-full">
        <span
          className="font-semibold rounded-full text-xs px-2 py-1 bg-zinc-200 text-foreground-700 dark:text-zinc-300 dark:bg-zinc-700 whitespace-nowrap truncate shrink-0 max-w-[60%]"
          title="Genre"
        >
          {appItem.categorySlug === "not-on-google-play" ? "Not on Google Play" : appItem.genre}
        </span>

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
