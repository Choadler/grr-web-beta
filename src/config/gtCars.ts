export const gtCarNames = [
  'Acura GTP',
  'Aston Martin Vantage GT3 EVO',
  'Audi R8 LMS EVO II GT3',
  'BMW M4 GT3 EVO',
  'BMW GTP',
  'Cadillac V-Series.R GTP',
  'Chevrolet Corvette Z06 GT3.R',
  'Ferrari 296 GT3',
  'Ferrari 499P',
  'Ford Mustang GT3',
  'Lamborghini GT3',
  'McLaren 720S GT3 EVO',
  'Mercedes-AMG GT3 2020',
  'Porsche 911 GT3 R (992)',
  'Porsche 963 GTP',
] as const

const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const aliases: Record<string, (typeof gtCarNames)[number]> = {}
const add = (canonical: (typeof gtCarNames)[number], values: string[]) => {
  ;[canonical, ...values].forEach((value) => { aliases[key(value)] = canonical })
}

add('Acura GTP', [])
add('Aston Martin Vantage GT3 EVO', ['Aston GT3', 'Aston Martin GT3'])
add('Audi R8 LMS EVO II GT3', ['Audi GT3', 'Audi R8 GT3'])
add('BMW M4 GT3 EVO', ['BMW GT3', 'BMW M4 GT3'])
add('BMW GTP', [])
add('Cadillac V-Series.R GTP', ['Cadillac GTP', 'Cadillac V Series R GTP'])
add('Chevrolet Corvette Z06 GT3.R', ['Corvette GT3', 'Chevrolet Corvette GT3'])
add('Ferrari 296 GT3', ['Ferrari GT3'])
add('Ferrari 499P', ['Ferrari GTP'])
add('Ford Mustang GT3', ['Mustang GT3'])
add('Lamborghini GT3', ['Lambo GT3'])
add('McLaren 720S GT3 EVO', ['Mclaren GT3', 'McLaren GT3', 'McLaren 720S GT3'])
add('Mercedes-AMG GT3 2020', ['Mercedes GT3', 'Mercedes AMG GT3'])
add('Porsche 911 GT3 R (992)', ['Porsche GT3', 'Porsche 911 GT3 R'])
add('Porsche 963 GTP', ['Porsche GTP'])

export const canonicalGtCarName = (value: string) => aliases[key(value)] ?? value.trim().replace(/\s+/g, ' ')
