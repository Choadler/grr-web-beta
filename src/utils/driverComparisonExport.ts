import type { DriverComparison } from '../types/driverComparison'

const blob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Could not create comparison image.'))),
      'image/png',
    ),
  )

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
  context.font = '900 42px Arial'
  context.fillText(comparison.driverA.name.toUpperCase(), 290, 225)
  context.fillText(comparison.driverB.name.toUpperCase(), 910, 225)
  context.fillStyle = '#76df6c'
  context.font = '900 92px Arial'
  context.fillText(String(comparison.driverAWins), 475, 245)
  context.fillStyle = '#fff'
  context.font = '900 44px Arial'
  context.fillText('—', 600, 235)
  context.fillStyle = '#76df6c'
  context.font = '900 92px Arial'
  context.fillText(String(comparison.driverBWins), 725, 245)
  context.fillStyle = '#b8c3b7'
  context.font = '700 20px Arial'
  context.fillText(
    `${comparison.sharedRaces.length} RACES TOGETHER${comparison.ties ? ` • ${comparison.ties} TIED` : ''}`,
    600,
    315,
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
    const y = 385 + index * 48
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
