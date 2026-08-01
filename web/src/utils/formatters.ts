const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const standardFormatter = new Intl.NumberFormat("en-US");

export function formatNumberCompact(num: number | undefined | null): string {
  if (!num) return "0";
  return compactFormatter.format(num) + "+";
}

export function formatStarCount(num: number | undefined | null): string {
  if (!num) return "0";
  return standardFormatter.format(num);
}

export function isNew(firstSeen: number | undefined | null, daysThreshold: number = 7): boolean {
  if (!firstSeen || firstSeen <= 0) return false;
  const now = Date.now();
  const diffInDays = (now - firstSeen) / (1000 * 60 * 60 * 24);
  return diffInDays <= daysThreshold;
}
