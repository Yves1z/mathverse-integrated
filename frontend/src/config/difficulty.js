export const DIFFICULTY_LEVEL_VALUES = Object.freeze([
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
])

export const RESERVED_DIFFICULTY_LEVEL_VALUES = Object.freeze(['black', 'white'])

export const DEFAULT_DIFFICULTY_SCHEME_ID = 'gaokao-stage-stars'

function level(value, name, stars, rank) {
  return Object.freeze({
    value,
    name,
    stars,
    rank,
    label: `${name} ${'★'.repeat(stars)}`,
    color: `var(--color-level-${value})`,
  })
}

const gaokaoStageStars = Object.freeze({
  id: DEFAULT_DIFFICULTY_SCHEME_ID,
  name: '高考阶段',
  description: '按基础、提高、压轴分组，组内星数越多难度越高。',
  levels: Object.freeze({
    red: level('red', '基础', 1, 1),
    orange: level('orange', '基础', 2, 2),
    yellow: level('yellow', '提高', 1, 3),
    green: level('green', '提高', 2, 4),
    cyan: level('cyan', '提高', 3, 5),
    blue: level('blue', '压轴', 1, 6),
    purple: level('purple', '压轴', 2, 7),
  }),
})

export const DIFFICULTY_SCHEMES = Object.freeze({
  [gaokaoStageStars.id]: gaokaoStageStars,
})

const reservedLevels = Object.freeze({
  black: Object.freeze({
    value: 'black',
    name: '历史等级',
    stars: 0,
    rank: 8,
    label: 'JUNK',
    color: 'var(--color-level-black)',
    reserved: true,
  }),
  white: Object.freeze({
    value: 'white',
    name: '历史等级',
    stars: 0,
    rank: 9,
    label: 'WHITE',
    color: 'var(--color-level-white)',
    reserved: true,
  }),
})

const unknownLevel = Object.freeze({
  value: 'unknown',
  name: '未分级',
  stars: 0,
  rank: Number.MAX_SAFE_INTEGER,
  label: '未分级',
  color: 'var(--color-ink-muted, #7d8992)',
})

export function getDifficultyScheme(schemeId = DEFAULT_DIFFICULTY_SCHEME_ID) {
  return DIFFICULTY_SCHEMES[schemeId] ?? DIFFICULTY_SCHEMES[DEFAULT_DIFFICULTY_SCHEME_ID]
}

export function getDifficultyDisplay(value, schemeId = DEFAULT_DIFFICULTY_SCHEME_ID) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  return (
    getDifficultyScheme(schemeId).levels[normalized] ?? reservedLevels[normalized] ?? unknownLevel
  )
}

export function getDifficultyDisplays(
  schemeId = DEFAULT_DIFFICULTY_SCHEME_ID,
  { includeReserved = false, includeUnknown = false } = {},
) {
  const scheme = getDifficultyScheme(schemeId)
  const displays = DIFFICULTY_LEVEL_VALUES.map((value) => scheme.levels[value])
  if (includeReserved) {
    displays.push(...RESERVED_DIFFICULTY_LEVEL_VALUES.map((value) => reservedLevels[value]))
  }
  if (includeUnknown) displays.push(unknownLevel)
  return displays
}

export function createDifficultyOptions(
  schemeId = DEFAULT_DIFFICULTY_SCHEME_ID,
  { includeAll = true, includeReserved = true } = {},
) {
  const options = getDifficultyDisplays(schemeId, { includeReserved }).map((item) => ({
    value: item.value,
    label: item.label,
    name: item.name,
    stars: item.stars,
    rank: item.rank,
  }))
  return includeAll ? [{ value: '', label: '全部' }, ...options] : options
}

export function formatDifficultyLabel(value, schemeId = DEFAULT_DIFFICULTY_SCHEME_ID) {
  return getDifficultyDisplay(value, schemeId).label
}
