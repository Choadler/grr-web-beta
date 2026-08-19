import type { GtClassKey } from '../types/gtAdmin'
import { canonicalGtCarName } from './gtCars'

export type GtRosterEntry = { driver: string; car: string; classKey: GtClassKey }
export type GtTeamRosterEntry = {
  name: string
  classKey: GtClassKey
  car: string
  members: { driver: string; car: string }[]
}

const rows: [string, string, GtClassKey][] = [
  ['Blake Doyle', 'BMW GTP', 'gtp'],
  ['Jordan Carroll', 'BMW GTP', 'gtp'],
  ['Giancarlo Moneti Schliemann', 'Porsche GTP', 'gtp'],
  ['Colson Pelletier', 'BMW GT3', 'gt3-pro'],
  ['Alex Davenport', 'Mclaren GT3', 'gt3-pro'],
  ['Alex Jensen', 'Mustang GT3', 'gt3-pro'],
  ['Andrew J Lau', 'Mclaren GT3', 'gt3-pro'],
  ['Brad Wrenn', 'Mclaren GT3', 'gt3-pro'],
  ['Brandon Fergusson', 'Mustang GT3', 'gt3-pro'],
  ['Brandon White', 'Corvette GT3', 'gt3-pro'],
  ['Brendin Campbell', 'Mustang GT3', 'gt3-pro'],
  ['Brett Guitard', 'Mustang GT3', 'gt3-pro'],
  ['Corey Godwin', 'Lambo GT3', 'gt3-am'],
  ['Armando Hoare', 'Mercedes GT3', 'gt3-am'],
  ['Jeff Johnson', 'Mclaren GT3', 'gt3-am'],
  ['Marwan Moftah', 'Corvette GT3', 'gt3-am'],
  ['Julian Flores', 'Aston GT3', 'gt3-am'],
  ['Charles Edward', 'Aston GT3', 'gt3-am'],
  ['Logan Mullins', 'Ferrari GT3', 'gt3-am'],
  ['Justin Marino', 'Ferrari GT3', 'gt3-am'],
  ['Connor Burns', 'Corvette GT3', 'gt3-pro'],
  ['Daniel Haines', 'Mercedes GT3', 'gt3-pro'],
  ['Lucas De Abreu', 'Cadillac GTP', 'gtp'],
  ['Blake Patterson', 'Mclaren GT3', 'gt3-am'],
  ['Dex Lindgren', 'Porsche GT3', 'gt3-pro'],
  ['Gage Hyams', 'Mercedes GT3', 'gt3-pro'],
  ['Jacob Jung', 'Porsche GTP', 'gtp'],
  ['Jeff Kaufhold', 'Mercedes GT3', 'gt3-pro'],
  ['Joe Albanese', 'Mustang GT3', 'gt3-pro'],
  ['Karl Behrens', 'Mercedes GT3', 'gt3-pro'],
  ['Brandon Lambert', 'Cadillac GTP', 'gtp'],
  ['Nick Russell', 'Porsche GTP', 'gtp'],
  ['George Eng', 'BMW GTP', 'gtp'],
  ['Christian Youngwall', 'BMW GT3', 'gt3-pro'],
  ['Kevin Fanning', 'Corvette GT3', 'gt3-pro'],
  ['Kyle Chung', 'Corvette GT3', 'gt3-pro'],
  ['Matt Benson', 'Mercedes GT3', 'gt3-pro'],
  ['Matt Gauthier', 'Mustang GT3', 'gt3-pro'],
  ['Rodrigo Ziminov', 'Mclaren GT3', 'gt3-pro'],
  ['Scott Lindgren', 'Porsche GT3', 'gt3-pro'],
  ['Tanner Prater', 'Porsche GTP', 'gtp'],
  ['Manuel Rodriguez', 'BMW GT3', 'gt3-am'],
  ['Jeff Peat', 'Mustang GT3', 'gt3-am'],
  ['Daniel Coletta', 'Ferrari GT3', 'gt3-am'],
  ['Taylor Mahon', 'Mustang GT3', 'gt3-pro'],
  ['Nathaniel Campbell', 'Ferrari GT3', 'gt3-am'],
  ['Thomas Craig', 'Mclaren GT3', 'gt3-am'],
  ['Joshua Pridgeon', 'Mercedes GT3', 'gt3-am'],
  ['Tucker Lindgren', 'Porsche GT3', 'gt3-pro'],
  ['Marc Henley', 'Mclaren GT3', 'gt3-am'],
  ['Anthony Flores', 'Cadillac GTP', 'gtp'],
  ['Nathan Palmer', 'BMW GTP', 'gtp'],
  ['John Marjoribanks', 'Cadillac GTP', 'gtp'],
  ['Tyler Gischel', 'Mercedes GT3', 'gt3-pro'],
  ['Tyler Manawes', 'Corvette GT3', 'gt3-pro'],
  ['Lucas Davenport', 'Mclaren GT3', 'gt3-am'],
  ['Colin Aldino', 'Porsche GT3', 'gt3-am'],
  ['Brian Smith', 'Mclaren GT3', 'gt3-am'],
  ['Richard Myers', 'Cadillac GTP', 'gtp'],
  ['Will Weaver', 'Mclaren GT3', 'gt3-pro'],
  ['William Westbrook', 'Mclaren GT3', 'gt3-pro'],
  ['Zachary Brooker', 'Mercedes GT3', 'gt3-pro'],
  ['Zachary Kress', 'Mclaren GT3', 'gt3-pro'],
  ['Reyson Pimentel', 'Cadillac GTP', 'gtp'],
  ['Ryan McLean', 'Mclaren GT3', 'gt3-am'],
  ['Dave Peterson', 'Acura GTP', 'gtp'],
  ['Zac Meritt-Misale', 'Corvette GT3', 'gt3-am'],
  ['Rene Cota Sandoval', 'Cadillac GTP', 'gtp'],
  ['Peter Dunn', 'Aston GT3', 'gt3-pro'],
  ['Mark A Nelson', 'Porsche GT3', 'gt3-am'],
  ['Michael Davis', 'Porsche GT3', 'gt3-am'],
  ['Rakim Lewis', 'Mclaren GT3', 'gt3-am'],
  ['Cason Collyar', 'Porsche GTP', 'gtp'],
  ['Blake Vandegrift', 'Mercedes GT3', 'gt3-am'],
  ['Abdelkader Berraho', 'Porsche GT3', 'gt3-pro'],
  ['Nate Brooker', 'Audi GT3', 'gt3-pro'],
  ['Jed Cotterman', 'Mclaren GT3', 'gt3-am'],
  ['Nicolas Bill', 'BMW GTP', 'gtp'],
  ['Jeffrey Lawler', 'Ferrari GTP', 'gtp'],
  ['Michael Deitch', 'Cadillac GTP', 'gtp'],
  ['Thomas Beyersdorf', 'Mustang GT3', 'gt3-am'],
  ['David Beyersdorf', 'Mustang GT3', 'gt3-am'],
  ['William Rasmussen', 'Ferrari GT3', 'gt3-pro'],
  ['Haden Higginbotham', 'Mustang GT3', 'gt3-am'],
  ['Cody Crosgrove', 'Porsche GT3', 'gt3-pro'],
]

const teamRows: [string, GtClassKey, string, string][] = [
  ['1UP Racing', 'gt3-am', 'Aston GT3', 'Charles Edward'],
  ['1UP Racing', 'gt3-am', 'Aston GT3', 'Julian Flores'],
  ['Bad Math Simsports PRO', 'gt3-pro', 'Mercedes GT3', 'Tyler Gischel'],
  ['Bad Math Simsports PRO', 'gt3-pro', 'Mclaren GT3', 'Zachary Kress'],
  ['Bad Math Sometimes', 'gt3-pro', 'Mustang GT3', 'Alex Jensen'],
  ['Bad Math Sometimes', 'gt3-pro', 'Mercedes GT3', 'Zachary Brooker'],
  ['Bearcat Motorsports', 'gt3-am', 'Mustang GT3', 'Corey Knoedler'],
  ['Bearcat Motorsports', 'gt3-am', 'Mustang GT3', 'Gordon Bleu'],
  ['FG Performance', 'gtp', 'Cadillac GTP', 'Dylan Goudy'],
  ['FG Performance', 'gtp', 'Cadillac GTP', 'Riccardo Ferracin'],
  ['Fiorentina Wands Powered by Hitachi(TM)', 'gtp', 'Porsche GTP', 'Giancarlo Moneti Schliemann'],
  ['Fiorentina Wands Powered by Hitachi(TM)', 'gtp', 'Porsche GTP', 'Tanner Prater'],
  ['Freedom Express', 'gt3-pro', 'Corvette GT3', 'Brandon Hansen'],
  ['Grass Roots Goons', 'gtp', 'BMW GTP', 'Blake Doyle'],
  ['Grass Roots Goons', 'gtp', 'BMW GTP', 'Jordan Carroll'],
  ['Jung', 'gtp', 'Porsche GTP', 'Jacob Jung'],
  ['Limetree Racing', 'gt3-pro', 'Porsche GT3', 'Scott Lindgren'],
  ['Limetree Racing', 'gt3-pro', 'Porsche GT3', 'Tucker Lindgren'],
  ['Red River Racing', 'gt3-pro', 'Corvette GT3', 'Brandon White'],
  ['Red River Racing', 'gt3-pro', 'Corvette GT3', 'Tyler Manawes'],
  ['Roadsport Performance Black', 'gt3-pro', 'Mustang GT3', 'Brandon Fergusson'],
  ['Roadsport Performance Black', 'gt3-pro', 'Mustang GT3', 'Brendin Campbell'],
  ['Roadsport Performance Red', 'gt3-pro', 'Mustang GT3', 'Matt Gauthier'],
  ['Roadsport Performance Red', 'gt3-pro', 'Mustang GT3', 'Taylor Mahon'],
  ['Silverback Racing GTP', 'gtp', 'Cadillac GTP', 'Anthony Flores'],
  ['Silverback Racing GTP', 'gtp', 'Cadillac GTP', 'Brandon Lambert'],
  ['Swift Motorsports GTP', 'gtp', 'Cadillac GTP', 'Lucas De Abreu'],
  ['Swift Motorsports GTP', 'gtp', 'Cadillac GTP', 'Reyson Pimentel'],
  ['Tingeltangel-Bob', 'gt3-pro', 'Mustang GT3', 'Andy Pratt'],
  ['Tingeltangel-Bob', 'gt3-pro', 'Corvette GT3', 'Phillip Gruessing'],
  ['Will Squared Racing', 'gt3-pro', 'Mclaren GT3', 'Will Weaver'],
  ['Will Squared Racing', 'gt3-pro', 'Mclaren GT3', 'William Westbrook'],
]

const baseRoster: GtRosterEntry[] = rows.map(([driver, car, classKey]) => ({
  driver,
  car: canonicalGtCarName(car),
  classKey,
}))

teamRows.forEach(([, classKey, car, driver]) => {
  if (!baseRoster.some((entry) => gtDriverNamesMatch(entry.driver, driver)))
    baseRoster.push({ driver, car: canonicalGtCarName(car), classKey })
})

export const gtRoster = baseRoster

export const gtTeamRoster: GtTeamRosterEntry[] = [...new Set(teamRows.map(([name]) => name))].map(
  (name) => {
    const members = teamRows.filter(([team]) => team === name)
    const cars = [...new Set(members.map(([, , car]) => canonicalGtCarName(car)))]
    return {
      name,
      classKey: members[0][1],
      car: cars.length === 1 ? cars[0] : '',
      members: members.map(([, , car, driver]) => ({ driver, car: canonicalGtCarName(car) })),
    }
  },
)

export function normalizeGtDriverName(name: string) {
  const tokens = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\d+\s*$/, '')
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/[-']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return tokens
    .filter((token, index) => token.length > 1 || index === 0 || index === tokens.length - 1)
    .join(' ')
}

export function gtDriverNamesMatch(left: string, right: string) {
  const a = normalizeGtDriverName(left)
  const b = normalizeGtDriverName(right)
  if (a === b) return true
  const aa = a.split(' ')
  const bb = b.split(' ')
  return aa.length > 1 && bb.length > 1 && aa[0] === bb[0] && aa.at(-1) === bb.at(-1)
}
