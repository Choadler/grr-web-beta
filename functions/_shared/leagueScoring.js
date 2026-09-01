const finiteNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const identity = (driver) => {
  const customerId = finiteNumber(driver.customerId)
  return customerId > 0
    ? `id:${customerId}`
    : `name:${String(driver.driver || '').trim().toLowerCase()}`
}

export const validateScoringDrivers = (drivers, { requireClass = false, classes = [] } = {}) => {
  if (!Array.isArray(drivers) || !drivers.length) throw new Error('No normalized race results were supplied.')
  const seen = new Set()
  for (const driver of drivers) {
    if (!String(driver?.driver || '').trim()) throw new Error('Every result row must include a driver name.')
    if (requireClass && !classes.includes(driver.classKey)) throw new Error('Every driver must have a valid GRR class.')
    const position = finiteNumber(requireClass ? driver.overallPosition : driver.position, NaN)
    if (!Number.isInteger(position) || position < 1) throw new Error('Every result row must have a positive integer finish position.')
    const key = identity(driver)
    if (seen.has(key)) throw new Error(`Duplicate result row for ${driver.driver}.`)
    seen.add(key)
  }
}

export const scoreIndyRows = (drivers, config) => {
  validateScoringDrivers(drivers)
  if (!config || !Array.isArray(config.positions)) throw new Error('Save a points table before scoring results.')
  const mostLapsLed = Math.max(0, ...drivers.map((driver) => finiteNumber(driver.lapsLed)))
  const mostLapsLedWinner = drivers
    .filter((driver) => mostLapsLed > 0 && finiteNumber(driver.lapsLed) === mostLapsLed)
    .sort((a, b) => finiteNumber(a.position) - finiteNumber(b.position))[0]
  return drivers.map((driver) => {
    const position = finiteNumber(driver.position)
    const racePoints = finiteNumber(config.positions.find((rule) => finiteNumber(rule.position) === position)?.points)
    const bonus =
      (finiteNumber(driver.start) === 1 ? finiteNumber(config.poleBonus) : 0) +
      (finiteNumber(driver.lapsLed) > 0 ? finiteNumber(config.lapLedBonus) : 0) +
      (driver === mostLapsLedWinner ? finiteNumber(config.mostLapsLedBonus) : 0)
    const penalty = Math.max(0, finiteNumber(driver.penalty))
    return { ...driver, position, racePoints, bonus, penalty, total: racePoints + bonus - penalty }
  })
}

export const scoreGtRows = (drivers, config, classes) => {
  validateScoringDrivers(drivers, { requireClass: true, classes })
  if (!config || !Array.isArray(config.positions)) throw new Error('Save the selected race format points table before publishing.')
  const output = []
  for (const classKey of classes) {
    const rows = drivers
      .filter((driver) => driver.classKey === classKey)
      .sort((a, b) => finiteNumber(a.overallPosition) - finiteNumber(b.overallPosition))
    if (!rows.length) continue
    const poleStart = Math.min(...rows.map((row) => finiteNumber(row.start, 9999) || 9999))
    const fastestDriver = rows
      .filter((row) => finiteNumber(row.bestLapTime) > 0)
      .sort((a, b) => finiteNumber(a.bestLapTime) - finiteNumber(b.bestLapTime) || finiteNumber(a.overallPosition) - finiteNumber(b.overallPosition))[0]
    const mostLed = Math.max(0, ...rows.map((row) => finiteNumber(row.lapsLed)))
    const mostLedWinner = rows.find((row) => mostLed > 0 && finiteNumber(row.lapsLed) === mostLed)
    rows.forEach((driver, index) => {
      const classPosition = index + 1
      const pole = finiteNumber(driver.start) === poleStart
      const fastestLap = driver === fastestDriver
      const racePoints = finiteNumber(config.positions.find((rule) => finiteNumber(rule.position) === classPosition)?.points)
      const bonus =
        (pole ? finiteNumber(config.poleBonus) : 0) +
        (fastestLap ? finiteNumber(config.fastestLapBonus) : 0) +
        (finiteNumber(driver.lapsLed) > 0 ? finiteNumber(config.lapLedBonus) : 0) +
        (driver === mostLedWinner ? finiteNumber(config.mostLapsLedBonus) : 0)
      const penalty = Math.max(0, finiteNumber(driver.penalty))
      output.push({ ...driver, classPosition, pole, fastestLap, racePoints, bonus, penalty, total: racePoints + bonus - penalty })
    })
  }
  return output
}

export const compareGtStandings = (a, b) =>
  b.points - a.points ||
  b.wins - a.wins ||
  b.secondPlaces - a.secondPlaces ||
  b.poles - a.poles ||
  a.finalRaceFinish - b.finalRaceFinish ||
  String(a.driver).localeCompare(String(b.driver))

export const compareIndyStandings = (a, b) => {
  const points = finiteNumber(b.points) - finiteNumber(a.points)
  if (points) return points
  const maxFinish = Math.max(a.finishCounts?.length || 0, b.finishCounts?.length || 0)
  for (let position = 1; position < maxFinish; position += 1) {
    const difference = finiteNumber(b.finishCounts?.[position]) - finiteNumber(a.finishCounts?.[position])
    if (difference) return difference
  }
  return finiteNumber(a.previousEventFinish, Number.POSITIVE_INFINITY) - finiteNumber(b.previousEventFinish, Number.POSITIVE_INFINITY)
}
