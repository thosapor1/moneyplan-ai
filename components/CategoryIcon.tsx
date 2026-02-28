'use client'

import { getCategoryIconKey, getCategoryIconStyle } from '@/lib/category-icons'

interface CategoryIconProps {
  category: string
  className?: string
  iconOnly?: boolean
}

export default function CategoryIcon({ category, className = '', iconOnly = false }: CategoryIconProps) {
  const style = getCategoryIconStyle(category || '')

  if (iconOnly) {
    return <span className="text-sm">{style.emoji}</span>
  }

  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-secondary text-sm ${className}`}
      aria-hidden
    >
      {style.emoji}
    </div>
  )
}
