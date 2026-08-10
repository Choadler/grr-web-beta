const aliases = new Map([
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

export const canonicalGtTrackName = (value) => {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ')
  return aliases.get(name.toLowerCase()) ?? name
}
