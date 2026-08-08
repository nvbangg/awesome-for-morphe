import { Smartphone } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { WhatsNewAppChange } from "@/types/data";

interface WhatsNewAppCardProps {
  packageName: string;
  appData: WhatsNewAppChange;
  appName: string;
  icon: string | null;
  isAppNew: boolean;
  onAppClick: (packageName: string) => void;
  onPatchClick: (packageName: string, patchName: string) => void;
}

export function WhatsNewAppCard({
  packageName,
  appData,
  appName,
  icon,
  isAppNew,
  onAppClick,
  onPatchClick,
}: WhatsNewAppCardProps) {
  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-divider/60">
      <button
        type="button"
        onClick={() => onAppClick(packageName)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors text-left outline-none min-w-0"
        title="Open app details"
      >
        {icon ? (
          <img
            className="w-6 h-6 rounded-md object-cover shrink-0"
            src={icon}
            alt={appName}
            width={24}
            height={24}
            loading="lazy"
          />
        ) : (
          <div className="w-6 h-6 rounded-md shrink-0 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
            <Smartphone className="size-3.5 text-foreground-400" />
          </div>
        )}
        <span className="truncate">{appName}</span>
        {isAppNew && <Badge variant="new" />}
      </button>

      {appData.patches && appData.patches.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pl-0">
          {appData.patches.map((patchName: string, patchIndex: number) => (
            <button
              key={patchIndex}
              type="button"
              onClick={() => onPatchClick(packageName, patchName)}
              className="inline-flex items-center justify-center font-semibold rounded-full text-xs px-2.5 py-1 bg-zinc-200 hover:bg-zinc-300 text-foreground-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-300 transition-all cursor-pointer outline-none shrink-0 max-w-full truncate border border-divider/40 active:scale-95"
            >
              <span className="truncate">{patchName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
