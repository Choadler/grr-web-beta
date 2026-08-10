const gtTrackAliases = new Map<string, string>([
  ['algarve', 'Algarve International Circuit'],
  ['imola', 'Autodromo Internazionale Enzo e Dino Ferrari'],
  ['monza', 'Autodromo Nazionale Monza'],
  ['ctmp', 'Canadian Tire Motorsports Park'],
  ['spa', 'Circuit de Spa-Francorchamps'],
  ['le mans', 'Circuit des 24 Heures du Mans'],
  ['daytona', 'Daytona International Speedway'],
  ['sebring', 'Sebring International Raceway'],
  ['vir', 'Virginia International Raceway'],
  ['watkins glen', 'Watkins Glen International'],
])

export function canonicalGtTrackName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ')
  return gtTrackAliases.get(name.toLowerCase()) ?? name
}
