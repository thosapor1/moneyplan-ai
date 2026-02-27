/**
 * Presentation: Category Icons
 *
 * Single source of truth for transaction category → icon and style.
 *
 * Notes (junior-friendly):
 * - This module is in presentation because it returns React nodes (SVG icons).
 * - Mappings are explicit Thai category strings (no index-based mapping).
 * - Unknown categories fallback to a safe icon + neutral style.
 */

import React from "react";

export type IconKey =
  | "food"
  | "transit"
  | "home"
  | "utilities"
  | "health"
  | "entertainment"
  | "education"
  | "shopping"
  | "phone"
  | "debt"
  | "investment"
  | "savings"
  | "other"
  | "income_briefcase"
  | "income_trending"
  | "income_bonus"
  | "income_dividend"
  | "income_interest"
  | "income_other"
  | "fallback";

const ICON_SIZE = "w-5 h-5";

/** Explicit category string → icon key. No index-based mapping. */
export const CATEGORY_TO_ICON_KEY: Record<string, IconKey> = {
  // Income
  เงินเดือน: "income_briefcase",
  โบนัส: "income_bonus",
  รายได้เสริม: "income_trending",
  เงินปันผล: "income_dividend",
  ดอกเบี้ย: "income_interest",
  รายได้อื่นๆ: "income_other",

  // Expense
  อาหาร: "food",
  ค่าเดินทาง: "transit",
  "ที่พัก/ค่าเช่า": "home",
  สาธารณูปโภค: "utilities",
  สุขภาพ: "health",
  บันเทิง: "entertainment",
  การศึกษา: "education",
  ช้อปปิ้ง: "shopping",
  "โทรศัพท์/อินเทอร์เน็ต": "phone",
  ผ่อนชำระหนี้: "debt",
  ลงทุน: "investment",
  ออมเงิน: "savings",
  อื่นๆ: "other",
};

/** Icon key → Tailwind bg + text (fg) classes for contrast. */
export const CATEGORY_STYLE: Record<IconKey, { bg: string; icon: string }> = {
  food: { bg: "bg-amber-100", icon: "text-amber-800" },
  transit: { bg: "bg-blue-100", icon: "text-blue-800" },
  home: { bg: "bg-violet-100", icon: "text-violet-800" },
  utilities: { bg: "bg-teal-100", icon: "text-teal-800" },
  health: { bg: "bg-emerald-100", icon: "text-emerald-800" },
  entertainment: { bg: "bg-pink-100", icon: "text-pink-800" },
  education: { bg: "bg-indigo-100", icon: "text-indigo-800" },
  shopping: { bg: "bg-rose-100", icon: "text-rose-800" },
  phone: { bg: "bg-cyan-100", icon: "text-cyan-800" },
  debt: { bg: "bg-amber-100", icon: "text-amber-800" },
  investment: { bg: "bg-blue-200", icon: "text-blue-900" },
  savings: { bg: "bg-emerald-100", icon: "text-emerald-800" },
  other: { bg: "bg-gray-100", icon: "text-gray-700" },

  income_briefcase: { bg: "bg-emerald-100", icon: "text-emerald-800" },
  income_trending: { bg: "bg-sky-100", icon: "text-sky-800" },
  income_bonus: { bg: "bg-emerald-100", icon: "text-emerald-800" },
  income_dividend: { bg: "bg-blue-100", icon: "text-blue-800" },
  income_interest: { bg: "bg-sky-100", icon: "text-sky-800" },
  income_other: { bg: "bg-gray-100", icon: "text-gray-700" },

  fallback: { bg: "bg-gray-100", icon: "text-gray-700" },
};

function IconSvg({ d }: { d: string }) {
  return (
    <svg
      className={ICON_SIZE}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={d}
      />
    </svg>
  );
}

/**
 * Returns the icon key for a category.
 * - Used by tests and `getCategoryIcon`/`getCategoryIconStyle`.
 */
export function getCategoryIconKey(category: string): IconKey {
  // IMPORTANT: data from DB/user input may contain leading/trailing spaces or invisible chars.
  // Always normalize before lookup so icons don't "disappear" in production for certain categories.
  const normalized = normalizeCategoryKey(category);

  const key = CATEGORY_TO_ICON_KEY[normalized];
  if (key != null) return key;

  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "development"
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `[category-icons] Unknown category: "${category}" (normalized: "${normalized}"). Using fallback icon.`,
    );

    // DEV-ONLY debug: print code points so we can spot invisible chars (NBSP, ZWSP, etc.)
    // eslint-disable-next-line no-console
    console.warn(`[category-icons] raw codes: ${debugCharCodes(category)}`);
    // eslint-disable-next-line no-console
    console.warn(
      `[category-icons] normalized codes: ${debugCharCodes(normalized)}`,
    );
  }
  return "fallback";
}

function debugCharCodes(input: string): string {
  return Array.from(input ?? "")
    .map((ch) => {
      const cp = ch.codePointAt(0);
      if (cp == null) return ch;
      return `${ch}(U+${cp.toString(16).toUpperCase().padStart(4, "0")})`;
    })
    .join(" ");
}

/**
 * Returns Tailwind classes for icon container background and icon (foreground) color.
 */
export function getCategoryIconStyle(category: string): {
  bg: string;
  icon: string;
} {
  const key = getCategoryIconKey(category || "");
  return CATEGORY_STYLE[key];
}

/**
 * Returns the icon React node for a transaction category.
 * Icons are created on-demand (switch) so production build does not drop them.
 */
export function getCategoryIcon(
  category: string,
  _type?: "income" | "expense",
): React.ReactNode {
  const key = getCategoryIconKey(category || "");

  switch (key) {
    case "food":
      return (
        <IconSvg d="M7 2v7M5 2v4M9 2v4M7 9v13M17 2c-2 0-3 2-3 4v4h6V6c0-2-1-4-3-4zm0 8v12" />
      );
    case "transit":
      return (
        <IconSvg d="M7 18c-1.7 0-3-1.3-3-3V7c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v8c0 1.7-1.3 3-3 3M7 18h10M8 18l-2 2M16 18l2 2M7 8h10M8 14h.01M16 14h.01" />
      );
    case "home":
      return (
        <IconSvg d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      );
    case "utilities":
      return (
        <IconSvg d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      );
    case "health":
      return (
        <IconSvg d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      );
    case "entertainment":
      return <IconSvg d="M8 5v14l11-7L8 5z" />;
    case "education":
      return (
        <IconSvg d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      );
    case "shopping":
      return <IconSvg d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />;
    case "phone":
      return (
        <IconSvg d="M15 3h-6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2M11 18h2M18 8c1.7 1.7 1.7 4.3 0 6M20 6c2.9 2.9 2.9 7.1 0 10" />
      );
    case "debt":
      return (
        <IconSvg d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      );
    case "investment":
      return (
        <IconSvg d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      );
    case "savings":
      return (
        <IconSvg d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      );
    case "other":
      return (
        <IconSvg d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      );

    case "income_briefcase":
      return (
        <IconSvg d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      );
    case "income_trending":
      return <IconSvg d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />;
    case "income_bonus":
      return (
        <IconSvg d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      );
    case "income_dividend":
      return (
        <IconSvg d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      );
    case "income_interest":
      return (
        <IconSvg d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      );
    case "income_other":
      return (
        <IconSvg d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      );

    default:
      return (
        <IconSvg d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a2 2 0 012-2z" />
      );
  }
}

function normalizeCategoryKey(input: string): string {
  // Normalize category string from DB/user input so lookups are stable in production.
  // Handles:
  // - leading/trailing whitespace
  // - NBSP and other unicode spaces
  // - zero-width characters (ZWSP, ZWNJ, ZWJ, BOM)
  // - fullwidth slashes/characters
  // - repeated whitespace around/inside strings
  // - stray newlines/tabs
  return (
    (input ?? "")
      // Common invisible chars that appear from copy/paste or rich text inputs:
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, "") // ZWSP, ZWNJ, ZWJ, BOM
      .replace(/\u00A0/g, " ") // NBSP -> normal space
      // Normalize slash variants that look identical in UI but differ in code points:
      .replace(/\uFF0F/g, "/") // FULLWIDTH SOLIDUS -> "/"
      // Collapse whitespace:
      .replace(/\s+/g, " ")
      .trim()
  );
}
