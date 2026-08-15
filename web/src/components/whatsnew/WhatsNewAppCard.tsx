import { memo } from "react";
import { Badge } from "@/components/common/Badge";
import { PatchButton } from "@/components/common/ActionButtons";
import { AppAvatar } from "@/components/common/ItemAvatar";
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

export const WhatsNewAppCard = memo(function WhatsNewAppCard({
  packageName,
  appData,
  appName,
  icon,
  isAppNew,
  onAppClick,
  onPatchClick,
}: WhatsNewAppCardProps) {
  return (
    <div
      onClick={() => onAppClick(packageName)}
      className="flex flex-col gap-2 p-2.5 rounded-xl bg-card border border-divider transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors min-w-0">
        <AppAvatar src={icon} alt={appName} size="sm" />
        <span className="truncate">{appName}</span>
        {isAppNew && <Badge variant="new" />}
      </div>

      {appData.patches && appData.patches.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pl-0">
          {appData.patches.map((patchName: string, patchIndex: number) => (
            <PatchButton
              key={patchIndex}
              patchName={patchName}
              onClick={() => onPatchClick(packageName, patchName)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
