// Ignore option-like letters inside LaTeX, and require a complete A–D sequence.
export function splitPaperChoices(content) {
  const mask = content.replace(
    /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g,
    (s) => ' '.repeat(s.length),
  )
  const markers = [...mask.matchAll(/(?:^|[\s　]+)([ABCD])[.．、]/g)]
  if (markers.length === 4 && markers.map((m) => m[1]).join('') === 'ABCD') {
    const starts = markers.map((m) => m.index + m[0].indexOf(m[1]))
    return {
      stem: content.slice(0, starts[0]).trimEnd(),
      options: markers.map((m, i) => {
        const labelStart = m.index + m[0].indexOf(m[1])
        return content.slice(labelStart + 2, starts[i + 1] ?? content.length).trim()
      }),
    }
  }
  return splitMathBlockChoices(content)
}

// Options transcribed as one formula: $\text{A．}...\qquad \text{B．}...$
const MATH_SEGMENT = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g
const MATH_LABEL = /\\text\s*\{\s*([A-ZＡ-Ｚ])\s*[.．、:：)]?\s*\}/g
const SPACING = /(?:\\qquad|\\quad|\\;|\\,|\\!|\\ )/

function labelLetter(raw) {
  const index = 'ＡＢＣＤ'.indexOf(raw)
  return index === -1 ? raw : 'ABCD'[index]
}

function trimSpacing(value) {
  return value
    .replace(new RegExp(`^(?:\\s|${SPACING.source})+`), '')
    .replace(new RegExp(`(?:\\s|${SPACING.source})+$`), '')
}

function splitMathBlockChoices(content) {
  for (const segment of content.matchAll(MATH_SEGMENT)) {
    const raw = segment[0]
    const width = raw.startsWith('$$') || raw.startsWith('\\') ? 2 : 1
    const body = raw.slice(width, raw.length - width)
    const labels = [...body.matchAll(MATH_LABEL)]
    if (labels.length !== 4 || labels.map((m) => labelLetter(m[1])).join('') !== 'ABCD') continue
    if (body.slice(0, labels[0].index).trim()) continue
    const options = labels.map((m, i) => {
      const start = m.index + m[0].length
      const end = labels[i + 1]?.index ?? body.length
      return `$${trimSpacing(body.slice(start, end))}$`
    })
    if (options.some((option) => option === '$$')) continue
    return {
      stem: (content.slice(0, segment.index) + content.slice(segment.index + raw.length)).trim(),
      options,
    }
  }
  return null
}
