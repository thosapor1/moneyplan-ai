/**
 * Legacy category icons module (backward-compatible).
 *
 * Clean Architecture refactor:
 * - Category icon mapping + React icon render helpers now live in:
 *   `src/presentation/category-icons/category-icons.tsx`
 * - This file exists only to preserve existing imports like `@/lib/category-icons`.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify icon mappings and rendering in the presentation module instead.
 *
 * Note:
 * - Use a relative import so test tooling does not depend on Next.js-only path aliases.
 */

export {
  CATEGORY_TO_ICON_KEY,
  CATEGORY_STYLE,
  getCategoryIcon,
  getCategoryIconKey,
  getCategoryIconStyle,
  type IconKey,
} from "../src/presentation/category-icons/category-icons";
