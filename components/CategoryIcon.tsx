'use client'

import { getCategoryIcon, getCategoryIconStyle } from '@/lib/category-icons'

interface CategoryIconProps {
  category: string
  /** Optional: unused when not iconOnly; kept for API compatibility */
  className?: string
  /** If true, render only the icon SVG without the 40x40 container */
  iconOnly?: boolean
}

const ICON_SIZE = 'w-5 h-5'

export default function CategoryIcon({ category, className = 'w-5 h-5', iconOnly = false }: CategoryIconProps) {
  const style = getCategoryIconStyle(category || '')
  const icon = getCategoryIcon(category || '')

  if (iconOnly) {
    return <span className={style.icon}>{icon}</span>
  }

  return (
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.bg} ${style.icon}`}
      aria-hidden
    >
      {icon}
    </div>
  )
}
