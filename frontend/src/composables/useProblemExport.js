import { writeTextToClipboard } from './useClipboard.js'
import { renderProblemDocumentCanvas } from './useProblemPdfExport.js'

export function createProblemExportData(problem) {
  return {
    content: String(problem.content ?? '').trim(),
    problemId: String(problem.id ?? 'problem'),
    source: String(problem.sourceText ?? '').trim(),
    title: String(problem.title ?? '题目').trim(),
    type: String(problem.typeLabel ?? '').trim(),
  }
}

export function getSafeProblemFileName(value) {
  return (
    String(value || '题目')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || '题目'
  )
}

export function getProblemMarkdown(problem) {
  const data = createProblemExportData(problem)

  return [
    `## ${data.title}`,
    '',
    data.problemId ? `**题号：** ${data.problemId}` : '',
    data.type ? `**题型：** ${data.type}` : '',
    data.source ? `**来源：** ${data.source}` : '',
    '',
    data.content,
  ]
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join('\n')
}

export function copyProblemAsMarkdown(problem) {
  return writeTextToClipboard(getProblemMarkdown(problem))
}

function downloadCanvas(canvas, fileName) {
  return new Promise((resolve, reject) => {
    function downloadBlob(blob) {
      if (!blob) {
        reject(new Error('image export failed'))
        return
      }

      const link = document.createElement('a')
      link.download = `${fileName}.png`
      link.href = URL.createObjectURL(blob)
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      resolve()
    }

    if (canvas.toBlob) {
      canvas.toBlob(downloadBlob, 'image/png')
      return
    }

    try {
      const link = document.createElement('a')
      link.download = `${fileName}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      resolve()
    } catch (error) {
      reject(error)
    }
  })
}

export async function exportProblemAsImage(problem) {
  const data = createProblemExportData(problem)
  // 卷面排版需要渲染后的数学（MathML），直接把 content 画到 canvas 只会得到 LaTeX 源码。
  const canvas = await renderProblemDocumentCanvas({
    entries: [{ problem, note: '' }],
    includeHeader: false,
    options: {
      content: true,
      choices: true,
      'problem-id': true,
      source: true,
      tags: true,
      title: true,
      type: true,
      typePrefix: false,
      value: true,
    },
  })
  await downloadCanvas(canvas, getSafeProblemFileName(data.title))
}
