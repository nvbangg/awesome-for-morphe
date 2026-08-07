import { CATEGORY_UNIVERSAL } from "@/constants";

export function simplifyString(inputString: string | null | undefined): string {
  return inputString
    ? inputString
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "";
}

export function decodeHtmlEntities(str: string | null | undefined): string {
  return str
    ? str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
    : "";
}

export function slugifyCategory(category: string): string {
  return category
    ? category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : CATEGORY_UNIVERSAL;
}
