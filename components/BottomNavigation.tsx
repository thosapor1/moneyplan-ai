'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DashboardIcon, ReceiptIcon, HeartPulseIcon, CalendarIcon } from './icons'

const navItems = [
  { href: '/dashboard', label: 'ภาพรวม', Icon: DashboardIcon },
  { href: '/transactions', label: 'รายรับรายจ่าย', Icon: ReceiptIcon },
  { href: '/profile', label: 'สุขภาพการเงิน', Icon: HeartPulseIcon },
  { href: '/forecasts', label: 'แผน 12 เดือน', Icon: CalendarIcon },
]

export default function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-card">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {navItems.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href ||
            (href !== '/dashboard' && pathname?.startsWith(href))

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 gap-0.5 h-full transition-colors relative ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <Icon size={22} />
              <span className="text-[10px] font-medium leading-none">
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
