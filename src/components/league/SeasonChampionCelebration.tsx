import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { SeasonChampionship } from '../../types/league'

const celebratedVisits = new Set<string>()

function useSeasonCelebration(championship?: SeasonChampionship) {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const celebrationKey = championship
    ? `${location.key}:${location.pathname}:${championship.seasonId}`
    : ''

  useEffect(() => {
    if (!championship?.isComplete || !championship.champions.length || !celebrationKey) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (celebratedVisits.has(celebrationKey)) return
    const start = window.setTimeout(() => {
      if (celebratedVisits.has(celebrationKey)) return
      celebratedVisits.add(celebrationKey)
      setVisible(true)
    }, 0)
    const timeout = window.setTimeout(() => setVisible(false), 4600)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(timeout)
    }
  }, [celebrationKey, championship])

  return visible
}

function ConfettiOverlay({ visible }: { visible: boolean }) {
  const pieces = useMemo(() => Array.from({ length: 72 }, (_, index) => ({
    id: index,
    left: (index * 37 + 11) % 101,
    delay: ((index * 29) % 110) / 100,
    duration: 2.7 + ((index * 17) % 16) / 10,
    drift: ((index * 47) % 180) - 90,
    rotation: 360 + ((index * 71) % 720),
  })), [])
  if (!visible) return null
  return <div className="champion-confetti" aria-hidden="true">
    {pieces.map((piece) => <i
      key={piece.id}
      className={`champion-confetti__piece champion-confetti__piece--${piece.id % 3}`}
      style={{
        '--confetti-left': `${piece.left}%`,
        '--confetti-delay': `${piece.delay}s`,
        '--confetti-duration': `${piece.duration}s`,
        '--confetti-drift': `${piece.drift}px`,
        '--confetti-rotation': `${piece.rotation}deg`,
      } as React.CSSProperties}
    />)}
  </div>
}

export function SeasonChampionCelebration({ championship }: { championship?: SeasonChampionship }) {
  const celebrate = useSeasonCelebration(championship)
  if (!championship?.isComplete || !championship.champions.length) return null
  const multiClass = championship.champions.length > 1
  return <>
    <section className={`champion-banner${multiClass ? ' champion-banner--multi' : ''}`} aria-labelledby="season-champions-title">
      <header className="champion-banner__heading">
        <p>{championship.seasonName}</p>
        <h2 id="season-champions-title">{multiClass ? 'Season Champions' : 'Season Champion'}</h2>
      </header>
      <div className="champion-banner__grid">
        {championship.champions.map((champion) => <article className="champion-card" key={champion.classKey ?? champion.label}>
          <span className="champion-card__trophy" aria-hidden="true">★</span>
          <div><span>{champion.label}</span><strong>{champion.driver}</strong></div>
        </article>)}
      </div>
    </section>
    <ConfettiOverlay visible={celebrate} />
  </>
}
