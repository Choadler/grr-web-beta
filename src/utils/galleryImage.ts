const maximumUploadBytes = 50 * 1024 * 1024

type ImageVariant = {
  file: File
  width: number
  height: number
}

const fitWithin = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const renderVariant = async (
  source: ImageBitmap,
  originalName: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  suffix: string,
): Promise<ImageVariant> => {
  const dimensions = fitWithin(source.width, source.height, maxWidth, maxHeight)
  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('This browser could not prepare the photo for upload.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Photo conversion failed.'))),
      'image/webp',
      quality,
    ),
  )
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'race-photo'
  return {
    file: new File([blob], `${baseName}-${suffix}.webp`, { type: 'image/webp' }),
    ...dimensions,
  }
}

export async function prepareGalleryPhoto(original: File) {
  if (!original.size || original.size > maximumUploadBytes)
    throw new Error('Photos must be no larger than 50 MB.')
  const bitmap = await createImageBitmap(original, { imageOrientation: 'from-image' })
  try {
    const [display, thumbnail] = await Promise.all([
      renderVariant(bitmap, original.name, 3840, 2160, 0.86, 'display'),
      renderVariant(bitmap, original.name, 1200, 800, 0.78, 'thumbnail'),
    ])
    return { original, display: display.file, thumbnail: thumbnail.file }
  } finally {
    bitmap.close()
  }
}

