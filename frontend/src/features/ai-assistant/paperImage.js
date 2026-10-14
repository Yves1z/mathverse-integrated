import { prepareSimilarityImage, SIMILARITY_IMAGE_MAX_SOURCE_BYTES } from '../similar-problems/imageInput.js'

export function validatePaperImage(file) {
  if (!(file instanceof Blob) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 JPG、PNG 或 WebP 照片')
  }
  if (!file.size || file.size > SIMILARITY_IMAGE_MAX_SOURCE_BYTES) throw new Error('照片须为 1 字节～12 MB')
}

export function paperCropBounds(width, height, percent) {
  if (![width, height].every((n) => Number.isSafeInteger(n) && n > 0 && n <= 12000)
    || width * height > 40_000_000) throw new Error('照片尺寸过大，请先缩小至 4000 万像素以内')
  const { x, y, width: w, height: h } = percent
  if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))
    || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 100 || y + h > 100) {
    throw new Error('选区须在照片内，宽度和高度须大于 0')
  }
  // Restored integer coordinates can have floating point noise after percent conversion.
  const snap = (n) => Math.abs(n - Math.round(n)) < 1e-7 ? Math.round(n) : n
  const left = Math.floor(snap(width * x / 100)), top = Math.floor(snap(height * y / 100))
  const right = Math.min(width, Math.ceil(snap(width * (x + w) / 100)))
  const bottom = Math.min(height, Math.ceil(snap(height * (y + h) / 100)))
  if (right - left < 8 || bottom - top < 8) throw new Error('选区太小，请至少选择 8 × 8 像素')
  return Object.freeze({ x: left, y: top, width: right - left, height: bottom - top, originalWidth: width, originalHeight: height })
}

export function orientedPaperDimensions(width, height, rotation = 0) {
  if (![0, 90, 180, 270].includes(rotation)) throw new Error('照片方向无效，请重新选择')
  return rotation % 180 ? { width: height, height: width } : { width, height }
}

// Crop metadata always uses pixels of the browser-decoded original, never the preview.
export function paperCropFromPercent(width, height, percent, rotation = 0) {
  const dimensions = orientedPaperDimensions(width, height, rotation)
  const c = paperCropBounds(dimensions.width, dimensions.height, percent)
  let rect
  if (rotation === 90) rect = { x: c.y, y: height - c.x - c.width, width: c.height, height: c.width }
  else if (rotation === 180) rect = { x: width - c.x - c.width, y: height - c.y - c.height, width: c.width, height: c.height }
  else if (rotation === 270) rect = { x: width - c.y - c.height, y: c.x, width: c.height, height: c.width }
  else rect = { x: c.x, y: c.y, width: c.width, height: c.height }
  return Object.freeze({ ...rect, originalWidth: width, originalHeight: height })
}

export function paperCropToPercent(c, rotation = 0) {
  const d = orientedPaperDimensions(c.originalWidth, c.originalHeight, rotation)
  let r = c
  if (rotation === 90) r = { x: c.originalHeight - c.y - c.height, y: c.x, width: c.height, height: c.width }
  else if (rotation === 180) r = { x: c.originalWidth - c.x - c.width, y: c.originalHeight - c.y - c.height, width: c.width, height: c.height }
  else if (rotation === 270) r = { x: c.y, y: c.originalWidth - c.x - c.width, width: c.height, height: c.width }
  return { x: r.x / d.width * 100, y: r.y / d.height * 100, width: r.width / d.width * 100, height: r.height / d.height * 100 }
}

function paperCanvas(photo, crop, rotation) {
  const d = orientedPaperDimensions(crop.width, crop.height, rotation)
  const scale = Math.min(1, 1800 / Math.max(d.width, d.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(d.width * scale))
  canvas.height = Math.max(1, Math.round(d.height * scale))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('浏览器无法裁剪照片')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (rotation === 90) context.translate(canvas.width, 0)
  else if (rotation === 180) context.translate(canvas.width, canvas.height)
  else if (rotation === 270) context.translate(0, canvas.height)
  context.rotate(rotation * Math.PI / 180)
  context.drawImage(photo.image, crop.x, crop.y, crop.width, crop.height, 0, 0,
    rotation % 180 ? canvas.height : canvas.width, rotation % 180 ? canvas.width : canvas.height)
  return canvas
}

// Local editor preview only. Recognition always uses createPaperArtifact's explicit crop.
export function paperPreviewUrl(photo, rotation = 0) {
  if (rotation === 0) return photo.url
  const crop = paperCropBounds(photo.image.naturalWidth, photo.image.naturalHeight, { x: 0, y: 0, width: 100, height: 100 })
  return paperCanvas(photo, crop, rotation).toDataURL('image/jpeg', .9)
}

export async function paperImageHash(blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('')
}

export async function loadPaperImage(file) {
  validatePaperImage(file)
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('照片无法解码，请更换文件'))
      image.src = url
    })
    paperCropBounds(image.naturalWidth, image.naturalHeight, { x: 0, y: 0, width: 100, height: 100 })
    return { file, image, url, originalHash: await paperImageHash(file) }
  } catch (error) { URL.revokeObjectURL(url); throw error }
}

// Draw only the explicit crop, before downscaling or preparing a relay image.
export async function createPaperArtifact(photo, percent, source, rotation = 0) {
  validatePaperImage(photo.file)
  const crop = paperCropFromPercent(photo.image.naturalWidth, photo.image.naturalHeight, percent, rotation)
  const canvas = paperCanvas(photo, crop, rotation)
  const croppedBlob = await new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob); else reject(new Error('裁剪失败，请重试'))
  }, 'image/png'))
  const prepared = await prepareSimilarityImage(croppedBlob)
  return Object.freeze({ ...source, id: crypto.randomUUID(), sourceKind: 'paper_image',
    originalBlob: photo.file, originalHash: photo.originalHash, crop, rotation,
    croppedBlob, contentHash: await paperImageHash(croppedBlob),
    dataUrl: prepared.dataUrl, width: prepared.width, height: prepared.height })
}
