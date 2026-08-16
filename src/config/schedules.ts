export type ScheduledRace = {
  round: number
  date: string
  track: string
  type?: string
  laps?: number
  resultId?: number
}

export const cupSchedule: ScheduledRace[] = [
  { round: 0, date: '2026-02-16', track: 'Duels at Daytona', type: 'Exhibition' },
  ...[
    ['2026-02-18', 'Daytona 500', 338891], ['2026-02-23', 'Atlanta', 338895], ['2026-03-02', 'COTA', 339640],
    ['2026-03-09', 'Phoenix', 350549], ['2026-03-16', 'Las Vegas', 342413], ['2026-03-23', 'Darlington', 350338],
    ['2026-03-30', 'Martinsville', 345483], ['2026-04-13', 'Bristol', 348420], ['2026-04-20', 'Kansas', 349989],
    ['2026-04-27', 'Winston 500 (Talladega)', 351471], ['2026-05-04', 'Texas', 353046], ['2026-05-11', 'Watkins Glen', 354570],
    ['2026-05-18', 'Coke 600 (Charlotte)', 356571], ['2026-06-01', 'Nashville', 358905], ['2026-06-08', 'Michigan', 360276],
    ['2026-06-15', 'Pocono', 361480], ['2026-06-22', 'San Diego (?)', 362674], ['2026-06-29', 'Sonoma', 363860],
    ['2026-07-06', 'Chicagoland', 364833], ['2026-07-13', 'Atlanta', 366510], ['2026-07-20', 'North Wilkesboro', 367945],
    ['2026-07-27', 'Brickyard 400', 369510], ['2026-08-10', 'Iowa', 372569], ['2026-08-17', 'Richmond'],
    ['2026-08-24', 'New Hampshire'], ['2026-08-31', 'Daytona'], ['2026-09-07', 'Southern 500 (Darlington)'],
    ['2026-09-14', 'Gateway'], ['2026-09-21', 'Bristol'], ['2026-09-28', 'Kansas'],
    ['2026-10-05', 'Las Vegas'], ['2026-10-12', 'Charlotte'], ['2026-10-19', 'Phoenix'],
    ['2026-10-26', 'Talladega'], ['2026-11-02', 'Martinsville'], ['2026-11-09', 'Homestead-Miami'],
  ].map(([date, track, resultId], index) => ({
    round: index + 1,
    date: String(date),
    track: String(track),
    type: index >= 26 ? 'Chase' : 'Regular',
    resultId: typeof resultId === 'number' ? resultId : undefined,
  })),
]

export const indycarSchedule: ScheduledRace[] = [
  { round: 1, date: '2026-08-02', track: 'Indianapolis', laps: 100 },
  { round: 2, date: '2026-08-09', track: 'Portland', laps: 47 },
  { round: 3, date: '2026-08-16', track: 'Montreal', laps: 33 },
  { round: 4, date: '2026-08-23', track: 'Long Beach', laps: 38 },
  { round: 5, date: '2026-08-30', track: 'Milwaukee Mile', laps: 150 },
  { round: 6, date: '2026-09-06', track: 'Laguna Seca', laps: 40 },
]
