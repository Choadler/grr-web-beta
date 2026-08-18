export type CupStatRace = { driverId: number; driver: string; seasonId: string; finish: number | null; start: number | null; laps: number | null; led: number | null; incidents: number | null; points: number | null; pole?: boolean; stageWins?: number | null }

export function aggregateCupCareers(rows: CupStatRace[]) {
  const drivers = new Map<number, CupStatRace[]>()
  rows.forEach((row) => drivers.set(row.driverId, [...(drivers.get(row.driverId) ?? []), row]))
  return [...drivers.entries()].map(([driverId, races]) => {
    const knownFinishes = races.filter((race) => race.finish !== null)
    const knownStarts = races.filter((race) => race.start !== null)
    return {
      driverKey: `id:${driverId}`, driver: races.at(-1)?.driver ?? '', seasons: new Set(races.map((race) => race.seasonId)).size,
      starts: races.length, wins: races.filter((race) => race.finish === 1).length,
      top5: races.filter((race) => race.finish !== null && race.finish <= 5).length,
      top10: races.filter((race) => race.finish !== null && race.finish <= 10).length,
      poles: races.filter((race) => race.pole || race.start === 1).length,
      stageWins: races.reduce((sum, race) => sum + (race.stageWins ?? 0), 0),
      laps: races.reduce((sum, race) => sum + (race.laps ?? 0), 0), lapsLed: races.reduce((sum, race) => sum + (race.led ?? 0), 0),
      incidents: races.reduce((sum, race) => sum + (race.incidents ?? 0), 0), points: races.reduce((sum, race) => sum + (race.points ?? 0), 0),
      averageStart: knownStarts.length ? Number((knownStarts.reduce((sum, race) => sum + race.start!, 0) / knownStarts.length).toFixed(2)) : null,
      averageFinish: knownFinishes.length ? Number((knownFinishes.reduce((sum, race) => sum + race.finish!, 0) / knownFinishes.length).toFixed(2)) : null,
      bestFinish: knownFinishes.length ? Math.min(...knownFinishes.map((race) => race.finish!)) : null,
    }
  })
}
