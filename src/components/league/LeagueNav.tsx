import { NavLink } from 'react-router-dom'

export type LeagueNavItem = { label: string; href: string }

export function LeagueNav({ label, items }: { label: string; items: LeagueNavItem[] }) {
  return (
    <nav className="league-nav" aria-label={`${label} navigation`}>
      <div className="container league-nav__inner">
        {items.map((item) => (
          <NavLink key={item.href} to={item.href}>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
