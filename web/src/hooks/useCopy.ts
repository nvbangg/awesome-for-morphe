import { useState, useCallback } from "react";

export function useCopy(resetDurationMilliseconds: number = 1500) {
  const [copiedIdentifier, setCopiedIdentifier] = useState<string | null>(null);

  const copyToClipboard = useCallback(
    (textToCopy: string, customIdentifier?: string) => {
      if (!textToCopy) return;

      const activeIdentifier = customIdentifier || textToCopy;

      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setCopiedIdentifier(activeIdentifier);
          setTimeout(() => {
            setCopiedIdentifier(null);
          }, resetDurationMilliseconds);
        })
        .catch((copyError) => {
          console.error("Failed to copy text to clipboard:", copyError);
        });
    },
    [resetDurationMilliseconds],
  );

  return { copiedText: copiedIdentifier, copyToClipboard };
}
