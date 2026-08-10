import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { SportingCodeAdmin } from '../components/admin/SportingCodeAdmin'
import { LeagueAdminNav, type LeagueAdminTool } from '../components/admin/LeagueAdminNav'
import { ImportSourceViewer, type ImportSource } from '../components/admin/ImportSourceViewer'
import { defaultGtPoints, gtClasses, loadGtAdmin, loadGtImportSource, mutateGtAdmin } from '../services/gtAdmin'
import { parseGtResultJson } from '../services/gtImport'
import { gtDriverNamesMatch } from '../config/gtRoster'
import type {
  GtAdminState,
  GtClassKey,
  GtDriverAssignment,
  GtImportPreview,
  GtManagedResult,
  GtPointsConfig,
  GtRaceFormat,
  GtScheduledEvent,
  GtSeason,
  GtTeam,
} from '../types/gtAdmin'

const id = () => crypto.randomUUID()
type Control = { open?: boolean; onToggle?: (open: boolean) => void; standalone?: boolean }
function Section({
  title,
  eyebrow,
  summary,
  open,
  onToggle,
  standalone,
  children,
}: { title: string; eyebrow: string; summary?: string; children: React.ReactNode } & Control) {
  if (standalone) return <section className="admin-card admin-card--standalone">
    <header className="admin-card__standalone-heading"><small>{eyebrow}</small><h2>{title}</h2>{summary ? <p>{summary}</p> : null}</header>
    <div className="admin-card__content">{children}</div>
  </section>
  return (
    <details
      className="admin-card admin-card--collapsible"
      open={open}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary>
        <span>
          <small>{eyebrow}</small>
          <strong>{title}</strong>
          {!open && summary && <span className="admin-card__summary">{summary}</span>}
        </span>
        <span className="admin-card__toggle" aria-hidden="true">
          Open
        </span>
      </summary>
      <div className="admin-card__content">{children}</div>
    </details>
  )
}
const newSeason = (): GtSeason => ({
  id: id(),
  name: 'GT League Season 1',
  status: 'draft',
  raceTime: '20:00',
  timezone: 'America/New_York',
  legacyRosterFallback: 0,
})

function SeasonEditor({
  state,
  seasonId,
  refresh,
  ...control
}: { state: GtAdminState; seasonId?: string; refresh: (message?: string) => Promise<void> } & Control) {
  const [season, setSeason] = useState(
    state.seasons.find((item) => item.id === seasonId) ?? state.seasons.find((item) => item.status === 'active') ?? state.seasons[0] ?? newSeason(),
  )
  const [copyFrom, setCopyFrom] = useState('')
  const [copy, setCopy] = useState({ drivers: true, teams: true, schedule: false, settings: true })
  const isNew = !state.seasons.some((item) => item.id === season.id)
  const [busy, setBusy] = useState(false)
  const activate = async (item: GtSeason) => {
    if (!confirm(`Set ${item.name} as the active public GT season?`)) return
    setBusy(true)
    await mutateGtAdmin({ action: 'saveSeason', season: { ...item, status: 'active' } })
    setSeason({ ...item, status: 'active' })
    await refresh(`${item.name} is now the active GT season.`)
    setBusy(false)
  }
  return (
    <Section title="GT League season" eyebrow="Season control" {...control}>
      <div className="admin-season-picker">
        <div><strong>Season Manager</strong><p>Select a season to edit or choose which season is public.</p></div>
        <button
          className="button button--secondary"
          type="button"
          disabled={isNew}
          onClick={() => {
            setSeason(newSeason())
            setCopyFrom('')
          }}
        >
          {isNew ? 'Creating New Season' : '+ Create New Season'}
        </button>
      </div>
      {state.seasons.length ? <div className="admin-table-wrap"><table className="admin-table admin-season-list">
        <thead><tr><th>Season</th><th>Status</th><th>Race Time</th><th>Actions</th></tr></thead>
        <tbody>{state.seasons.map((item) => <tr className={!isNew && item.id === season.id ? 'is-selected' : undefined} key={item.id}>
          <td><strong>{item.name}</strong></td><td><span className={`admin-season-status admin-season-status--${item.status}`}>{item.status}</span></td><td>{item.raceTime} · {item.timezone}</td>
          <td><div className="admin-season-list__actions"><button type="button" onClick={() => { setSeason(item); setCopyFrom('') }}>Edit</button><button className="button button--compact" type="button" disabled={busy || item.status === 'active'} onClick={() => void activate(item)}>{item.status === 'active' ? 'Active Season' : 'Set Active'}</button></div></td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-notice">No GT seasons have been created yet. Create the first season to get started.</p>}
      <h3 className="admin-season-editor-title">{isNew ? 'Create New Season' : `Edit ${season.name}`}</h3>
      <div className="admin-form-grid">
        <label>
          Season name
          <input
            value={season.name}
            onChange={(event) => setSeason({ ...season, name: event.target.value })}
          />
        </label>
        <label>
          Status
          <select
            value={season.status}
            onChange={(event) =>
              setSeason({ ...season, status: event.target.value as GtSeason['status'] })
            }
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          Race time
          <input
            type="time"
            value={season.raceTime}
            onChange={(event) => setSeason({ ...season, raceTime: event.target.value })}
          />
        </label>
        <label>
          Time zone
          <input
            value={season.timezone}
            onChange={(event) => setSeason({ ...season, timezone: event.target.value })}
          />
        </label>
      </div>
      {isNew && state.seasons.length ? <fieldset className="admin-copy-options"><legend>Initialize from another season</legend>
        <label>Copy from<select value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}><option value="">Start blank</option>{state.seasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {copyFrom ? <div>{([['drivers', 'Driver roster'], ['teams', 'Teams and assignments'], ['schedule', 'Schedule structure'], ['settings', 'Scoring settings']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={copy[key]} onChange={(event) => setCopy({ ...copy, [key]: event.target.checked })} /> {label}</label>)}</div> : null}
        <small>Results, standings, penalties, completed-race state, and imported JSON are never copied.</small>
      </fieldset> : null}
      <button
        className="button"
        type="button"
        disabled={busy || !season.name}
        onClick={async () => {
          setBusy(true)
          await mutateGtAdmin({ action: 'saveSeason', season, copyFrom: isNew ? copyFrom : '', copy })
          await refresh('GT season saved.')
          setBusy(false)
        }}
      >
        {busy ? 'Saving…' : 'Save season'}
      </button>
    </Section>
  )
}

function PointsEditor({
  state,
  seasonId,
  refresh,
  ...control
}: {
  state: GtAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & Control) {
  const [format, setFormat] = useState<GtRaceFormat>('standard')
  const [config, setConfig] = useState<GtPointsConfig>(
    state.points[seasonId]?.[format] ?? structuredClone(defaultGtPoints),
  )
  return (
    <Section
      title="Race format points tables"
      eyebrow="Scoring"
      summary="One Standard table and one Endurance table"
      {...control}
    >
      <label>
        Race format
        <select
          value={format}
          onChange={(event) => {
            const next = event.target.value as GtRaceFormat
            setFormat(next)
            setConfig(state.points[seasonId]?.[next] ?? structuredClone(defaultGtPoints))
          }}
        >
          <option value="standard">Standard</option>
          <option value="endurance">Endurance</option>
        </select>
      </label>
      <p className="admin-notice">
        All three classes use this table and are scored independently within their own class.
      </p>
      <div className="admin-form-grid admin-form-grid--bonuses">
        <label>
          Pole bonus
          <input
            type="number"
            min="0"
            value={config.poleBonus}
            onChange={(event) => setConfig({ ...config, poleBonus: Number(event.target.value) })}
          />
        </label>
        <label>
          Fastest lap bonus
          <input
            type="number"
            min="0"
            value={config.fastestLapBonus}
            onChange={(event) =>
              setConfig({ ...config, fastestLapBonus: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Lead a lap bonus
          <input
            type="number"
            min="0"
            value={config.lapLedBonus}
            onChange={(event) => setConfig({ ...config, lapLedBonus: Number(event.target.value) })}
          />
        </label>
        <label>
          Most laps led bonus
          <input
            type="number"
            min="0"
            value={config.mostLapsLedBonus}
            onChange={(event) =>
              setConfig({ ...config, mostLapsLedBonus: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="points-grid">
        {config.positions.map((rule, index) => (
          <label key={rule.position}>
            <span>P{rule.position}</span>
            <input
              type="number"
              min="0"
              value={rule.points}
              onChange={(event) =>
                setConfig({
                  ...config,
                  positions: config.positions.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, points: Number(event.target.value) } : item,
                  ),
                })
              }
            />
          </label>
        ))}
      </div>
      <button
        className="button"
        type="button"
        onClick={async () => {
          await mutateGtAdmin({ action: 'savePoints', seasonId, format, points: config })
          await refresh(`${format === 'standard' ? 'Standard' : 'Endurance'} points saved.`)
        }}
      >
        Save points table
      </button>
    </Section>
  )
}

function AssignmentsEditor({
  state,
  seasonId,
  refresh,
  ...control
}: {
  state: GtAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & Control) {
  const blank = (): GtDriverAssignment => ({
    seasonId,
    customerId: 0,
    driver: '',
    classKey: 'gt3-am',
    team: '',
    car: '',
  })
  const rows = state.assignments.filter((entry) => entry.seasonId === seasonId)
  const [newItem, setNewItem] = useState(blank())
  const [editing, setEditing] = useState<GtDriverAssignment | null>(null)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [carFilter, setCarFilter] = useState('all')
  const [sort, setSort] = useState<'driver' | 'classKey' | 'car' | 'team'>('driver')
  const [descending, setDescending] = useState(false)
  const cars = [...new Set(rows.map((row) => row.car).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
  const visibleRows = rows
    .filter((row) => {
      const query = search.trim().toLowerCase()
      const matchesSearch =
        !query ||
        [row.driver, row.car, row.team, String(row.customerId)].some((value) =>
          value.toLowerCase().includes(query),
        )
      return (
        matchesSearch &&
        (classFilter === 'all' || row.classKey === classFilter) &&
        (carFilter === 'all' || row.car === carFilter)
      )
    })
    .sort((left, right) => {
      const comparison = String(left[sort] || '').localeCompare(
        String(right[sort] || ''),
        undefined,
        { numeric: true, sensitivity: 'base' },
      )
      return descending ? -comparison : comparison
    })
  const changeSort = (next: typeof sort) => {
    if (sort === next) setDescending((value) => !value)
    else {
      setSort(next)
      setDescending(false)
    }
  }
  const editFields = (value: GtDriverAssignment, setValue: (next: GtDriverAssignment) => void) => (
    <div className="admin-form-grid">
      <label>
        Customer ID
        <input
          type="number"
          min="1"
          value={value.customerId > 0 ? value.customerId : ''}
          placeholder="Assigned on import"
          onChange={(event) =>
            setValue({ ...value, customerId: Number(event.target.value) || value.customerId })
          }
        />
      </label>
      <label>
        Driver
        <input
          value={value.driver}
          onChange={(event) => setValue({ ...value, driver: event.target.value })}
        />
      </label>
      <label>
        GRR class
        <select
          value={value.classKey}
          onChange={(event) => setValue({ ...value, classKey: event.target.value as GtClassKey })}
        >
          {gtClasses.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Team
        <input
          value={value.team}
          onChange={(event) => setValue({ ...value, team: event.target.value })}
        />
      </label>
      <label>
        Car
        <input
          value={value.car}
          onChange={(event) => setValue({ ...value, car: event.target.value })}
        />
      </label>
    </div>
  )
  return (
    <Section
      title="Driver class assignments"
      eyebrow="Roster"
      summary={`${rows.length} drivers assigned`}
      {...control}
    >
      <p>
        Search and filter the season roster below. Customer IDs marked pending will be connected
        automatically when a matching iRacing race is imported.
      </p>
      <details>
        <summary>Add a new driver</summary>
        {editFields(newItem, setNewItem)}
        <button
          className="button"
          type="button"
          disabled={!newItem.customerId || !newItem.driver}
          onClick={async () => {
            await mutateGtAdmin({ action: 'saveAssignment', assignment: newItem })
            setNewItem(blank())
            await refresh('Driver assignment saved.')
          }}
        >
          Add driver
        </button>
      </details>
      <div className="admin-form-grid">
        <label>
          Search roster
          <input
            type="search"
            value={search}
            placeholder="Driver, team, car, or ID"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Class
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="all">All classes</option>
            {gtClasses.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Car
          <select value={carFilter} onChange={(event) => setCarFilter(event.target.value)}>
            <option value="all">All cars</option>
            {cars.map((car) => (
              <option key={car} value={car}>
                {car}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        {visibleRows.length} of {rows.length} drivers shown
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => changeSort('driver')}>
                  Driver {sort === 'driver' ? (descending ? '▼' : '▲') : ''}
                </button>
              </th>
              <th>ID</th>
              <th>
                <button type="button" onClick={() => changeSort('classKey')}>
                  Class {sort === 'classKey' ? (descending ? '▼' : '▲') : ''}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => changeSort('team')}>
                  Team {sort === 'team' ? (descending ? '▼' : '▲') : ''}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => changeSort('car')}>
                  Car {sort === 'car' ? (descending ? '▼' : '▲') : ''}
                </button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <Fragment key={`${row.customerId}:${row.driver}`}>
                <tr>
                  <td>{row.driver}</td>
                  <td>{row.customerId > 0 ? row.customerId : 'Pending'}</td>
                  <td>{gtClasses.find((item) => item.key === row.classKey)?.label}</td>
                  <td>{row.team || '—'}</td>
                  <td>{row.car || '—'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing(editing?.customerId === row.customerId ? null : { ...row })
                      }
                    >
                      Edit
                    </button>{' '}
                    <button
                      type="button"
                      className="admin-action--danger"
                      onClick={async () => {
                        if (!confirm(`Remove ${row.driver}'s class assignment?`)) return
                        await mutateGtAdmin({
                          action: 'deleteAssignment',
                          seasonId,
                          customerId: row.customerId,
                        })
                        await refresh('Assignment removed.')
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
                {editing?.customerId === row.customerId ? (
                  <tr className="admin-table__editor">
                    <td colSpan={6}>
                      {editFields(editing, setEditing)}
                      <div className="admin-card__actions">
                        <button
                          className="button"
                          type="button"
                          disabled={!editing.driver}
                          onClick={async () => {
                            await mutateGtAdmin({ action: 'saveAssignment', assignment: editing })
                            setEditing(null)
                            await refresh('Driver assignment saved.')
                          }}
                        >
                          Save changes
                        </button>
                        <button type="button" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function TeamsEditor({
  state,
  seasonId,
  refresh,
  ...control
}: {
  state: GtAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & Control) {
  const drivers = state.assignments
    .filter((item) => item.seasonId === seasonId)
    .sort((a, b) => a.driver.localeCompare(b.driver))
  const teams = state.teams.filter((item) => item.seasonId === seasonId)
  const blank = (): GtTeam => ({
    id: id(),
    seasonId,
    name: '',
    classKey: 'gt3-am',
    car: '',
    memberIds: [],
    memberNames: [],
  })
  const [team, setTeam] = useState(blank())
  const [search, setSearch] = useState('')
  const [showAllClasses, setShowAllClasses] = useState(false)
  const visible = drivers.filter(
    (driver) =>
      (showAllClasses ||
        driver.classKey === team.classKey ||
        team.memberNames.includes(driver.driver)) &&
      (!search.trim() ||
        `${driver.driver} ${driver.car} ${driver.classKey}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())),
  )
  const selected = (driver: GtDriverAssignment) => team.memberNames.includes(driver.driver)
  const toggle = (driver: GtDriverAssignment) =>
    setTeam((current) =>
      selected(driver)
        ? {
            ...current,
            memberNames: current.memberNames.filter((name) => name !== driver.driver),
            memberIds: current.memberIds.filter(
              (_, index) => current.memberNames[index] !== driver.driver,
            ),
          }
        : {
            ...current,
            memberNames: [...current.memberNames, driver.driver],
            memberIds: [...current.memberIds, driver.customerId],
          },
    )
  return (
    <Section
      title="Teams"
      eyebrow="Team management"
      summary={`${teams.length} team${teams.length === 1 ? '' : 's'}`}
      {...control}
    >
      <div className="admin-team-workspace">
        <aside className="admin-team-sidebar" aria-label="GT teams">
          <div className="admin-team-sidebar__heading">
            <div>
              <p className="eyebrow">Season roster</p>
              <h3>Your teams</h3>
            </div>
            <span>{teams.length}</span>
          </div>
          <div className="admin-team-tabs">
        <button
          type="button"
          className={!teams.some((item) => item.id === team.id) ? 'is-active' : ''}
          onClick={() => setTeam(blank())}
        >
          + New team
        </button>
        {teams.map((item) => (
          <button
            type="button"
            className={team.id === item.id ? 'is-active' : ''}
            key={item.id}
            onClick={() => setTeam({ ...item })}
          >
            <strong>{item.name}</strong>
            <span>
              {gtClasses.find((entry) => entry.key === item.classKey)?.label} ·{' '}
              {item.memberNames.length} driver{item.memberNames.length === 1 ? '' : 's'}
            </span>
          </button>
        ))}
          </div>
          {!teams.length && <p className="admin-team-empty">No teams created yet.</p>}
        </aside>
        <div className="admin-team-editor">
          <div className="admin-team-editor__heading">
            <div>
              <p className="eyebrow">
                {teams.some((item) => item.id === team.id) ? 'Edit team' : 'New team'}
              </p>
              <h3>{team.name || 'Team details'}</h3>
            </div>
            <span>1. Details</span>
          </div>
      <div className="admin-form-grid admin-team-details">
        <label>
          Team name
          <input
            value={team.name}
            onChange={(event) => setTeam({ ...team, name: event.target.value })}
          />
        </label>
        <label>
          Class
          <select
            value={team.classKey}
            onChange={(event) => setTeam({ ...team, classKey: event.target.value as GtClassKey })}
          >
            {gtClasses.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Car
          <input
            value={team.car}
            onChange={(event) => setTeam({ ...team, car: event.target.value })}
          />
        </label>
      </div>
      <div className="admin-team-editor__heading admin-team-editor__heading--drivers">
        <div>
          <span>2. Drivers</span>
          <p>
        Select the drivers on this team. Saving applies the team name, class, and car to their
        roster assignments and existing results.
          </p>
        </div>
        <strong>{team.memberNames.length} selected</strong>
      </div>
      <label className="admin-team-search">
        Find drivers
        <input
          type="search"
          value={search}
          placeholder="Search by driver, car, or class"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="admin-team-selection">
        <div>
          {team.memberNames.map((name) => (
            <button
              type="button"
              key={name}
              aria-label={`Remove ${name} from team`}
              onClick={() => {
                const driver = drivers.find((item) => item.driver === name)
                if (driver) toggle(driver)
              }}
            >
              {name} ×
            </button>
          ))}
        </div>
        {!team.memberNames.length && <p>No drivers selected yet.</p>}
      </div>
      <div className="admin-team-toolbar">
        <label>
          <input
            type="checkbox"
            checked={showAllClasses}
            onChange={(event) => setShowAllClasses(event.target.checked)}
          />{' '}
          Show drivers from all classes
        </label>
        <span>{visible.length} available</span>
        <button
          type="button"
          onClick={() =>
            setTeam((current) => {
              const additions = visible.filter(
                (driver) => !current.memberNames.includes(driver.driver),
              )
              return {
                ...current,
                memberNames: [...current.memberNames, ...additions.map((driver) => driver.driver)],
                memberIds: [...current.memberIds, ...additions.map((driver) => driver.customerId)],
              }
            })
          }
        >
          Select visible
        </button>
        <button type="button" onClick={() => setTeam({ ...team, memberIds: [], memberNames: [] })}>
          Clear
        </button>
      </div>
      <div className="admin-team-picker">
        {visible.map((driver) => (
          <label
            className={selected(driver) ? 'is-selected' : ''}
            key={`${driver.customerId}:${driver.driver}`}
          >
            <input type="checkbox" checked={selected(driver)} onChange={() => toggle(driver)} />
            <span>
              <strong>{driver.driver}</strong>
              <small>
                {gtClasses.find((entry) => entry.key === driver.classKey)?.label} ·{' '}
                {driver.car || 'No car'}
              </small>
            </span>
          </label>
        ))}
        {!visible.length && <p className="admin-team-empty">No matching drivers.</p>}
      </div>
      <div className="admin-team-savebar">
        <div>
          <span>3. Save</span>
          <small>Saving updates roster assignments and existing results.</small>
        </div>
      <div className="admin-card__actions">
        <button
          className="button"
          type="button"
          disabled={!team.name || !team.memberNames.length}
          onClick={async () => {
            const savedTeam = {
              ...team,
              memberIds: team.memberNames.map(
                (name) => drivers.find((driver) => driver.driver === name)?.customerId ?? 0,
              ),
            }
            await mutateGtAdmin({ action: 'saveTeam', team: savedTeam })
            setTeam(blank())
            await refresh('GT team saved and team standings updated.')
          }}
        >
          {teams.some((item) => item.id === team.id) ? 'Save changes' : 'Create team'}
        </button>
        {teams.some((item) => item.id === team.id) && (
          <button type="button" onClick={() => setTeam(blank())}>
            Cancel edit
          </button>
        )}
        {teams.some((item) => item.id === team.id) && (
          <button
            type="button"
            className="admin-action--danger"
            onClick={async () => {
              if (!confirm(`Delete ${team.name}?`)) return
              await mutateGtAdmin({ action: 'deleteTeam', teamId: team.id })
              setTeam(blank())
              await refresh('GT team deleted.')
            }}
          >
            Delete team
          </button>
        )}
      </div>
      </div>
        </div>
      </div>
      <div className="admin-table-wrap admin-team-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Class</th>
              <th>Car</th>
              <th>Drivers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.length ? (
              teams.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{gtClasses.find((entry) => entry.key === row.classKey)?.label}</td>
                  <td>{row.car || '—'}</td>
                  <td>{row.memberNames.join(', ')}</td>
                  <td>
                    <button type="button" onClick={() => setTeam({ ...row })}>
                      Edit
                    </button>{' '}
                    <button
                      type="button"
                      className="admin-action--danger"
                      onClick={async () => {
                        if (!confirm(`Delete ${row.name}?`)) return
                        await mutateGtAdmin({ action: 'deleteTeam', teamId: row.id })
                        if (team.id === row.id) setTeam(blank())
                        await refresh('GT team deleted.')
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No teams created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function ScheduleEditor({
  state,
  seasonId,
  refresh,
  ...control
}: {
  state: GtAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & Control) {
  const rows = state.schedule
    .filter((item) => item.seasonId === seasonId)
    .sort((a, b) => a.round - b.round)
  const assignments = state.assignments.filter((item) => item.seasonId === seasonId)
  const blank = (): GtScheduledEvent => ({
    id: id(),
    seasonId,
    round: rows.length + 1,
    date: '',
    track: '',
    laps: 0,
    format: 'standard',
    status: 'scheduled',
  })
  const [event, setEvent] = useState(blank())
  const [viewId, setViewId] = useState('')
  const completed = rows.filter((item) => item.status === 'completed').length
  const standard = rows.filter((item) => item.format === 'standard').length
  const endurance = rows.filter((item) => item.format === 'endurance').length
  return (
    <Section
      title="Schedule"
      eyebrow="Calendar"
      summary={`${completed} completed · ${rows.length - completed} scheduled · ${standard} standard · ${endurance} endurance · ${rows.length} total`}
      {...control}
    >
      <div hidden>
        <h3>Season driver classes</h3>
        <p>Quickly adjust a saved driver class without leaving the schedule workflow.</p>
        {assignments.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Customer ID</th>
                  <th>GRR Class</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.customerId}>
                    <td>{assignment.driver}</td>
                    <td>{assignment.customerId}</td>
                    <td>
                      <select
                        aria-label={`Class for ${assignment.driver}`}
                        value={assignment.classKey}
                        onChange={async (event) => {
                          await mutateGtAdmin({
                            action: 'saveAssignment',
                            assignment: {
                              ...assignment,
                              classKey: event.target.value as GtClassKey,
                            },
                          })
                          await refresh(`${assignment.driver} class updated.`)
                        }}
                      >
                        {gtClasses.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{assignment.team || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-notice">
            No saved driver assignments yet. Add them in Driver Class Assignments or while importing
            a race.
          </p>
        )}
      </div>
      <h3>Race schedule</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Date</th>
              <th>Track</th>
              <th>Format</th>
              <th>Laps</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.round}</td>
                <td>{row.date}</td>
                <td>{row.track}</td>
                <td>
                  <select
                    aria-label={`Race format for round ${row.round}`}
                    value={row.format}
                    onChange={async (change) => {
                      await mutateGtAdmin({
                        action: 'saveEvent',
                        event: { ...row, format: change.target.value as GtRaceFormat },
                      })
                      await refresh(`Round ${row.round} format updated.`)
                    }}
                  >
                    <option value="standard">Standard</option>
                    <option value="endurance">Endurance</option>
                  </select>
                </td>
                <td>{row.laps}</td>
                <td>{row.status}</td>
                <td>
                  {state.results[row.id]?.length ? (
                    <>
                      <button type="button" onClick={() => setViewId(row.id)}>
                        Edit Race
                      </button>{' '}
                      <button
                        className="admin-action--danger"
                        type="button"
                        onClick={async () => {
                          if (!confirm('Delete these GT race results?')) return
                          await mutateGtAdmin({ action: 'deleteResults', eventId: row.id })
                          if (viewId === row.id) setViewId('')
                          await refresh('GT results deleted.')
                        }}
                      >
                        Delete Results
                      </button>{' '}
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Remove this event?')) return
                      await mutateGtAdmin({ action: 'deleteEvent', eventId: row.id })
                      await refresh('Event removed.')
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>{rows.some((row) => row.id === event.id) ? 'Edit event' : 'Add event'}</h3>
      <div className="admin-form-grid">
        <label>
          Round
          <input
            type="number"
            min="1"
            value={event.round}
            onChange={(e) => setEvent({ ...event, round: Number(e.target.value) })}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={event.date}
            onChange={(e) => setEvent({ ...event, date: e.target.value })}
          />
        </label>
        <label>
          Race format
          <select
            value={event.format}
            onChange={(e) => setEvent({ ...event, format: e.target.value as GtRaceFormat })}
          >
            <option value="standard">Standard</option>
            <option value="endurance">Endurance</option>
          </select>
        </label>
        <label>
          Track
          <input
            value={event.track}
            onChange={(e) => setEvent({ ...event, track: e.target.value })}
          />
        </label>
        <label>
          Laps
          <input
            type="number"
            min="1"
            value={event.laps || ''}
            onChange={(e) => setEvent({ ...event, laps: Number(e.target.value) })}
          />
        </label>
      </div>
      <button
        className="button"
        type="button"
        disabled={!event.date || !event.track || !event.laps}
        onClick={async () => {
          await mutateGtAdmin({ action: 'saveEvent', event })
          setEvent(blank())
          await refresh('GT schedule updated.')
        }}
      >
        Save event
      </button>
      {viewId && state.results[viewId]?.length ? (
        <RaceEditor
          event={rows.find((item) => item.id === viewId)!}
          rows={state.results[viewId]}
          refresh={refresh}
          close={() => setViewId('')}
        />
      ) : null}
    </Section>
  )
}

function RaceEditor({
  event,
  rows,
  refresh,
  close,
}: {
  event: GtScheduledEvent
  rows: GtManagedResult[]
  refresh: (message?: string) => Promise<void>
  close: () => void
}) {
  const [results, setResults] = useState(() =>
    [...rows].sort((left, right) => left.overallPosition - right.overallPosition),
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const move = (from: number, to: number) => {
    if (to < 0 || to >= results.length || from === to) return
    setResults((current) => {
      const reordered = [...current]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved)
      return reordered.map((row, index) => ({ ...row, overallPosition: index + 1 }))
    })
  }

  const save = async () => {
    setBusy(true)
    try {
      await mutateGtAdmin({ action: 'saveResults', eventId: event.id, results })
      await refresh('GT race order, class assignments, penalties, and points were updated.')
      close()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="admin-race-editor">
      <div className="admin-race-editor__heading">
        <h3>
          Edit Round {event.round}: {event.track}
        </h3>
        <button type="button" onClick={close}>
          Close
        </button>
      </div>
      <p>
        Drag drivers into overall finishing order, use the move buttons for keyboard control, and
        adjust class, team, or penalty values before rescoring. Each GT class is still positioned
        and scored independently.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table admin-results-editor">
          <thead>
            <tr>
              <th>Order</th>
              <th>Overall</th>
              <th>Driver</th>
              <th>Class</th>
              <th>Start</th>
              <th>Team</th>
              <th>Penalty</th>
              <th>Current total</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => (
              <tr
                key={row.id ?? row.customerId ?? row.driver}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(dragEvent) => dragEvent.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index)
                  setDragIndex(null)
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <td>
                  <span className="drag-handle" title="Drag to reorder" aria-hidden="true">
                    &#8597;
                  </span>
                  <button
                    type="button"
                    aria-label={`Move ${row.driver} up`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${row.driver} down`}
                    disabled={index === results.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    &darr;
                  </button>
                </td>
                <td>{index + 1}</td>
                <td>{row.driver}</td>
                <td>
                  <select
                    value={row.classKey}
                    onChange={(event) =>
                      setResults(
                        results.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, classKey: event.target.value as GtClassKey }
                            : item,
                        ),
                      )
                    }
                  >
                    {gtClasses.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{row.start}</td>
                <td>
                  <input
                    value={row.team}
                    onChange={(event) =>
                      setResults(
                        results.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, team: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={row.penalty}
                    onChange={(event) =>
                      setResults(
                        results.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, penalty: Math.max(0, Number(event.target.value) || 0) }
                            : item,
                        ),
                      )
                    }
                  />
                </td>
                <td>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="button"
        type="button"
        disabled={busy}
        onClick={save}
      >
        {busy ? 'Rescoring...' : 'Save & rescore race'}
      </button>
    </div>
  )
}

function Importer({
  state,
  seasonId,
  refresh,
  ...control
}: {
  state: GtAdminState
  seasonId: string
  refresh: (message?: string) => Promise<void>
} & Control) {
  const [preview, setPreview] = useState<GtImportPreview | null>(null)
  const [drivers, setDrivers] = useState<GtManagedResult[]>([])
  const [rawJson, setRawJson] = useState<unknown>(null)
  const [filename, setFilename] = useState('')
  const [eventId, setEventId] = useState('')
  const [viewId, setViewId] = useState('')
  const [source, setSource] = useState<ImportSource | null>(null)
  const events = state.schedule.filter((item) => item.seasonId === seasonId)
  const unassigned = drivers.filter((item) => !item.classKey).length
  const read = async (file?: File) => {
    if (!file) return
    const payload: unknown = JSON.parse(await file.text())
    const parsed = parseGtResultJson(payload)
    setRawJson(payload)
    setPreview(parsed)
    setFilename(file.name)
    setDrivers(
      parsed.drivers.map((driver) => {
        const assignment = state.assignments.find(
          (item) =>
            item.seasonId === seasonId &&
            ((driver.customerId && item.customerId === driver.customerId) ||
              gtDriverNamesMatch(item.driver, driver.driver)),
        )
        return {
          ...driver,
          classKey: assignment?.classKey ?? ('' as GtClassKey),
          classPosition: 0,
          team: assignment?.team ?? '',
          car: assignment?.car || driver.car,
          pole: false,
          fastestLap: false,
          racePoints: 0,
          bonus: 0,
          penalty: 0,
          total: 0,
        }
      }),
    )
  }
  return (
    <Section
      title="Import Race"
      eyebrow="Race control"
      summary={`${events.filter((item) => item.status === 'completed').length} published`}
      {...control}
    >
      <label className="json-drop">
        Race results JSON
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => void read(event.target.files?.[0])}
        />
      </label>
      {preview && (
        <div className="import-preview">
          <div className="import-preview__summary">
            <strong>
              {preview.track} · {drivers.length} drivers
            </strong>
            <label>
              Scheduled event
              <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="">Select event…</option>
                {events.map((item) => (
                  <option key={item.id} value={item.id}>
                    Round {item.round}: {item.track} — {item.date} ({item.format === 'endurance' ? 'Endurance' : 'Standard'})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {unassigned > 0 && (
            <p className="admin-notice admin-notice--error">
              Assign a GRR class to all {unassigned} unassigned driver{unassigned === 1 ? '' : 's'}{' '}
              before publishing.
            </p>
          )}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Overall</th>
                  <th>Driver</th>
                  <th>ID</th>
                  <th>GRR Class</th>
                  <th>Team</th>
                  <th>Car</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, index) => (
                  <tr key={driver.customerId ?? driver.driver}>
                    <td>{driver.overallPosition}</td>
                    <td>{driver.driver}</td>
                    <td>{driver.customerId ?? '—'}</td>
                    <td>
                      <select
                        value={driver.classKey}
                        onChange={(event) =>
                          setDrivers(
                            drivers.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, classKey: event.target.value as GtClassKey }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Assign class…</option>
                        {gtClasses.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={driver.team}
                        onChange={(event) =>
                          setDrivers(
                            drivers.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, team: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>{driver.car || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-card__actions">
            <button
              className="button button--secondary"
              type="button"
              disabled={!drivers.some((driver) => driver.customerId && driver.classKey)}
              onClick={async () => {
                const assignments = drivers
                  .filter((driver) => driver.customerId && driver.classKey)
                  .map((driver) => ({
                    seasonId,
                    customerId: driver.customerId!,
                    driver: driver.driver,
                    classKey: driver.classKey,
                    team: driver.team,
                    car: driver.car,
                  }))
                await mutateGtAdmin({ action: 'saveAssignments', assignments })
                await refresh(
                  `${assignments.length} class assignment${assignments.length === 1 ? '' : 's'} saved.`,
                )
              }}
            >
              Save Class Assignments
            </button>
            <button
              className="button"
              type="button"
              disabled={!eventId || unassigned > 0}
              onClick={async () => {
                await mutateGtAdmin({
                  action: 'publishResults',
                  seasonId,
                  eventId,
                  preview,
                  drivers,
                  rawJson,
                  filename,
                })
                setPreview(null)
                setDrivers([])
                setEventId('')
                await refresh('GT race published. All class standings were recalculated.')
              }}
            >
              Publish race results
            </button>
          </div>
        </div>
      )}
      <h3>Published races</h3>
      {events
        .filter((item) => item.status === 'completed')
        .map((item) => (
          <p key={item.id}>
            <strong>
              Round {item.round}: {item.track}
            </strong>{' '}
            <button type="button" onClick={() => setViewId(item.id)}>
              Edit Race
            </button>{' '}
            {state.imports.find((entry) => entry.eventId === item.id) ? <button type="button" onClick={async () => setSource(await loadGtImportSource(state.imports.find((entry) => entry.eventId === item.id)!, state))}>View Original JSON</button> : null}{' '}
            <button
              className="admin-action--danger"
              type="button"
              onClick={async () => {
                if (!confirm('Delete these GT race results?')) return
                await mutateGtAdmin({ action: 'deleteResults', eventId: item.id })
                await refresh('GT results deleted.')
              }}
            >
              Delete Results
            </button>
          </p>
        ))}
      {viewId && state.results[viewId]?.length ? (
        <RaceEditor
          event={events.find((item) => item.id === viewId)!}
          rows={state.results[viewId]}
          refresh={refresh}
          close={() => setViewId('')}
        />
      ) : null}
      {source ? <ImportSourceViewer source={source} close={() => setSource(null)} /> : null}
    </Section>
  )
}

const gtAdminTools: LeagueAdminTool[] = [
  { path: 'sporting-code', eyebrow: 'Published rules', title: 'Sporting Code', description: 'Edit, preview, publish, and restore the GT sporting code.' },
  { path: 'seasons', eyebrow: 'Season control', title: 'Seasons', description: 'Create seasons, choose the active season, and manage race timing.' },
  { path: 'assignments', eyebrow: 'Driver roster', title: 'Driver Assignments', description: 'Assign drivers to classes, teams, and cars.' },
  { path: 'teams', eyebrow: 'Team roster', title: 'Teams', description: 'Create teams and manage their class, car, and membership.' },
  { path: 'points', eyebrow: 'Scoring', title: 'Points', description: 'Configure standard and endurance race points and bonuses.' },
  { path: 'schedule', eyebrow: 'Calendar', title: 'Schedule', description: 'Create, reorder, update, and remove scheduled events.' },
  { path: 'results', eyebrow: 'Race control', title: 'Race Results', description: 'Import iRacing results, review classes, penalties, and scoring.' },
]

export function GtAdminPage() {
  const { tool } = useParams<{ tool?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<GtAdminState | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const refresh = async (message = '') => {
    try {
      setState(await loadGtAdmin())
      setNotice(message)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load GT administration.')
    }
  }
  useEffect(() => {
    let active = true
    loadGtAdmin()
      .then((next) => {
        if (active) setState(next)
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Could not load GT administration.')
      })
    return () => {
      active = false
    }
  }, [])
  const selectedSeason = useMemo(
    () => state?.seasons.find((item) => item.id === searchParams.get('season')) ?? state?.seasons.find((item) => item.status === 'active') ?? state?.seasons[0],
    [state, searchParams],
  )
  if (tool && !gtAdminTools.some((item) => item.path === tool)) return <Navigate to="/admin/gt" replace />
  if (!state)
    return (
      <section className="admin-dashboard">
        <div className="container">
          <p>Loading GT administration…</p>
          {error && <p className="admin-notice admin-notice--error">{error}</p>}
        </div>
      </section>
    )
  return (
    <section className="admin-dashboard">
      <div className="container">
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">Grassroots Racing Administration</p>
            <h1>Manage GT League</h1>
          </div>
          <Link className="button button--secondary" to="/admin">
            Dashboard
          </Link>
        </div>
        {state.seasons.length ? <div className="admin-season-context">
          <div><span>GT League</span><strong>{selectedSeason?.name}</strong>{selectedSeason ? <em>{selectedSeason.status}</em> : null}</div>
          <label>Season<select value={selectedSeason?.id ?? ''} onChange={(event) => setSearchParams({ season: event.target.value })}>{state.seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}</select></label>
        </div> : null}
        {!tool ? <p className="admin-dashboard__intro">Choose a management area. Each tool now has its own focused workspace.</p> : null}
        <LeagueAdminNav basePath="/admin/gt" leagueName="GT League" tools={gtAdminTools} activeTool={tool} />
        {notice && <p className="admin-notice admin-notice--success">{notice}</p>}
        {error && <p className="admin-notice admin-notice--error">{error}</p>}
        {!tool && selectedSeason ? <section className="admin-card admin-card--standalone"><header className="admin-card__standalone-heading"><small>Season overview</small><h2>{selectedSeason.name}</h2></header><div className="admin-season-metrics">
          <div><strong>{state.assignments.filter((item) => item.seasonId === selectedSeason.id).length}</strong><span>Drivers</span></div>
          <div><strong>{state.teams.filter((item) => item.seasonId === selectedSeason.id).length}</strong><span>Teams</span></div>
          <div><strong>{state.schedule.filter((event) => event.seasonId === selectedSeason.id).length}</strong><span>Scheduled races</span></div>
          <div><strong>{state.schedule.filter((event) => event.seasonId === selectedSeason.id && event.status === 'completed').length}</strong><span>Completed races</span></div>
        </div></section> : null}
        {tool === 'sporting-code' ? <SportingCodeAdmin league="gt" /> : null}
        {tool === 'seasons' ? <SeasonEditor key={selectedSeason?.id} state={state} seasonId={selectedSeason?.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'assignments' ? <AssignmentsEditor key={`assignments-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'teams' ? <TeamsEditor key={`teams-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'points' ? <PointsEditor key={`points-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'schedule' ? <ScheduleEditor key={`schedule-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {selectedSeason && tool === 'results' ? <Importer key={`results-${selectedSeason.id}`} state={state} seasonId={selectedSeason.id} refresh={refresh} standalone /> : null}
        {tool && tool !== 'seasons' && tool !== 'sporting-code' && !selectedSeason ? <p className="admin-notice">Create a season in <Link to="/admin/gt/seasons">Seasons</Link> before using this tool.</p> : null}
      </div>
    </section>
  )
}
