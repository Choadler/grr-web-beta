export type ScheduledRace = { round: number; date: string; track: string; type?: string; laps?: number }

export const cupSchedule: ScheduledRace[] = [
  { round: 0, date: '2026-02-16', track: 'Duels at Daytona', type: 'Exhibition' },
  ...[
    ['2026-02-18', 'Daytona 500'], ['2026-02-23', 'Atlanta'], ['2026-03-02', 'COTA'],
    ['2026-03-09', 'Phoenix'], ['2026-03-16', 'Las Vegas'], ['2026-03-23', 'Darlington'],
    ['2026-03-30', 'Martinsville'], ['2026-04-13', 'Bristol'], ['2026-04-20', 'Kansas'],
    ['2026-04-27', 'Winston 500 (Talladega)'], ['2026-05-04', 'Texas'], ['2026-05-11', 'Watkins Glen'],
    ['2026-05-18', 'Coke 600 (Charlotte)'], ['2026-06-01', 'Nashville'], ['2026-06-08', 'Michigan'],
    ['2026-06-15', 'Pocono'], ['2026-06-22', 'San Diego (?)'], ['2026-06-29', 'Sonoma'],
    ['2026-07-06', 'Chicagoland'], ['2026-07-13', 'Atlanta'], ['2026-07-20', 'North Wilkesboro'],
    ['2026-07-27', 'Brickyard 400'], ['2026-08-10', 'Iowa'], ['2026-08-17', 'Richmond'],
    ['2026-08-24', 'New Hampshire'], ['2026-08-31', 'Daytona'], ['2026-09-07', 'Southern 500 (Darlington)'],
    ['2026-09-14', 'Gateway'], ['2026-09-21', 'Bristol'], ['2026-09-28', 'Kansas'],
    ['2026-10-05', 'Las Vegas'], ['2026-10-12', 'Charlotte'], ['2026-10-19', 'Phoenix'],
    ['2026-10-26', 'Talladega'], ['2026-11-02', 'Martinsville'], ['2026-11-09', 'Homestead-Miami'],
  ].map(([date, track], index) => ({ round: index + 1, date, track, type: index >= 26 ? 'Chase' : 'Regular' })),
]

export const indycarSchedule: ScheduledRace[] = [
  { round: 1, date: '2026-08-02', track: 'Indianapolis', laps: 100 },
  { round: 2, date: '2026-08-09', track: 'Portland', laps: 47 },
  { round: 3, date: '2026-08-16', track: 'Montreal', laps: 33 },
  { round: 4, date: '2026-08-23', track: 'Long Beach', laps: 38 },
  { round: 5, date: '2026-08-30', track: 'Milwaukee Mile', laps: 150 },
  { round: 6, date: '2026-09-06', track: 'Laguna Seca', laps: 40 },
]
