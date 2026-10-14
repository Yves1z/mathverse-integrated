import { escapeHtml, renderQuestionText, renderMathText } from '../utils/renderMathText.js'
import { normalizeQuestionSpacing } from '../utils/questionSpacing.js'
import { splitPaperChoices } from '../utils/questionChoices.js'
import { applyChoiceColumns } from '../utils/choiceColumns.js'
import mathTextStyles from '../assets/styles/math-text.css?raw'
import { getActiveDifficultyDisplay } from './useDifficultyScheme.js'

const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123
const PDF_WIDTH = 595.28
const PDF_HEIGHT = 841.89
const RENDER_SCALE = 1.5
const IMAGE_WIDTH = Math.round(PAGE_WIDTH * RENDER_SCALE)
const IMAGE_HEIGHT = Math.round(PAGE_HEIGHT * RENDER_SCALE)
const IMAGE_SCALE = 2

function safeFileName(value) {
  return (
    String(value || '高考数学练习')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || '高考数学练习'
  )
}

function math(value) {
  return renderQuestionText(String(value ?? ''), { output: 'mathml' })
}

function renderChoicesContent(content) {
  const split = splitPaperChoices(normalizeQuestionSpacing(content))
  if (!split) return math(content)
  const options = split.options
    .map(
      (option, index) =>
        `<div class="math-choice"><span class="math-choice-content">${'ABCD'[index]}．${renderMathText(option, { output: 'mathml' })}</span></div>`,
    )
    .join('')
  return `${math(split.stem)}<div class="math-choices">${options}</div>`
}

function renderHeader(header, entryCount) {
  return `<header class="pdf-header">
    <p>${escapeHtml(header?.eyebrow ?? '高考数学练习')}</p>
    <h1>${escapeHtml(header?.title ?? '练习卷')}</h1>
    <div class="pdf-candidate"><span>姓名：________________</span><span>班级：________________</span><span>日期：________________</span></div>
    <small>共 ${entryCount} 题</small>
  </header>`
}

function renderEntry(entry, options) {
  const problem = entry.problem
  const meta = []
  if (options['problem-id']) meta.push(`题号：${escapeHtml(problem.id)}`)
  if (options.type) meta.push(escapeHtml(problem.typeLabel ?? '题目'))

  return `<article class="pdf-problem">
    ${meta.length ? `<p class="pdf-meta">${meta.join(' · ')}</p>` : ''}
    ${options.title ? `<h2>${escapeHtml(problem.title)}</h2>` : ''}
    ${
      options.content
        ? `<div class="pdf-content">${
            options.type && options.typePrefix !== false
              ? `<strong>【${escapeHtml(problem.typeLabel ?? '题目')}】</strong>`
              : ''
          }<div class="math-text">${options.choices ? renderChoicesContent(problem.content) : math(problem.content)}</div></div>`
        : ''
    }
    ${
      options.content
        ? (problem.assets || [])
            .filter((asset) => /^\/uploads\/[A-Za-z0-9_./-]+$/.test(asset.url))
            .map(
              (asset) =>
                `<img class="pdf-asset" src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || '题目配图')}" />`,
            )
            .join('')
        : ''
    }
    ${options.tags && problem.tags?.length ? `<p class="pdf-secondary">知识点：${problem.tags.map(escapeHtml).join('、')}</p>` : ''}
    ${options.value ? `<p class="pdf-secondary">题目难度：${escapeHtml(getActiveDifficultyDisplay(problem.level).label)}</p>` : ''}
    ${options.source ? `<p class="pdf-secondary">来源：${escapeHtml(problem.sourceText)}</p>` : ''}
    ${options.answer && problem.answer ? `<section class="pdf-answer"><h3>答案</h3><div class="math-text">${math(problem.answer)}</div></section>` : ''}
    ${options.solution && problem.solution ? `<section class="pdf-answer"><h3>解析</h3><div class="math-text">${math(problem.solution)}</div></section>` : ''}
    ${entry.note ? `<section class="pdf-note"><h3>个人备注</h3><div>${escapeHtml(entry.note)}</div></section>` : ''}
  </article>`
}

function documentMarkup({ entries, header, includeHeader, options, pageLayout }) {
  const layoutClass =
    pageLayout === 'one-per-page'
      ? ' is-one-per-page'
      : pageLayout === 'two-per-page'
        ? ' is-two-per-page'
        : ''
  return `<div class="pdf-document${layoutClass}">
    ${includeHeader ? renderHeader(header, entries.length) : ''}
    ${entries.map((entry) => renderEntry(entry, options)).join('')}
  </div>`
}

const DOCUMENT_STYLES = `
  ${mathTextStyles}
  * { box-sizing: border-box; }
  .pdf-document { width: ${PAGE_WIDTH}px; padding: 58px 64px 66px; color: #111; background: #fff; font-family: "Noto Serif SC", "Songti SC", STSong, SimSun, serif; font-size: 16px; line-height: 1.7; }
  .pdf-header { margin-bottom: 34px; padding-bottom: 18px; border-bottom: 1px solid #222; }
  .pdf-header p, .pdf-header h1 { margin: 0; }
  .pdf-header > p { font: 12px/1.5 "Microsoft YaHei", sans-serif; letter-spacing: .12em; }
  .pdf-header h1 { margin: 4px 0 14px; font-size: 25px; }
  .pdf-header small { display: block; margin-top: 8px; text-align: right; }
  .pdf-candidate { display: flex; gap: 28px; font: 13px/1.5 "Microsoft YaHei", sans-serif; }
  .pdf-problem { padding: 0 0 24px; margin: 0 0 26px; border-bottom: 1px solid #aaa; break-inside: avoid; }
  .pdf-problem:last-child { margin-bottom: 0; border-bottom: 0; }
  .pdf-meta { margin: 0 0 5px; font: 13px/1.5 "Microsoft YaHei", sans-serif; }
  .pdf-problem h2 { margin: 0 0 10px; font-size: 18px; line-height: 1.5; }
  .pdf-content { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 10px; }
  .pdf-content > strong { white-space: nowrap; font-size: 14px; }
  .math-text { --question-font-size: 16px; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.9; }
  .math-choices { display: grid; grid-template-columns: repeat(var(--choice-columns, 1), minmax(0, 1fr)); gap: 0 12px; margin-top: .25em; }
  .math-choice { min-width: 0; }
  .math-choice-content { display: inline-block; width: max-content; max-width: 100%; }
  .pdf-asset { display: block; max-width: 100%; max-height: 480px; margin: 16px auto; object-fit: contain; }
  .math-text math[display="block"] { display: block; margin: 10px auto; }
  .pdf-secondary { margin: 8px 0 0; color: #444; font: 12px/1.6 "Microsoft YaHei", sans-serif; }
  .pdf-answer, .pdf-note { margin: 18px 0 0 32px; padding-top: 10px; border-top: 1px solid #777; }
  .pdf-answer h3, .pdf-note h3 { margin: 0 0 5px; font-size: 14px; }
  .pdf-note { padding: 10px 12px; border: 1px solid #999; white-space: pre-wrap; }
  .is-one-per-page .pdf-problem { min-height: ${PAGE_HEIGHT - 130}px; }
  .is-two-per-page .pdf-problem { min-height: ${(PAGE_HEIGHT - 150) / 2}px; }
`

// Chrome 会把 blob: 的 foreignObject SVG 当作跨源内容画进画布，导致 toBlob 抛 SecurityError；
// data: URL 不会污染画布。
function svgDataUrl(source) {
  const bytes = new TextEncoder().encode(source)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

function loadSvgImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('导出渲染失败'))
    image.src = svgDataUrl(source)
  })
}

// SVG foreignObject cannot load external resources; embed each attachment first.
async function mountDocument(markup) {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${PAGE_WIDTH}px;background:#fff;pointer-events:none;`
  host.innerHTML = `<style>${DOCUMENT_STYLES}</style>${markup}`
  document.body.append(host)

  try {
    await document.fonts?.ready
    for (const img of host.querySelectorAll('img')) {
      const url = img.getAttribute('src')
      if (!url?.startsWith('/uploads/')) throw new Error('导出图片地址不合法')
      const prefix = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
      const response = await fetch(`${prefix}${url}`, { credentials: 'include' })
      if (!response.ok) throw new Error('导出配图读取失败，请稍后重试')
      const blob = await response.blob()
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      img.loading = 'eager'
      img.src = data
      await img.decode()
    }
    return host
  } catch (error) {
    host.remove()
    throw error
  }
}

function serializeDocument(host) {
  return new XMLSerializer().serializeToString(host.querySelector('.pdf-document'))
}

async function renderPage(markup, totalHeight, pageOffset) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 ${pageOffset} ${PAGE_WIDTH} ${PAGE_HEIGHT}">
    <foreignObject x="0" y="0" width="${PAGE_WIDTH}" height="${totalHeight}">
      <div xmlns="http://www.w3.org/1999/xhtml"><style>${DOCUMENT_STYLES}</style>${markup}</div>
    </foreignObject>
  </svg>`
  const image = await loadSvgImage(svg)
  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_WIDTH
  canvas.height = IMAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法创建 PDF 画布')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94)
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function ascii(value) {
  return new TextEncoder().encode(value)
}

function joinBytes(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0)
  const result = new Uint8Array(size)
  let offset = 0
  parts.forEach((part) => {
    result.set(part, offset)
    offset += part.length
  })
  return result
}

function streamObject(dictionary, stream) {
  return joinBytes([
    ascii(`<< ${dictionary} /Length ${stream.length} >>\nstream\n`),
    stream,
    ascii('\nendstream'),
  ])
}

function createPdf(pageImages) {
  const objects = []
  const pageIds = pageImages.map((_, index) => 3 + index * 3)
  objects[1] = ascii('<< /Type /Catalog /Pages 2 0 R >>')
  objects[2] = ascii(
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
  )

  pageImages.forEach((jpeg, index) => {
    const pageId = pageIds[index]
    const imageId = pageId + 1
    const contentId = pageId + 2
    objects[pageId] = ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
    objects[imageId] = streamObject(
      `/Type /XObject /Subtype /Image /Width ${IMAGE_WIDTH} /Height ${IMAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      jpeg,
    )
    objects[contentId] = streamObject(
      '',
      ascii(`q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/Im0 Do\nQ`),
    )
  })

  const parts = [ascii('%PDF-1.4\n%PDFDATA\n')]
  const offsets = [0]
  let length = parts[0].length
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = length
    const object = joinBytes([ascii(`${id} 0 obj\n`), objects[id], ascii('\nendobj\n')])
    parts.push(object)
    length += object.length
  }

  const xrefOffset = length
  const xref = [`xref\n0 ${objects.length}\n`, '0000000000 65535 f \n']
  for (let id = 1; id < objects.length; id += 1) {
    xref.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  }
  parts.push(ascii(xref.join('')))
  parts.push(
    ascii(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`),
  )
  return joinBytes(parts)
}

export async function exportProblemsAsPdf({
  documentTitle,
  entries,
  header,
  includeHeader,
  options,
  pageLayout,
}) {
  const markup = documentMarkup({
    entries,
    header,
    includeHeader,
    options: { ...options, choices: true },
    pageLayout,
  })
  const measurement = await mountDocument(markup)

  try {
    applyChoiceColumns(measurement)
    const serialized = serializeDocument(measurement)
    const totalHeight = Math.max(PAGE_HEIGHT, Math.ceil(measurement.scrollHeight))
    const pageCount = Math.ceil(totalHeight / PAGE_HEIGHT)
    const images = []
    for (let page = 0; page < pageCount; page += 1) {
      images.push(await renderPage(serialized, totalHeight, page * PAGE_HEIGHT))
    }

    const pdfUrl = URL.createObjectURL(new Blob([createPdf(images)], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.download = `${safeFileName(documentTitle)}.pdf`
    link.href = pdfUrl
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000)
    return { ok: true, forPdf: true }
  } finally {
    measurement.remove()
  }
}

// 单页整图：与 PDF 同一套排版，但按内容高度输出一张 PNG 画布。
export async function renderProblemDocumentCanvas({ entries, header, includeHeader, options }) {
  const measurement = await mountDocument(
    documentMarkup({ entries, header, includeHeader, options }),
  )

  try {
    applyChoiceColumns(measurement)
    const height = Math.max(240, Math.ceil(measurement.scrollHeight))
    const width = PAGE_WIDTH * IMAGE_SCALE
    const image =
      await loadSvgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height * IMAGE_SCALE}" viewBox="0 0 ${PAGE_WIDTH} ${height}">
      <foreignObject x="0" y="0" width="${PAGE_WIDTH}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml"><style>${DOCUMENT_STYLES}</style>${serializeDocument(measurement)}</div>
      </foreignObject>
    </svg>`)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height * IMAGE_SCALE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建导出画布')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    return canvas
  } finally {
    measurement.remove()
  }
}
