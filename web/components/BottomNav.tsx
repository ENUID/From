'use client'
import Link from 'next/link'

type Tab = 'search' | 'discover'

const TABS: { id: Tab; label: string; href: string; icon: React.ReactNode }[] = [
  {
    id: 'search',
    label: 'Search',
    href: '/',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: 'discover',
    label: 'Discover',
    href: '/discover',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
]

export default function BottomNav({ active }: { active: Tab }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 40,
      background: 'var(--bar-bg)',
      borderTop: '1px solid var(--bar-border)',
      boxShadow: 'var(--shadow-bar)',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id
        return (
          <Link
            key={tab.id}
            href={tab.href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '10px 0', gap: 4, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--ink-3)',
              transition: 'color 0.15s ease',
            }}
          >
            <span style={{ opacity: isActive ? 1 : 0.65 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10.5, fontFamily: 'var(--body)',
              fontWeight: isActive ? 500 : 400, letterSpacing: '0.03em',
            }}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
