import { useEffect } from "react";
import { X } from "lucide-react";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  centerMobile?: boolean;
}

export function CustomModal({
  isOpen,
  onClose,
  children,
  maxWidth = "max-w-205",
  centerMobile = false,
}: CustomModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center ${centerMobile ? "p-4" : "p-4 max-sm:p-0"} animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`rounded-3xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh] shadow-(--shadow-modal) bg-background border-none ${centerMobile ? "" : "max-sm:rounded-none max-sm:max-h-dvh max-sm:h-full"} outline-none animate-in zoom-in-95 duration-200`}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  children: React.ReactNode;
}

export function ModalHeader({ children }: ModalHeaderProps) {
  return (
    <div className="px-3.5 sm:px-6 pt-5 pb-3 border-b border-divider flex flex-col gap-3 sticky top-0 bg-background/80 backdrop-blur-xl z-20">
      {children}
    </div>
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = "" }: ModalBodyProps) {
  return (
    <div
      className={`px-2.5 sm:px-6 pb-5 pt-3 flex flex-col gap-3 overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
}

interface CloseButtonProps {
  onClose: () => void;
}

export function CloseButton({ onClose }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close modal"
      className="rounded-xl shrink-0 border border-divider text-foreground-600 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 w-8 h-8 flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95 shadow-2xs"
    >
      <X className="size-4" />
    </button>
  );
}
