import type { GtCareerProfile } from '../services/dataSources'

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) =>
  canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create career image.')), 'image/png'),
)

function fittedText(context: CanvasRenderingContext2D, value: string, x: number, y: number, width: number) {
  let size = 54
  while (size > 28) {
    context.font = `900 ${size}px Arial`
    if (context.measureText(value).width <= width) break
    size -= 1
  }
  context.fillText(value, x, y, width)
}

export async function shareGtCareerImage(profile: GtCareerProfile) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 675
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas export is not supported in this browser.')
  context.fillStyle = '#0d120e'
  context.fillRect(0, 0, 1200, 675)
  context.fillStyle = '#36ae2f'
  context.fillRect(0, 0, 18, 675)
  context.fillStyle = '#76df6c'
  context.font = '800 22px Arial'
  context.fillText('GRR GT LEAGUE CAREER SUMMARY', 70, 70)
  context.fillStyle = '#fff'
  fittedText(context, profile.driver.toUpperCase(), 70, 145, 1060)
  context.fillStyle = '#aebbaa'
  context.font = '700 18px Arial'
  context.fillText(`${profile.seasonsEntered} SEASONS • ${profile.classes.map((item) => item.classLabel).join(' • ')}`, 70, 185)
  const headline = [
    ['CHAMPIONSHIPS', profile.championships], ['WINS', profile.wins], ['PODIUMS', profile.podiums], ['STARTS', profile.starts],
  ]
  headline.forEach(([label, value], index) => {
    const x = 70 + index * 270
    context.fillStyle = '#151d16'
    context.fillRect(x, 225, 250, 120)
    context.fillStyle = '#76df6c'
    context.font = '900 46px Arial'
    context.fillText(String(value), x + 18, 285)
    context.fillStyle = '#aebbaa'
    context.font = '800 14px Arial'
    context.fillText(String(label), x + 18, 320)
  })
  const details = [
    ['AVG FINISH', profile.averageFinish], ['POLES', profile.poles], ['FASTEST LAPS', profile.fastestLaps],
    ['LAPS COMPLETED', profile.laps.toLocaleString()], ['CAREER POINTS', profile.points.toLocaleString()], ['BEST FINISH', profile.bestFinish],
  ]
  details.forEach(([label, value], index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    const x = 70 + column * 360
    const y = 400 + row * 78
    context.fillStyle = row % 2 ? '#111712' : '#151d16'
    context.fillRect(x, y, 340, 62)
    context.fillStyle = '#fff'
    context.font = '900 24px Arial'
    context.fillText(String(value), x + 16, y + 29)
    context.fillStyle = '#aebbaa'
    context.font = '700 12px Arial'
    context.fillText(String(label), x + 16, y + 49)
  })
  context.fillStyle = '#76df6c'
  context.font = '900 22px Arial'
  context.fillText('GRASSROOTS RACING', 70, 625)
  context.fillStyle = '#7f8c7c'
  context.font = '700 14px Arial'
  context.fillText('grassrootsracing.org', 910, 625)
  const image = await canvasBlob(canvas)
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
      return 'copied' as const
    } catch {
      /* Fall back to a download. */
    }
  }
  const url = URL.createObjectURL(image)
  const link = document.createElement('a')
  link.href = url
  link.download = `grr-gt-${profile.driver.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-career.png`
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded' as const
}
