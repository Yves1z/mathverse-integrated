import { createDifficultyOptions } from './difficulty.js'

export const DEFAULT_PROBLEMS_SORT = 'newest'

export const PROBLEMS_DISPLAY_OPTION_OPTIONS = [
  { value: 'selection', label: '选择框' },
  { value: 'problem-id', label: '题号' },
  { value: 'tags', label: '知识标签' },
  { value: 'value', label: '题目难度' },
  { value: 'source', label: '来源信息' },
  { value: 'export', label: '导出按钮' },
]

export const PROBLEMS_PRINT_OPTION_OPTIONS = [
  { value: 'problem-id', label: '题库编号' },
  { value: 'type', label: '题型' },
  { value: 'content', label: '题干' },
  { value: 'title', label: '题目标题' },
  { value: 'tags', label: '知识标签' },
  { value: 'value', label: '题目难度' },
  { value: 'source', label: '来源信息' },
]

// 临时使用 frontend/problems 原型中的两道题，后续由新版题库接口替换。
export const PROBLEMS_PROTOTYPE_ITEMS = [
  {
    id: 'P10001',
    completed: false,
    year: '2025',
    source: 'national-new-1',
    sourceLabel: '新高考Ⅰ卷',
    type: 'single-choice',
    typeLabel: '单选题',
    level: 'red',
    title: '2025 年新高考Ⅰ卷 · T1',
    detail: '复数的基本运算',
    tags: ['复数'],
    stats: {
      views: '1.3M',
      passes: '73.7k',
      downloads: '20.0k',
      favorites: '10.0k',
    },
    sourceText: '2025 · 新高考Ⅰ卷 · T1',
    content: '1. (1 + 5i)i 的虚部为（    ）\n\nA. −1        B. 0        C. 1        D. 6',
  },
  {
    id: 'P10002',
    completed: true,
    year: '2024',
    source: 'national-a',
    sourceLabel: '全国甲卷',
    type: 'solution',
    typeLabel: '解答题',
    level: 'green',
    title: '2024 年全国甲卷 · T21',
    detail: '函数的单调性与最值',
    tags: ['函数', '导数'],
    sourceText: '2024 · 全国甲卷 · T21',
    content:
      '21. 已知函数 f(x) = x³ − 3x² + a。\n\n(1) 求 f(x) 的单调区间；\n(2) 讨论 f(x) 的极值。',
    answer: '递增区间为 $(-\\infty,0)$、$(2,+\\infty)$，递减区间为 $(0,2)$。极大值为 $a$，极小值为 $a-4$。',
    solution:
      '对函数求导，得到 $f\'(x)=3x^2-6x=3x(x-2)$。\n\n令 $f\'(x)=0$，得到两个临界点 $x=0$ 与 $x=2$。\n\n考察导函数的符号：当 $x<0$ 或 $x>2$ 时，$f\'(x)>0$；当 $0<x<2$ 时，$f\'(x)<0$。因此 $f(x)$ 在 $(-\\infty,0)$、$(2,+\\infty)$ 上递增，在 $(0,2)$ 上递减。\n\n函数在 $x=0$ 处取得极大值 $f(0)=a$，在 $x=2$ 处取得极小值 $f(2)=a-4$。',
    solutionSourceType: 'official',
    solutionReviewStatus: 'approved',
  },
]

export const PROBLEMS_SORT_OPTIONS = [
  { value: 'newest', label: '最新收录' },
  { value: 'oldest', label: '最早收录' },
  { value: 'easy-first', label: '由易到难' },
  { value: 'hard-first', label: '由难到易' },
  { value: 'view-most', label: '最多浏览' },
  { value: 'star-most', label: '最多收藏' },
]

export const PROBLEMS_LEVEL_OPTIONS = Object.freeze(createDifficultyOptions())

export const PROBLEMS_YEAR_OPTIONS = [
  { value: '', label: '全部' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
]

export const PROBLEMS_YEAR_CATALOG_OPTIONS = [
  { value: '', label: '全部' },
  ...Array.from({ length: 2026 - 1978 + 1 }, (_, index) => {
    const year = String(2026 - index)
    return { value: year, label: year }
  }),
]

export const PROBLEMS_SOURCE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'national-new-1', label: '新高考Ⅰ卷' },
  { value: 'national-new-2', label: '新高考Ⅱ卷' },
  { value: 'gaokao-beijing', label: '北京卷' },
  { value: 'gaokao-tianjin', label: '天津卷' },
  { value: 'mock', label: '模拟卷' },
]

export const PROBLEMS_SOURCE_GROUP_LABELS = Object.freeze({
  national: '全国卷',
  provincial: '地方卷',
  mock: '模拟卷',
  textbook: '教材',
  other: '其他',
})

const SOURCE_GROUP_ORDER = ['national', 'provincial', 'mock', 'textbook', 'other']
const LEGACY_SOURCE_PLACEHOLDERS = new Set(['local'])

export function buildSourceCatalogOptions(sources, allOption = { value: '', label: '全部' }) {
  const real = sources.filter(
    (option) => option?.value && !LEGACY_SOURCE_PLACEHOLDERS.has(option.value),
  )
  const counts = new Map()
  real.forEach((option) => counts.set(option.groupCode, (counts.get(option.groupCode) || 0) + 1))
  const groupOptions = SOURCE_GROUP_ORDER.filter((group) => (counts.get(group) || 0) > 1).map(
    (group) => ({
      value: group,
      label: `全部${PROBLEMS_SOURCE_GROUP_LABELS[group]}`,
      groupCode: group,
    }),
  )
  return [allOption, ...groupOptions, ...real]
}

// Real source codes only; group entries are filter values, never a problem's own source.
export const PROBLEMS_SOURCE_CATALOG_ENTRIES = [
  { value: 'national-new-1', label: '新高考Ⅰ卷', groupCode: 'national' },
  { value: 'national-new-2', label: '新高考Ⅱ卷', groupCode: 'national' },
  { value: 'national-a', label: '全国甲卷', groupCode: 'national' },
  { value: 'national-b', label: '全国乙卷', groupCode: 'national' },
  { value: 'gaokao-beijing', label: '北京卷', groupCode: 'provincial' },
  { value: 'gaokao-tianjin', label: '天津卷', groupCode: 'provincial' },
  { value: 'gaokao-shanghai', label: '上海卷', groupCode: 'provincial' },
  { value: 'gaokao-zhejiang', label: '浙江卷', groupCode: 'provincial' },
  { value: 'mock', label: '模拟卷', groupCode: 'mock' },
]

export const PROBLEMS_SOURCE_CATALOG_OPTIONS = buildSourceCatalogOptions(
  PROBLEMS_SOURCE_CATALOG_ENTRIES,
)

export const PROBLEMS_TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'single-choice', label: '单选题' },
  { value: 'multiple-choice', label: '多选题' },
  { value: 'fill-blank', label: '填空题' },
  { value: 'solution', label: '解答题' },
]

export const PROBLEMS_TYPE_CATALOG_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'single-choice', label: '单项选择题' },
  { value: 'multiple-choice', label: '多项选择题' },
  { value: 'fill-blank', label: '填空题' },
  { value: 'solution', label: '解答题' },
]

export const DEFAULT_PROBLEMS_PINNED_FILTERS = {
  year: PROBLEMS_YEAR_OPTIONS.slice(1).map((option) => option.value),
  source: PROBLEMS_SOURCE_OPTIONS.slice(1).map((option) => option.value),
  type: PROBLEMS_TYPE_OPTIONS.slice(1).map((option) => option.value),
}

export function normalizeProblemSort(value) {
  const isSupported = PROBLEMS_SORT_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : DEFAULT_PROBLEMS_SORT
}

export function normalizeProblemLevel(value) {
  const isSupported = PROBLEMS_LEVEL_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : ''
}

export function normalizeProblemYear(value) {
  const isSupported = PROBLEMS_YEAR_CATALOG_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : ''
}

export function normalizeProblemSource(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (normalized === 'local') return 'provincial'
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(normalized) ? normalized : ''
}

export function normalizeProblemType(value) {
  const isSupported = PROBLEMS_TYPE_CATALOG_OPTIONS.some((option) => option.value === value)
  return isSupported ? value : ''
}
