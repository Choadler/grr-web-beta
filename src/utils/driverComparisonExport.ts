import type { DriverComparison } from '../types/driverComparison'

const blob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Could not create comparison image.'))),
      'image/png',
    ),
  )

function drawFittedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  minSize: number,
) {
  let size = maxSize
  do {
    context.font = `900 ${size}px Arial`
    if (context.measureText(value).width <= maxWidth) break
    size -= 1
  } while (size > minSize)
  context.fillText(value, x, y, maxWidth)
}

export async function shareDriverComparisonImage(
  comparison: DriverComparison,
  filterLabel: string,
) {
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
  context.font = '700 22px Arial'
  context.fillText('GRR DRIVER COMPARISON', 70, 70)
  context.fillStyle = '#aebbaa'
  context.font = '700 17px Arial'
  context.fillText(filterLabel.toUpperCase(), 70, 108)
  context.textAlign = 'center'
  context.fillStyle = '#fff'
  drawFittedText(context, comparison.driverA.name.toUpperCase(), 260, 205, 380, 42, 25)
  drawFittedText(context, comparison.driverB.name.toUpperCase(), 940, 205, 380, 42, 25)
  context.fillStyle = '#76df6c'
  context.font = '900 82px Arial'
  context.fillText(String(comparison.driverAWins), 500, 285)
  context.fillStyle = '#fff'
  context.font = '900 44px Arial'
  context.fillText('—', 600, 275)
  context.fillStyle = '#76df6c'
  context.font = '900 82px Arial'
  context.fillText(String(comparison.driverBWins), 700, 285)
  context.fillStyle = '#b8c3b7'
  context.font = '700 20px Arial'
  context.fillText(
    `${comparison.sharedRaces.length} RACES TOGETHER${comparison.ties ? ` • ${comparison.ties} TIED` : ''}`,
    600,
    335,
  )
  const stats = [
    [
      'AVG FINISH',
      comparison.sharedA.averageFinish ?? '—',
      comparison.sharedB.averageFinish ?? '—',
    ],
    ['WINS', comparison.sharedA.wins, comparison.sharedB.wins],
    ['TOP 5s', comparison.sharedA.top5, comparison.sharedB.top5],
    ['POLES', comparison.sharedA.poles, comparison.sharedB.poles],
    ['LAPS LED', comparison.sharedA.lapsLed, comparison.sharedB.lapsLed],
  ]
  stats.forEach(([label, left, right], index) => {
    const y = 405 + index * 46
    context.fillStyle = index % 2 ? '#151d16' : '#111712'
    context.fillRect(70, y - 30, 1060, 42)
    context.font = '800 20px Arial'
    context.fillStyle = '#fff'
    context.textAlign = 'center'
    context.fillText(String(left), 240, y)
    context.fillText(String(right), 960, y)
    context.fillStyle = '#aebbaa'
    context.font = '700 16px Arial'
    context.fillText(String(label), 600, y)
  })
  context.textAlign = 'left'
  context.fillStyle = '#76df6c'
  context.font = '900 22px Arial'
  context.fillText('GRASSROOTS RACING', 70, 635)
  const image = await blob(canvas)
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
      return 'copied' as const
    } catch {
      /* Download below. */
    }
  }
  const url = URL.createObjectURL(image)
  const link = document.createElement('a')
  link.href = url
  link.download = 'grr-driver-comparison.png'
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded' as const
}
