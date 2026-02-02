/**
 * Single source of truth for transaction category → icon and style.
 * All mappings are explicit Thai category strings. No index-based mapping.
 */

import React from 'react'

export type IconKey =
  | 'food'
  | 'transit'
  | 'home'
  | 'utilities'
  | 'health'
  | 'entertainment'
  | 'education'
  | 'shopping'
  | 'phone'
  | 'debt'
  | 'investment'
  | 'savings'
  | 'other'
  | 'income_briefcase'
  | 'income_trending'
  | 'income_bonus'
  | 'income_dividend'
  | 'income_interest'
  | 'income_other'
  | 'fallback'

const ICON_SIZE = 'w-5 h-5'

/** Explicit category string → icon key. No index-based mapping. */
export const CATEGORY_TO_ICON_KEY: Record<string, IconKey> = {
  // Income
  'เงินเดือน': 'income_briefcase',
  'โบนัส': 'income_bonus',
  'รายได้เสริม': 'income_trending',
  'เงินปันผล': 'income_dividend',
  'ดอกเบี้ย': 'income_interest',
  'รายได้อื่นๆ': 'income_other',
  // Expense
  'อาหาร': 'food',
  'ค่าเดินทาง': 'transit',
  'ที่พัก/ค่าเช่า': 'home',
  'สาธารณูปโภค': 'utilities',
  'สุขภาพ': 'health',
  'บันเทิง': 'entertainment',
  'การศึกษา': 'education',
  'ช้อปปิ้ง': 'shopping',
  'โทรศัพท์/อินเทอร์เน็ต': 'phone',
  'ผ่อนชำระหนี้': 'debt',
  'ลงทุน': 'investment',
  'ออมเงิน': 'savings',
  'อื่นๆ': 'other',
}

/** Icon key → Tailwind bg + text (fg) classes for contrast. */
export const CATEGORY_STYLE: Record<IconKey, { bg: string; icon: string }> = {
  food: { bg: 'bg-amber-100', icon: 'text-amber-800' },
  transit: { bg: 'bg-blue-100', icon: 'text-blue-800' },
  home: { bg: 'bg-violet-100', icon: 'text-violet-800' },
  utilities: { bg: 'bg-teal-100', icon: 'text-teal-800' },
  health: { bg: 'bg-emerald-100', icon: 'text-emerald-800' },
  entertainment: { bg: 'bg-pink-100', icon: 'text-pink-800' },
  education: { bg: 'bg-indigo-100', icon: 'text-indigo-800' },
  shopping: { bg: 'bg-rose-100', icon: 'text-rose-800' },
  phone: { bg: 'bg-cyan-100', icon: 'text-cyan-800' },
  debt: { bg: 'bg-amber-100', icon: 'text-amber-800' },
  investment: { bg: 'bg-blue-200', icon: 'text-blue-900' },
  savings: { bg: 'bg-emerald-100', icon: 'text-emerald-800' },
  other: { bg: 'bg-gray-100', icon: 'text-gray-700' },
  income_briefcase: { bg: 'bg-emerald-100', icon: 'text-emerald-800' },
  income_trending: { bg: 'bg-sky-100', icon: 'text-sky-800' },
  income_bonus: { bg: 'bg-emerald-100', icon: 'text-emerald-800' },
  income_dividend: { bg: 'bg-blue-100', icon: 'text-blue-800' },
  income_interest: { bg: 'bg-sky-100', icon: 'text-sky-800' },
  income_other: { bg: 'bg-gray-100', icon: 'text-gray-700' },
  fallback: { bg: 'bg-gray-100', icon: 'text-gray-700' },
}

function svg(path: string, className = ICON_SIZE) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

/** Icon elements by key. Explicit paths for each semantic icon. */
const ICON_ELEMENTS: Record<IconKey, React.ReactNode> = {
  // Food: utensils (ช้อนส้อม) — fork and knife crossed
  food: svg(
    'M16 2v6m0 0l-4-4m4 4l4-4M8 2v6m0 0l4-4m-4 4l4 4M15 22v-6m0 0l-4 4m4-4l-4-4M8 22v-6m0 0l4 4m-4-4l4-4'
  ),
  // Transit: arrows (ค่าเดินทาง)
  transit: svg('M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'),
  // Home (ที่พัก/ค่าเช่า)
  home: svg(
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
  ),
  // Utilities: bolt/lightbulb
  utilities: svg(
    'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
  ),
  // Health: heart
  health: svg(
    'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
  ),
  // Entertainment (บันเทิง): play triangle
  entertainment: svg('M8 5v14l11-7L8 5z'),
  // Education: book
  education: svg(
    'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
  ),
  // Shopping: bag/cart
  shopping: svg('M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'),
  // Phone (โทรศัพท์/อินเทอร์เน็ต)
  phone: svg('M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'),
  // Debt: receipt/credit
  debt: svg(
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  ),
  // Investment: chart/coins
  investment: svg(
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
  ),
  // Savings: piggy bank
  savings: svg(
    'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'
  ),
  // Other: dots/more
  other: svg(
    'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  ),
  // Income: briefcase
  income_briefcase: svg(
    'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
  ),
  income_trending: svg('M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'),
  income_bonus: svg(
    'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7'
  ),
  income_dividend: svg(
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
  ),
  income_interest: svg(
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  ),
  income_other: svg(
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  ),
  // Fallback: neutral tag (not book)
  fallback: svg(
    'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a2 2 0 012-2z'
  ),
}

/**
 * Returns the icon key for a category. Used by tests and getCategoryIcon.
 */
export function getCategoryIconKey(category: string): IconKey {
  const key = CATEGORY_TO_ICON_KEY[category]
  if (key != null) return key
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(`[category-icons] Unknown category: "${category}". Using fallback icon.`)
  }
  return 'fallback'
}

/**
 * Returns the icon React node for a transaction category.
 * type is optional (for future income-specific overrides).
 */
export function getCategoryIcon(category: string, _type?: 'income' | 'expense'): React.ReactNode {
  const key = getCategoryIconKey(category || '')
  return ICON_ELEMENTS[key]
}

/**
 * Returns Tailwind classes for icon container background and icon (foreground) color.
 */
export function getCategoryIconStyle(category: string): { bg: string; icon: string } {
  const key = getCategoryIconKey(category || '')
  return CATEGORY_STYLE[key]
}
