'use client'

/**
 * TypePill — subtle indicator for expense type: fixed (คงที่) or variable (แปรผัน).
 * Uses Tailwind only so it always renders visibly. Low visual weight, readable at a glance.
 */

type TypePillType = 'fixed' | 'variable'

const LABELS: Record<TypePillType, string> = {
  fixed: 'คงที่',
  variable: 'แปรผัน',
}

const TITLES: Record<TypePillType, string> = {
  fixed: 'ค่าใช้จ่ายคงที่',
  variable: 'ค่าใช้จ่ายแปรผัน',
}

type Props = {
  type: TypePillType
  showDot?: boolean
  className?: string
}

export default function TypePill({ type, showDot = false, className = '' }: Props) {
  const label = LABELS[type]
  const title = TITLES[type]

  return (
    <span
      role="status"
      aria-label={title}
      title={title}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ${className}`}
    >
      {showDot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-500 opacity-60" />}
      {label}
    </span>
  )
}
