import type { RaceEvent, RaceSession, TableRow } from '../types/league'

export type CertificateLeague = 'cup' | 'gt' | 'indycar'

type CertificateWinner = {
  driver: string
  className: string
}

type CertificateDetails = {
  league: CertificateLeague
  leagueName: string
  season: string
  track: string
  date: string
  winners: CertificateWinner[]
}

const certificateAssets = {
  cup: '/assets/certificates/grr-cup-series-logo.png',
  gt: '/assets/certificates/grr-gt-logo.png',
  indycar: '/assets/certificates/grr-indycar-logo.png',
} satisfies Record<CertificateLeague, string>

const leagueNames = {
  cup: 'GRR Cup Series',
  gt: 'GRR GT League',
  indycar: 'GRR IndyCar League',
} satisfies Record<CertificateLeague, string>

const safeName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim()

function formatCertificateDate(value: string) {
  const cleaned = cleanText(value)
  const isoDate = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!isoDate) return cleaned
  const [, year, month, day] = isoDate
  const monthName = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][Number(month) - 1]
  return monthName ? `${monthName} ${Number(day)}, ${year}` : cleaned
}

function eventParts(event: RaceEvent) {
  const separators = [...event.label.matchAll(/\s+[—–]\s+/g)]
  const separator = separators.at(-1) ?? event.label.match(/\s+-\s+(?=\d{4}-\d{2}-\d{2})/)
  if (!separator || separator.index === undefined) {
    return { track: event.track || event.label, date: event.date || '' }
  }
  return {
    track: event.track || event.label.slice(0, separator.index),
    date: event.date || event.label.slice(separator.index + separator[0].length),
  }
}

const isWinner = (row: TableRow) => Number(row.podiumPosition ?? row.position) === 1

export function certificateWinners(
  league: CertificateLeague,
  event: RaceEvent,
  session: RaceSession,
) {
  if (league !== 'gt' && session !== event.sessions[0]) return []
  if (league === 'gt' && session.label === 'Overall') {
    const winners = new Map<string, CertificateWinner>()
    session.rows.filter(isWinner).forEach((row) => {
      const className = String(row.class || 'Overall')
      winners.set(className, { driver: String(row.driver || ''), className })
    })
    return [...winners.values()].filter((winner) => winner.driver)
  }
  if (league === 'gt') {
    const winner = session.rows.find((row) => Number(row.position) === 1)
    return winner?.driver ? [{ driver: String(winner.driver), className: session.label }] : []
  }
  const winner = session.rows.find((row) => Number(row.position) === 1)
  return winner?.driver ? [{ driver: String(winner.driver), className: 'Overall' }] : []
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Certificate artwork could not be loaded: ${src}`))
    image.src = src
  })
}

function drawContained(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const renderedWidth = sourceWidth * scale
  const renderedHeight = sourceHeight * scale
  context.drawImage(image, x + (width - renderedWidth) / 2, y + (height - renderedHeight) / 2, renderedWidth, renderedHeight)
}

function signatureCrop(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return { image, x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let left = canvas.width
  let top = canvas.height
  let right = 0
  let bottom = 0
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const offset = (y * canvas.width + x) * 4
      const alpha = pixels[offset + 3]
      const brightness = (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3
      if (alpha > 20 && brightness < 235) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
  }
  if (right <= left || bottom <= top)
    return { image, x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  return {
    image,
    x: Math.max(0, left - 20),
    y: Math.max(0, top - 20),
    width: Math.min(canvas.width - left, right - left + 40),
    height: Math.min(canvas.height - top, bottom - top + 40),
  }
}

function drawSignature(
  context: CanvasRenderingContext2D,
  crop: ReturnType<typeof signatureCrop>,
  centerX: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / crop.width, maxHeight / crop.height)
  const width = crop.width * scale
  const height = crop.height * scale
  context.drawImage(
    crop.image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    centerX - width / 2,
    y,
    width,
    height,
  )
}

function fitFont(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  start: number,
  minimum = 42,
  weight = 900,
) {
  let size = start
  while (size > minimum) {
    context.font = `${weight} ${size}px Arial, sans-serif`
    if (context.measureText(value).width <= maxWidth) return
    size -= 2
  }
  context.font = `${weight} ${minimum}px Arial, sans-serif`
}

async function renderCertificate(details: CertificateDetails, winner: CertificateWinner) {
  const [leagueLogo, grrLogo, raceWinSticker, coreySignature, blakeSignature] = await Promise.all([
    loadImage(certificateAssets[details.league]),
    loadImage('/assets/branding/grr-logo.webp'),
    loadImage('/assets/certificates/race-win-sticker.png'),
    loadImage('/assets/certificates/corey-knoedler-signature.png'),
    loadImage('/assets/certificates/blake-doyle-signature.png'),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = 1650
  canvas.height = 1275
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not supported in this browser.')

  const gold = '#b59643'
  const deepGold = '#8f7126'
  const green = '#2fb900'
  const charcoal = '#0b100d'
  const ivory = '#f8f5ea'

  context.fillStyle = ivory
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = charcoal
  context.fillRect(0, 0, canvas.width, 176)
  context.fillStyle = green
  context.fillRect(0, 176, canvas.width, 18)
  context.fillRect(0, 1205, canvas.width, 70)
  context.fillStyle = gold
  context.fillRect(0, 194, canvas.width, 7)
  context.strokeStyle = charcoal
  context.lineWidth = 10
  context.strokeRect(32, 32, canvas.width - 64, canvas.height - 64)
  context.strokeStyle = gold
  context.lineWidth = 4
  context.strokeRect(47, 47, canvas.width - 94, canvas.height - 94)
  context.strokeStyle = green
  context.lineWidth = 2
  context.strokeRect(57, 57, canvas.width - 114, canvas.height - 114)

  // Formal corner flourishes keep the certificate ceremonial without losing GRR's squared style.
  context.strokeStyle = gold
  context.lineWidth = 5
  ;[[78, 225, 1, 1], [1572, 225, -1, 1], [78, 1170, 1, -1], [1572, 1170, -1, -1]].forEach(
    ([x, y, xDirection, yDirection]) => {
      context.beginPath()
      context.moveTo(x, y + 54 * yDirection)
      context.lineTo(x, y)
      context.lineTo(x + 54 * xDirection, y)
      context.stroke()
    },
  )

  context.save()
  context.globalAlpha = 0.035
  drawContained(context, grrLogo, grrLogo.naturalWidth, grrLogo.naturalHeight, 390, 250, 870, 650)
  context.restore()

  const grrCrop = signatureCrop(grrLogo)
  drawContained(context, leagueLogo, leagueLogo.naturalWidth, leagueLogo.naturalHeight, 72, 66, 280, 96)
  drawSignature(context, grrCrop, 1438, 58, 280, 92)

  context.textAlign = 'center'
  context.fillStyle = deepGold
  context.font = '700 23px Georgia, serif'
  context.fillText('OFFICIAL GRASSROOTS RACING', 825, 255)
  context.fillStyle = '#445047'
  context.font = 'italic 28px Georgia, serif'
  context.fillText('Certificate of Achievement', 825, 302)
  context.fillStyle = '#121713'
  context.font = '900 72px Georgia, serif'
  context.fillText('RACE WINNER', 825, 382)
  context.strokeStyle = gold
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(360, 405)
  context.lineTo(650, 405)
  context.moveTo(1000, 405)
  context.lineTo(1290, 405)
  context.stroke()
  context.fillStyle = '#445047'
  context.font = 'italic 24px Georgia, serif'
  context.fillText('Presented to', 825, 432)

  const winnerName = cleanText(winner.driver).toUpperCase()
  context.fillStyle = '#159b00'
  fitFont(context, winnerName, 1370, 104, 46)
  context.fillText(winnerName, 825, 535)

  const className = cleanText(winner.className)
  const detailClass = className === 'Overall' ? 'OVERALL RACE WINNER' : `${className.toUpperCase()} CLASS WINNER`
  const track = cleanText(details.track)
  const date = formatCertificateDate(details.date)
  const eventLine = date ? `${track} - ${date}` : track
  context.fillStyle = '#121713'
  fitFont(context, eventLine, 1200, 34, 20, 700)
  context.fillText(eventLine, 825, 610)
  const seasonName = cleanText(details.season)
  if (seasonName) {
    context.fillStyle = '#39443c'
    fitFont(context, seasonName.toUpperCase(), 900, 30, 20, 400)
    context.fillText(seasonName.toUpperCase(), 825, 660)
  }
  context.fillStyle = deepGold
  fitFont(context, detailClass, 900, 24, 16, 700)
  context.fillText(detailClass, 825, 705)

  const coreyCrop = signatureCrop(coreySignature)
  const blakeCrop = signatureCrop(blakeSignature)
  const stickerCrop = signatureCrop(raceWinSticker)
  drawSignature(context, coreyCrop, 480, 820, 400, 140)
  drawSignature(context, blakeCrop, 1170, 820, 400, 140)
  drawSignature(context, stickerCrop, 825, 805, 160, 150)
  context.strokeStyle = '#374239'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(250, 970)
  context.lineTo(710, 970)
  context.moveTo(940, 970)
  context.lineTo(1400, 970)
  context.stroke()
  context.fillStyle = '#121713'
  context.font = '800 21px Arial, sans-serif'
  context.fillText('Corey Knoedler', 480, 1004)
  context.fillText('Blake Doyle', 1170, 1004)
  context.fillStyle = '#536057'
  context.font = '18px Arial, sans-serif'
  context.fillText('GRR League Administrator', 480, 1034)
  context.fillText('GRR League Administrator', 1170, 1034)

  context.fillStyle = '#081006'
  context.font = '800 17px Arial, sans-serif'
  context.fillText('GRASSROOTSRACING.ORG', 825, 1225)

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error('The certificate PDF could not be rendered.')),
      'image/jpeg',
      0.94,
    ),
  )
  return new Uint8Array(await blob.arrayBuffer())
}

function pdfFromJpegs(images: Uint8Array[]) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  let offset = 0
  const offsets: number[] = [0]
  const append = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value
    chunks.push(bytes)
    offset += bytes.length
  }
  const object = (id: number, body: string | Uint8Array, suffix = '') => {
    offsets[id] = offset
    append(`${id} 0 obj\n`)
    append(body)
    append(`${suffix}\nendobj\n`)
  }

  append('%PDF-1.4\n%GRR\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  const pageIds = images.map((_, index) => 3 + index * 3)
  object(2, `<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`)
  images.forEach((image, index) => {
    const pageId = pageIds[index]
    const imageId = pageId + 1
    const contentId = pageId + 2
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /XObject << /Cert ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    offsets[imageId] = offset
    append(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1650 /Height 1275 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`)
    append(image)
    append('\nendstream\nendobj\n')
    const commands = 'q\n792 0 0 612 0 0 cm\n/Cert Do\nQ\n'
    object(contentId, `<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`)
  })
  const xref = offset
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`)
  for (let id = 1; id < offsets.length; id += 1)
    append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  const output = new Uint8Array(offset)
  let cursor = 0
  chunks.forEach((chunk) => {
    output.set(chunk, cursor)
    cursor += chunk.length
  })
  return output
}

export async function downloadRaceWinnerCertificates({
  league,
  season,
  event,
  session,
  className,
}: {
  league: CertificateLeague
  season: string
  event: RaceEvent
  session: RaceSession
  className?: string
}) {
  const winners = certificateWinners(league, event, session).filter(
    (winner) => !className || winner.className === className,
  )
  if (!winners.length) throw new Error('No race winner is available for this result.')
  const { track, date } = eventParts(event)
  const details: CertificateDetails = {
    league,
    leagueName: leagueNames[league],
    season: cleanText(season),
    track,
    date,
    winners,
  }
  const pages = await Promise.all(winners.map((winner) => renderCertificate(details, winner)))
  const pdf = pdfFromJpegs(pages)
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeName(details.leagueName)}-${safeName(track)}-race-winner${winners.length > 1 ? 's' : ''}.pdf`
  anchor.click()
  URL.revokeObjectURL(url)
}
