/**
 * Geometry and colour helpers for the official practice-list chart.
 * Kept free of Vue so the numbers can be unit tested directly.
 */

export const PRACTICE_LIST_DISPLAY_DEFAULTS = Object.freeze({
  heading: '官方题单',
  description: '由数海首位用户负责维护，所有人均可查看和打印。',
  baseColor: '#dbe9f7',
  progressColor: '#a9c9e8',
  textColor: '#123047',
  barHeight: 40,
  blendPercent: 8,
  sortDirection: 'asc',
  showProblemCount: true,
})

const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/

/** Shortest bar as a share of the longest one, so every label stays readable. */
export const MIN_BAR_WIDTH_PERCENT = 22

/** 官方题单可用的排序方式；count 即按题目数量（默认）。 */
export const PRACTICE_LIST_SORT_MODES = Object.freeze(['name', 'count', 'progress', 'level'])

/** 题单标题里 "·" 之后的难度后缀，数组顺序即由易到难。 */
export const PRACTICE_LIST_LEVEL_ORDER = Object.freeze(['基础', '提高', '压轴'])

/**
 * 题单标题约定为「主题·难度」（例如 立体几何·提高）。按名称排序时先按主题分组，
 * 同一主题的基础/提高/压轴因此会连在一起，组内再按难度排列。
 */
export function parsePracticeListTitle(title) {
  const text = String(title ?? '').trim()
  const separator = text.indexOf('·')

  if (separator <= 0) {
    return { topic: text, level: '', levelRank: PRACTICE_LIST_LEVEL_ORDER.length }
  }

  const level = text.slice(separator + 1).trim()
  const rank = PRACTICE_LIST_LEVEL_ORDER.indexOf(level)
  return {
    topic: text.slice(0, separator).trim(),
    level,
    levelRank: rank < 0 ? PRACTICE_LIST_LEVEL_ORDER.length : rank,
  }
}

/** 规整用户排序偏好；未指定方向时回落到后台配置的默认方向。 */
export function normalizePracticeListSort(value, fallbackDirection = 'asc') {
  const source = value && typeof value === 'object' ? value : {}
  const direction =
    source.direction === 'asc' || source.direction === 'desc'
      ? source.direction
      : fallbackDirection === 'desc'
        ? 'desc'
        : 'asc'

  return {
    mode: PRACTICE_LIST_SORT_MODES.includes(source.mode) ? source.mode : 'count',
    direction,
  }
}

function compareChartRows(a, b, mode) {
  if (mode === 'progress') {
    return a.percent - b.percent
  }

  if (mode === 'level') {
    if (a.levelRank !== b.levelRank) return a.levelRank - b.levelRank
    return a.topic.localeCompare(b.topic, 'zh-CN')
  }

  if (mode === 'name') {
    const byTopic = a.topic.localeCompare(b.topic, 'zh-CN')
    if (byTopic !== 0) return byTopic
    return a.levelRank - b.levelRank
  }

  return a.problemCount - b.problemCount
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function normalizeColor(value, fallback) {
  const color = typeof value === 'string' ? value.trim() : ''
  return COLOR_PATTERN.test(color) ? color : fallback
}

/** Keeps a real number (clamped into range) and only falls back when truly absent. */
function normalizeNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(clamp(parsed, min, max))
}

/**
 * Coerces an API payload (or a partial local override) into safe render values.
 * Unknown or out-of-range fields fall back to the shipped defaults.
 */
export function normalizePracticeListDisplay(raw) {
  const defaults = PRACTICE_LIST_DISPLAY_DEFAULTS
  const source = raw && typeof raw === 'object' ? raw : {}
  const heading = typeof source.heading === 'string' && source.heading.trim()
    ? source.heading.trim().slice(0, 60)
    : defaults.heading
  const description = typeof source.description === 'string'
    ? source.description.trim().slice(0, 200)
    : defaults.description

  return {
    heading,
    description,
    baseColor: normalizeColor(source.baseColor, defaults.baseColor),
    progressColor: normalizeColor(source.progressColor, defaults.progressColor),
    textColor: normalizeColor(source.textColor, defaults.textColor),
    barHeight: normalizeNumber(source.barHeight, defaults.barHeight, 20, 120),
    blendPercent: normalizeNumber(source.blendPercent, defaults.blendPercent, 0, 30),
    sortDirection: source.sortDirection === 'desc' ? 'desc' : 'asc',
    showProblemCount: source.showProblemCount === undefined
      ? defaults.showProblemCount
      : Boolean(source.showProblemCount),
  }
}

/**
 * Paints `percent` of the bar with the progress colour and the rest with the base
 * colour, blending across a symmetric band around the boundary. The band narrows
 * near 0% and 100% so the filled share still matches the real ratio, and there is
 * never a hard seam between the two colours.
 */
export function buildProgressGradient({
  percent,
  baseColor,
  progressColor,
  blendPercent,
} = {}) {
  const base = normalizeColor(baseColor, PRACTICE_LIST_DISPLAY_DEFAULTS.baseColor)
  const progress = normalizeColor(progressColor, PRACTICE_LIST_DISPLAY_DEFAULTS.progressColor)
  const ratio = clamp(Number(percent), 0, 100)
  const requested = normalizeNumber(
    blendPercent,
    PRACTICE_LIST_DISPLAY_DEFAULTS.blendPercent,
    0,
    30,
  )

  if (ratio <= 0) return `linear-gradient(90deg, ${base} 0%, ${base} 100%)`
  if (ratio >= 100) return `linear-gradient(90deg, ${progress} 0%, ${progress} 100%)`
  if (requested <= 0) {
    return `linear-gradient(90deg, ${progress} 0%, ${progress} ${ratio}%, ${base} ${ratio}%, ${base} 100%)`
  }

  const half = Math.min(requested, ratio, 100 - ratio)
  const start = ratio - half
  const end = ratio + half
  return (
    `linear-gradient(90deg, ${progress} 0%, ${progress} ${start}%, ` +
    `${base} ${end}%, ${base} 100%)`
  )
}

/**
 * Turns public practice lists into one bar each: sorted by problem count, sized
 * relative to the largest list, and coloured by the viewer's completed ratio.
 */
export function buildPracticeListChartRows(lists, settings, sort) {
  const config = normalizePracticeListDisplay(settings)
  const rows = (Array.isArray(lists) ? lists : []).map((list) => {
    const problemCount = Number(list?.problemCount ?? list?.items?.length ?? 0) || 0
    const completedCount = Number(list?.completedCount ?? 0) || 0
    const safeCompleted = clamp(completedCount, 0, problemCount)
    const percent = problemCount > 0 ? (safeCompleted / problemCount) * 100 : 0
    const title = String(list?.title ?? '')
    return {
      id: String(list?.id ?? ''),
      title,
      problemCount,
      completedCount: safeCompleted,
      percent,
      ...parsePracticeListTitle(title),
    }
  })

  const preference = normalizePracticeListSort(sort, config.sortDirection)
  const direction = preference.direction === 'desc' ? -1 : 1
  rows.sort((a, b) => {
    const primary = compareChartRows(a, b, preference.mode)
    if (primary !== 0) return primary * direction
    const byTitle = a.title.localeCompare(b.title, 'zh-CN')
    if (byTitle !== 0) return byTitle * direction
    return a.id.localeCompare(b.id)
  })

  const maxCount = rows.reduce((max, row) => Math.max(max, row.problemCount), 0)
  return rows.map((row) => ({
    ...row,
    widthPercent: maxCount > 0
      ? Math.max(MIN_BAR_WIDTH_PERCENT, (row.problemCount / maxCount) * 100)
      : MIN_BAR_WIDTH_PERCENT,
    gradient: buildProgressGradient({
      percent: row.percent,
      baseColor: config.baseColor,
      progressColor: config.progressColor,
      blendPercent: config.blendPercent,
    }),
  }))
}
