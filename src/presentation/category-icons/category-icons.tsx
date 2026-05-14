/**
 * Presentation: Category Icons
 *
 * Single source of truth for transaction category → emoji icon and style.
 * Matches clarity-finance-hub's emoji-based icon approach.
 *
 * Notes (junior-friendly):
 * - This module is in presentation because it returns React nodes.
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

/** Explicit category string → icon key. No index-based mapping. */
export const CATEGORY_TO_ICON_KEY: Record<string, IconKey> = {
  // Income
  เงินเดือน: "income_briefcase",
  โบนัส: "income_bonus",
  รายได้เสริม: "income_trending",
  เงินปันผล: "income_dividend",
  ดอกเบี้ย: "income_interest",
  รายได้อื่นๆ: "income_other",

  // Expense — current categories (matching clarity-finance-hub)
  อาหาร: "food",
  เดินทาง: "transit",
  ช้อปปิ้ง: "shopping",
  "บิล/ค่าใช้จ่าย": "utilities",
  "บิล / ค่าใช้จ่าย": "utilities",
  สุขภาพ: "health",
  บันเทิง: "entertainment",
  การศึกษา: "education",
  ผ่อนชำระหนี้: "debt",
  ออมเงิน: "savings",
  ลงทุน: "investment",
  อื่นๆ: "other",

  // Legacy category names (backward compat for existing DB data)
  ค่าอาหาร: "food",
  ค่าเดินทาง: "transit",
  ค่าสุขภาพ: "health",
  ค่าบันเทิง: "entertainment",
  ค่าการศึกษา: "education",
  "ที่พัก/ค่าเช่า": "home",
  "ที่พัก / ค่าเช่า": "home",
  ที่พักค่าเช่า: "home",
  สาธารณูปโภค: "utilities",
  "โทรศัพท์/อินเทอร์เน็ต": "phone",
  "โทรศัพท์ / อินเทอร์เน็ต": "phone",

  // Sub-categories from KBank statement parser (matches migration 007 seed)
  อาหารร้าน: "food",
  "อาหารร้าน (QR)": "food",
  ฟู้ดเดลิเวอรี่: "food",
  คาเฟ่: "food",
  ร้านสะดวกซื้อ: "food",
  "BTS Rabbit Card": "transit",
  "ช้อปปิ้ง/ของใช้": "shopping",
  "ช้อปปิ้ง / ของใช้": "shopping",
  "มือถือ (AIS)": "phone",
  "TrueMoney (auto-debit)": "utilities",
  บิลอื่นๆ: "utilities",
  "หนี้ TTB Cash Card": "debt",
  "หนี้บัตรเครดิต KBank": "debt",
  "ค่าบ้าน+เงินเก็บ (เมีย)": "home",
  โอนไปบัญชีตัวเอง: "savings",
  โอนให้คน: "other",
  ถอนเงินสด: "other",
};

/**
 * Runtime registry for DB-sourced category icon overrides.
 * The hook `useExpenseCategories` populates this once the list is fetched, so
 * `getCategoryIconKey` resolves new DB-added categories without code changes.
 */
const RUNTIME_ICON_REGISTRY = new Map<string, IconKey>();

const VALID_ICON_KEYS = new Set<IconKey>([
  "food", "transit", "home", "utilities", "health", "entertainment",
  "education", "shopping", "phone", "debt", "investment", "savings", "other",
  "income_briefcase", "income_trending", "income_bonus", "income_dividend",
  "income_interest", "income_other", "fallback",
]);

/** Register an icon_key override for a category name (called by the hook). */
export function registerCategoryIcon(name: string, iconKey: string): void {
  const normalized = normalizeCategoryKey(name);
  if (!normalized) return;
  if (VALID_ICON_KEYS.has(iconKey as IconKey)) {
    RUNTIME_ICON_REGISTRY.set(normalized, iconKey as IconKey);
  } else {
    RUNTIME_ICON_REGISTRY.set(normalized, "other");
  }
}

/** Bulk-register category → icon_key overrides. */
export function registerCategoryIcons(
  entries: ReadonlyArray<{ name: string; icon_key: string }>,
): void {
  entries.forEach((e) => registerCategoryIcon(e.name, e.icon_key));
}

/** Icon key → Tailwind bg class + emoji (matching clarity-finance-hub style). */
export const CATEGORY_STYLE: Record<IconKey, { bg: string; icon: string; emoji: string }> = {
  food: { bg: "bg-orange-100", icon: "text-orange-700", emoji: "🍜" },
  transit: { bg: "bg-blue-100", icon: "text-blue-700", emoji: "🚗" },
  home: { bg: "bg-violet-100", icon: "text-violet-700", emoji: "🏠" },
  utilities: { bg: "bg-yellow-100", icon: "text-yellow-700", emoji: "📄" },
  health: { bg: "bg-rose-100", icon: "text-rose-700", emoji: "💊" },
  entertainment: { bg: "bg-emerald-100", icon: "text-emerald-700", emoji: "🎬" },
  education: { bg: "bg-sky-100", icon: "text-sky-700", emoji: "📚" },
  shopping: { bg: "bg-purple-100", icon: "text-purple-700", emoji: "🛍️" },
  phone: { bg: "bg-cyan-100", icon: "text-cyan-700", emoji: "📱" },
  debt: { bg: "bg-amber-100", icon: "text-amber-700", emoji: "📋" },
  investment: { bg: "bg-blue-100", icon: "text-blue-700", emoji: "📈" },
  savings: { bg: "bg-emerald-100", icon: "text-emerald-700", emoji: "🐷" },
  other: { bg: "bg-gray-100", icon: "text-gray-600", emoji: "📌" },

  income_briefcase: { bg: "bg-emerald-100", icon: "text-emerald-700", emoji: "💼" },
  income_trending: { bg: "bg-sky-100", icon: "text-sky-700", emoji: "💰" },
  income_bonus: { bg: "bg-emerald-100", icon: "text-emerald-700", emoji: "🎁" },
  income_dividend: { bg: "bg-blue-100", icon: "text-blue-700", emoji: "📊" },
  income_interest: { bg: "bg-sky-100", icon: "text-sky-700", emoji: "💵" },
  income_other: { bg: "bg-gray-100", icon: "text-gray-600", emoji: "💰" },

  fallback: { bg: "bg-gray-100", icon: "text-gray-600", emoji: "📌" },
};

/**
 * Returns the icon key for a category.
 * - Used by tests and `getCategoryIcon`/`getCategoryIconStyle`.
 */
export function getCategoryIconKey(category: string): IconKey {
  // IMPORTANT: data from DB/user input may contain leading/trailing spaces or invisible chars.
  // Always normalize before lookup so icons don't "disappear" in production for certain categories.
  const normalized = normalizeCategoryKey(category);

  // Runtime registry (DB-sourced) takes precedence over the hardcoded map so
  // categories added in the DB after deploy still resolve correctly.
  const runtime = RUNTIME_ICON_REGISTRY.get(normalized);
  if (runtime != null) return runtime;

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
 * Returns Tailwind classes and emoji for icon container.
 */
export function getCategoryIconStyle(category: string): {
  bg: string;
  icon: string;
  emoji: string;
} {
  const key = getCategoryIconKey(category || "");
  return CATEGORY_STYLE[key];
}

/** Returns the emoji string for a transaction category. */
export function getCategoryEmoji(category: string): string {
  const key = getCategoryIconKey(category || "");
  return CATEGORY_STYLE[key]?.emoji ?? "📌";
}

/**
 * Returns the emoji React node for a transaction category.
 * Uses emoji icons matching clarity-finance-hub style.
 */
export function getCategoryIcon(
  category: string,
  _type?: "income" | "expense",
): React.ReactNode {
  return <span>{getCategoryEmoji(category)}</span>;
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
