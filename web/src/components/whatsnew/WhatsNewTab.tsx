import { WhatsNewHeader } from "./WhatsNewHeader";
import { WhatsNewList } from "./WhatsNewList";
import { ActiveData, WhatsNewHistoryItem } from "@/types/data";

interface WhatsNewTabProps {
  history: WhatsNewHistoryItem[];
  isLoading: boolean;
  activeData: ActiveData | null;
  onBundleClick: (bundleKey: string) => void;
  onAppClick: (packageName: string) => void;
  onPatchClick: (packageName: string, patchName: string) => void;
}

export function WhatsNewTab({
  history,
  isLoading,
  activeData,
  onBundleClick,
  onAppClick,
  onPatchClick,
}: WhatsNewTabProps) {
  return (
    <div className="my-3">
      <WhatsNewHeader />
      <WhatsNewList
        history={history}
        isLoading={isLoading}
        activeData={activeData}
        onBundleClick={onBundleClick}
        onAppClick={onAppClick}
        onPatchClick={onPatchClick}
      />
    </div>
  );
}
