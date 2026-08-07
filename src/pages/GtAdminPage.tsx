import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { defaultGtPoints, gtClasses, loadGtAdmin, mutateGtAdmin } from '../services/gtAdmin'
import { parseGtResultJson } from '../services/gtImport'
import { gtDriverNamesMatch } from '../config/gtRoster'
import type {
  GtAdminState,
  GtClassKey,
  GtDriverAssignment,
  GtImportPreview,
  GtManagedResult,
  GtPointsConfig,
  GtScheduledEvent,
  GtSeason,
  GtTeam,
} from '../types/gtAdmin'

const id = () => crypto.randomUUID()
type Control = { open: boolean; onToggle: (open: boolean) => void }
function Section({
  title,
  eyebrow,
  summary,
  open,
  onToggle,
  children,
}: { title: string; eyebrow: string; summary?: string; children: React.ReactNode } & Control) {
  return (
    <details
      className="admin-card admin-card--collapsible"
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
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
})

function SeasonEditor({
  state,
  refresh,
  ...control
}: { state: GtAdminState; refresh: (message?: string) => Promise<void> } & Control) {
  const [season, setSeason] = useState(
    state.seasons.find((item) => item.status === 'active') ?? state.seasons[0] ?? newSeason(),
  )
  return (
    <Section title="GT League season" eyebrow="Season control" {...control}>
      {state.seasons.length > 0 && (
        <label>
          Season
          <select
            value={season.id}
            onChange={(event) =>
              setSeason(state.seasons.find((item) => item.id === event.target.value) ?? newSeason())
            }
          >
            {state.seasons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.status})
              </option>
            ))}
            <option value="">Create new season</option>
          </select>
        </label>
      )}
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
      <button
        className="button"
        type="button"
        onClick={async () => {
          await mutateGtAdmin({ action: 'saveSeason', season })
          await refresh('GT season saved.')
        }}
      >
        Save season
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
  const [classKey, setClassKey] = useState<GtClassKey>('gt3-am')
  const [config, setConfig] = useState<GtPointsConfig>(
    state.points[seasonId]?.[classKey] ?? structuredClone(defaultGtPoints),
  )
  return (
    <Section
      title="Class points tables"
      eyebrow="Scoring"
      summary="Independent points and bonuses for all 3 classes"
      {...control}
    >
      <label>
        Competition class
        <select
          value={classKey}
          onChange={(event) => {
            const next = event.target.value as GtClassKey
            setClassKey(next)
            setConfig(state.points[seasonId]?.[next] ?? structuredClone(defaultGtPoints))
          }}
        >
          {gtClasses.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
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
          await mutateGtAdmin({ action: 'savePoints', seasonId, classKey, points: config })
          await refresh(`${gtClasses.find((item) => item.key === classKey)?.label} points saved.`)
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
              {item.memberNames.length} drivers
            </span>
          </button>
        ))}
      </div>
      <div className="admin-form-grid">
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
        <label>
          Find drivers
          <input
            type="search"
            value={search}
            placeholder="Search roster"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <p>
        Select the drivers on this team. Saving applies the team name, class, and car to their
        roster assignments and existing results.
      </p>
      <div className="admin-team-selection">
        <strong>{team.memberNames.length} selected</strong>
        <div>
          {team.memberNames.map((name) => (
            <button
              type="button"
              key={name}
              onClick={() => {
                const driver = drivers.find((item) => item.driver === name)
                if (driver) toggle(driver)
              }}
            >
              {name} ×
            </button>
          ))}
        </div>
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
          <label key={`${driver.customerId}:${driver.driver}`}>
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
          Save team
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
    status: 'scheduled',
  })
  const [event, setEvent] = useState(blank())
  const [viewId, setViewId] = useState('')
  const completed = rows.filter((item) => item.status === 'completed').length
  return (
    <Section
      title="Schedule"
      eyebrow="Calendar"
      summary={`${completed} completed · ${rows.length - completed} scheduled · ${rows.length} total`}
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
  const [results, setResults] = useState(rows)
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
        Change a driver’s class, team, or penalty, then rescore. Class positions, poles, fastest
        laps, bonuses, and totals are recalculated.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Overall</th>
              <th>Driver</th>
              <th>Class</th>
              <th>Team</th>
              <th>Penalty</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => (
              <tr key={row.id ?? row.customerId ?? row.driver}>
                <td>{row.overallPosition}</td>
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
                            ? { ...item, penalty: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="button"
        type="button"
        onClick={async () => {
          await mutateGtAdmin({ action: 'saveResults', eventId: event.id, results })
          await refresh('GT race rescored.')
          close()
        }}
      >
        Save & rescore race
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
                    Round {item.round}: {item.track} — {item.date}
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
    </Section>
  )
}

export function GtAdminPage() {
  const [state, setState] = useState<GtAdminState | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState('season')
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
  const active = useMemo(
    () => state?.seasons.find((item) => item.status === 'active') ?? state?.seasons[0],
    [state],
  )
  const control = (name: string): Control => ({
    open: open === name,
    onToggle: (value) => setOpen(value ? name : (current) => (current === name ? '' : current)),
  })
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
        {notice && <p className="admin-notice admin-notice--success">{notice}</p>}
        {error && <p className="admin-notice admin-notice--error">{error}</p>}
        <SeasonEditor state={state} refresh={refresh} {...control('season')} />
        {active && (
          <>
            <AssignmentsEditor
              state={state}
              seasonId={active.id}
              refresh={refresh}
              {...control('assignments')}
            />
            <TeamsEditor
              state={state}
              seasonId={active.id}
              refresh={refresh}
              {...control('teams')}
            />
            <PointsEditor
              state={state}
              seasonId={active.id}
              refresh={refresh}
              {...control('points')}
            />
            <ScheduleEditor
              state={state}
              seasonId={active.id}
              refresh={refresh}
              {...control('schedule')}
            />
            <Importer state={state} seasonId={active.id} refresh={refresh} {...control('import')} />
          </>
        )}
      </div>
    </section>
  )
}
