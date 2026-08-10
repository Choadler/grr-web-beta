import { Link, NavLink, useLocation } from 'react-router-dom'

export type LeagueAdminTool = {
  path: string
  eyebrow: string
  title: string
  description: string
}

export function LeagueAdminNav({
  basePath,
  leagueName,
  tools,
  activeTool,
}: {
  basePath: string
  leagueName: string
  tools: LeagueAdminTool[]
  activeTool?: string
}) {
  const { search } = useLocation()
  const destination = (path: string) => `${path}${search}`
  if (!activeTool) return <div className="admin-function-grid">
    {tools.map((tool) => <Link className="admin-module" to={destination(`${basePath}/${tool.path}`)} key={tool.path}>
      <span>{tool.eyebrow}</span>
      <strong>{tool.title}</strong>
      <p>{tool.description}</p>
      <span className="admin-module__action">Open {tool.title.toLowerCase()} →</span>
    </Link>)}
  </div>

  return <nav className="admin-function-nav" aria-label={`${leagueName} management`}>
    <Link className="admin-function-nav__back" to={destination(basePath)}>← {leagueName} dashboard</Link>
    <div>
      {tools.map((tool) => <NavLink
        className={({ isActive }) => isActive ? 'is-active' : undefined}
        to={destination(`${basePath}/${tool.path}`)}
        key={tool.path}
      >{tool.title}</NavLink>)}
    </div>
  </nav>
}
