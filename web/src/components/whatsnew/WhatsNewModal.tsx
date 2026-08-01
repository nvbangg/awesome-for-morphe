import { WhatsNewList } from "@/components/whatsnew/WhatsNewList";
import { ActiveData, WhatsNewHistoryItem } from "@/data";
import { Modal, Button } from "@heroui/react";
import { Sparkles, X } from "lucide-react";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: WhatsNewHistoryItem[];
  isLoading: boolean;
  activeData: ActiveData | null;
  onBundleClick: (bundleKey: string) => void;
  onAppClick: (packageName: string) => void;
  onPatchClick: (packageName: string, patchName: string) => void;
}

export function WhatsNewModal({ isOpen, onClose, history, isLoading, activeData, onBundleClick, onAppClick, onPatchClick }: WhatsNewModalProps) {
  if (!isOpen) return null;

  return (
    <Modal state={{ isOpen, open: () => {}, close: onClose, toggle: () => {}, setOpen: () => {} }}>
      <Modal.Backdrop onClick={onClose} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Modal.Container placement="center" className="w-full flex items-center justify-center">
          <Modal.Dialog
            onClick={(event) => event.stopPropagation()}
            className="rounded-3xl w-full max-w-205 overflow-hidden flex flex-col max-h-[90vh] shadow-(--shadow-modal) bg-background border-none max-sm:rounded-none max-sm:max-h-dvh max-sm:h-full outline-none"
          >
            <Modal.Header className="flex flex-row items-center justify-between gap-4 border-b border-divider px-6 py-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
                  <Sparkles className="size-6" />
                </div>
                <div className="flex flex-col">
                  <h2 className="font-bold text-xl text-foreground">What's New</h2>
                  <span className="text-xs text-foreground-400">Recent patch updates</span>
                </div>
              </div>

              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                className="rounded-full shrink-0 border-none bg-transparent hover:bg-default-100 text-foreground-500 hover:text-foreground"
                onPress={onClose}
                aria-label="Close modal"
              >
                <X className="size-4" />
              </Button>
            </Modal.Header>

            <Modal.Body className="px-6 py-4 max-h-[65vh] overflow-y-auto">
              <WhatsNewList history={history} isLoading={isLoading} activeData={activeData} onBundleClick={onBundleClick} onAppClick={onAppClick} onPatchClick={onPatchClick} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
