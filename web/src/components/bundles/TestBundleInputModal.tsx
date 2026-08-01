import { useState } from "react";
import { CustomModal, ModalBody } from "@/components/common/CustomModal";
import { SearchInput } from "@/components/common/SearchInput";

interface TestBundleInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (link: string) => void;
  isLoading?: boolean;
  error?: string;
}

export function TestBundleInputModal({ isOpen, onClose, onSubmit, isLoading, error }: TestBundleInputModalProps) {
  const [link, setLink] = useState("");

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" centerMobile={true}>
      <ModalBody className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim() && !isLoading) {
              const targetLink = link.trim();
              setLink("");
              onSubmit(targetLink);
            }
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm font-medium text-foreground">Enter a GitHub / GitLab repository URL</p>
          <div className="flex flex-col gap-1">
            <SearchInput value={link} onChange={setLink} placeholder="https://github.com/owner/repo" className="w-full" />
            {error && <p className="text-sm text-danger mt-1">{error}</p>}
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl font-medium text-foreground-600 bg-background-200 hover:bg-background-300 dark:bg-background-800 dark:hover:bg-background-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!link.trim() || isLoading}
              className="px-5 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                "OK"
              )}
            </button>
          </div>
        </form>
      </ModalBody>
    </CustomModal>
  );
}
