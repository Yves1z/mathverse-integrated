import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_BAR_WIDTH_PERCENT,
  PRACTICE_LIST_SORT_MODES,
  PRACTICE_LIST_DISPLAY_DEFAULTS,
  buildPracticeListChartRows,
  buildProgressGradient,
  normalizePracticeListDisplay,
  normalizePracticeListSort,
  parsePracticeListTitle,
} from './practiceListChart.js'

test('缺省与非法配置回落到内置默认值', () => {
  const fallback = normalizePracticeListDisplay(null)
  assert.equal(fallback.heading, PRACTICE_LIST_DISPLAY_DEFAULTS.heading)
  assert.equal(fallback.baseColor, PRACTICE_LIST_DISPLAY_DEFAULTS.baseColor)
  assert.equal(fallback.barHeight, PRACTICE_LIST_DISPLAY_DEFAULTS.barHeight)
  assert.equal(fallback.blendPercent, PRACTICE_LIST_DISPLAY_DEFAULTS.blendPercent)
  assert.equal(fallback.textColor, PRACTICE_LIST_DISPLAY_DEFAULTS.textColor)

  // 字段缺失时必须回落到默认值，而不是被夹到区间下限（那会让过渡宽度变成 0）。
  const partial = normalizePracticeListDisplay({ heading: '精选题单' })
  assert.equal(partial.barHeight, PRACTICE_LIST_DISPLAY_DEFAULTS.barHeight)
  assert.equal(partial.blendPercent, PRACTICE_LIST_DISPLAY_DEFAULTS.blendPercent)

  const clamped = normalizePracticeListDisplay({
    heading: '   ',
    baseColor: 'not-a-color',
    progressColor: '#12345',
    textColor: '#aabbcc',
    barHeight: 9999,
    blendPercent: -5,
    sortDirection: 'sideways',
    showProblemCount: false,
  })
  assert.equal(clamped.heading, PRACTICE_LIST_DISPLAY_DEFAULTS.heading)
  assert.equal(clamped.baseColor, PRACTICE_LIST_DISPLAY_DEFAULTS.baseColor)
  assert.equal(clamped.progressColor, PRACTICE_LIST_DISPLAY_DEFAULTS.progressColor)
  assert.equal(clamped.textColor, '#aabbcc')
  assert.equal(clamped.barHeight, 120)
  assert.equal(clamped.blendPercent, 0)
  assert.equal(clamped.sortDirection, 'asc')
  assert.equal(clamped.showProblemCount, false)
})

test('进度渐变在分界处平滑过渡，没有硬边', () => {
  const middle = buildProgressGradient({
    percent: 50,
    baseColor: '#dbe9f7',
    progressColor: '#a9c9e8',
    blendPercent: 8,
  })
  assert.equal(
    middle,
    'linear-gradient(90deg, #a9c9e8 0%, #a9c9e8 42%, #dbe9f7 58%, #dbe9f7 100%)',
  )
  // 颜色分界出现在两个不同位置，说明是渐变而不是两段拼接。
  assert.notEqual(middle.indexOf('#a9c9e8 42%'), -1)
  assert.notEqual(middle.indexOf('#dbe9f7 58%'), -1)

  const empty = buildProgressGradient({
    percent: 0,
    baseColor: '#dbe9f7',
    progressColor: '#a9c9e8',
    blendPercent: 8,
  })
  assert.equal(empty, 'linear-gradient(90deg, #dbe9f7 0%, #dbe9f7 100%)')

  const full = buildProgressGradient({
    percent: 10,
    baseColor: '#dbe9f7',
    progressColor: '#a9c9e8',
    blendPercent: 30,
  })
  // 过渡带宽不会超过已完成比例，避免低进度被高估。
  assert.equal(full, 'linear-gradient(90deg, #a9c9e8 0%, #a9c9e8 0%, #dbe9f7 20%, #dbe9f7 100%)')
})

test('每条题单一行，按题目数量排序并按最长题单换算宽度', () => {
  const lists = [
    { id: 'b', problemCount: 10, completedCount: 5, title: '函数' },
    { id: 'a', problemCount: 20, completedCount: 20, title: '集合' },
    { id: 'c', problemCount: 5, completedCount: 0, title: '三角' },
  ]
  const ascending = buildPracticeListChartRows(lists, { sortDirection: 'asc', blendPercent: 8 })
  assert.deepEqual(ascending.map((row) => row.id), ['c', 'b', 'a'])
  assert.equal(ascending[0].widthPercent, 25)
  assert.equal(ascending[1].widthPercent, 50)
  assert.equal(ascending[2].widthPercent, 100)
  assert.equal(ascending[1].percent, 50)

  // 极短题单抬到可读的最小宽度，避免标签被压成一条细线。
  const floored = buildPracticeListChartRows(
    [
      { id: 'tiny', problemCount: 1, completedCount: 0, title: '复数' },
      { id: 'big', problemCount: 20, completedCount: 0, title: '导数' },
    ],
    {},
  )
  assert.equal(floored[0].widthPercent, MIN_BAR_WIDTH_PERCENT)
  assert.equal(floored[1].widthPercent, 100)

  const descending = buildPracticeListChartRows(lists, { sortDirection: 'desc' })
  assert.deepEqual(descending.map((row) => row.id), ['a', 'b', 'c'])

  // 已完成数超过题目数量时不会溢出百分比。
  const overflow = buildPracticeListChartRows(
    [{ id: 'x', problemCount: 4, completedCount: 9, title: '复数' }],
    {},
  )
  assert.equal(overflow[0].percent, 100)
  assert.equal(overflow[0].completedCount, 4)
})

test('空题单列表不产生数据行', () => {
  assert.deepEqual(buildPracticeListChartRows([], {}), [])
  assert.deepEqual(buildPracticeListChartRows(null, {}), [])
})

test('题单标题按「主题·难度」解析', () => {
  assert.deepEqual(parsePracticeListTitle('立体几何·提高'), {
    topic: '立体几何',
    level: '提高',
    levelRank: 1,
  })
  assert.deepEqual(parsePracticeListTitle('圆锥曲线·压轴'), {
    topic: '圆锥曲线',
    level: '压轴',
    levelRank: 2,
  })
  // 没有难度后缀时按主题处理，排在有难度的之后。
  assert.deepEqual(parsePracticeListTitle('综合练习'), {
    topic: '综合练习',
    level: '',
    levelRank: 3,
  })
  // 未知难度同样排在已知难度之后。
  assert.equal(parsePracticeListTitle('导数·拓展').levelRank, 3)
})

test('排序偏好缺省时回落到按数量与默认方向', () => {
  assert.deepEqual(normalizePracticeListSort(null), { mode: 'count', direction: 'asc' })
  assert.deepEqual(normalizePracticeListSort({ mode: '不存在' }, 'desc'), {
    mode: 'count',
    direction: 'desc',
  })
  assert.deepEqual(normalizePracticeListSort({ mode: 'name', direction: '倒序' }, 'asc'), {
    mode: 'name',
    direction: 'asc',
  })
  assert.deepEqual(PRACTICE_LIST_SORT_MODES, ['name', 'count', 'progress', 'level'])
})

const SORT_SAMPLE = [
  { id: '1', title: '立体几何·基础', problemCount: 3, completedCount: 3 },
  { id: '2', title: '导数·基础', problemCount: 9, completedCount: 0 },
  { id: '3', title: '导数·提高', problemCount: 20, completedCount: 10 },
  { id: '4', title: '立体几何·提高', problemCount: 20, completedCount: 5 },
  { id: '5', title: '立体几何·压轴', problemCount: 22, completedCount: 0 },
  { id: '6', title: '圆锥曲线·基础', problemCount: 32, completedCount: 8 },
  { id: '7', title: '导数·压轴', problemCount: 36, completedCount: 36 },
  { id: '8', title: '圆锥曲线·提高', problemCount: 36, completedCount: 18 },
  { id: '9', title: '圆锥曲线·压轴', problemCount: 38, completedCount: 19 },
]

function sortedTitles(sort) {
  return buildPracticeListChartRows(SORT_SAMPLE, {}, sort).map((row) => row.title)
}

test('按名称排序时同一主题连在一起，组内按基础→提高→压轴', () => {
  const titles = sortedTitles({ mode: 'name', direction: 'asc' })

  for (const topic of ['立体几何', '导数', '圆锥曲线']) {
    const start = titles.indexOf(`${topic}·基础`)
    assert.notEqual(start, -1)
    assert.deepEqual(titles.slice(start, start + 3), [
      `${topic}·基础`,
      `${topic}·提高`,
      `${topic}·压轴`,
    ])
  }
})

test('按数量排序与现有行为一致', () => {
  const counts = buildPracticeListChartRows(SORT_SAMPLE, {}, {
    mode: 'count',
    direction: 'asc',
  }).map((row) => row.problemCount)
  assert.deepEqual(counts, [...counts].sort((a, b) => a - b))
})

test('按完成程度排序使用百分比而非绝对题数', () => {
  const percents = buildPracticeListChartRows(SORT_SAMPLE, {}, {
    mode: 'progress',
    direction: 'asc',
  }).map((row) => row.percent)

  assert.deepEqual(percents, [...percents].sort((a, b) => a - b))
  // 3/3 虽然题数最少，但完成度 100% 应排在最后。
  assert.equal(sortedTitles({ mode: 'progress', direction: 'asc' }).at(-1), '立体几何·基础')
})

test('按难度排序先聚基础再提高再压轴', () => {
  const ranks = buildPracticeListChartRows(SORT_SAMPLE, {}, {
    mode: 'level',
    direction: 'asc',
  }).map((row) => row.levelRank)

  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b))
})

test('倒序会整体反转排序结果', () => {
  const ascending = sortedTitles({ mode: 'name', direction: 'asc' })
  const descending = sortedTitles({ mode: 'name', direction: 'desc' })
  assert.deepEqual(descending, [...ascending].reverse())

  const counts = buildPracticeListChartRows(SORT_SAMPLE, {}, {
    mode: 'count',
    direction: 'desc',
  }).map((row) => row.problemCount)
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a))
})
