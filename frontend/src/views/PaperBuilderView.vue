<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiRequest } from '../services/apiClient.js'
import { useRoute, useRouter } from 'vue-router'
import { readPapers, savePaper } from '../services/paperLibrary.js'
import MathText from '../components/content/MathText.vue'
import PaperSheetView from '../components/paper/PaperSheetView.vue'
import { listProblems } from '../services/problemService.js'
import ProblemsFilterPanel from '../components/problems/ProblemsFilterPanel.vue'
import { useProblemsQuery } from '../composables/useProblemsQuery.js'
import { useProblemsFilterPreferences } from '../composables/useProblemsFilterPreferences.js'
import { useDifficultyScheme } from '../composables/useDifficultyScheme.js'
import { usePaperSheet } from '../composables/usePaperSheet.js'
import {
  PROBLEMS_TYPE_CATALOG_OPTIONS,
  PROBLEMS_YEAR_CATALOG_OPTIONS,
  PROBLEMS_SOURCE_CATALOG_OPTIONS,
  PROBLEMS_SORT_OPTIONS,
} from '../config/problems.js'
import {
  cleanPaperProblem,
  paperType,
  cleanScore,
  groupPaperItems,
  DRAFT_KEY,
  restorePaperDraft,
} from '../utils/paperLayout.js'
import '../assets/styles/paper-builder.css'

const { levelOptions: difficultyLevelOptions } = useDifficultyScheme()

const route = useRoute()
const router = useRouter()
const paperId = route.params.id
const sharedId = route.params.resourceId
const sharedError = ref('')
const windowWidth = ref(window.innerWidth)
function updateWindowWidth() {
  windowWidth.value = window.innerWidth
}
const leftTab = ref('filters')
const settingsOpen = ref(false)
const moreOpen = ref(false)
const sizeLabel = computed(() => (size.value === 'a4' ? 'A4' : '16 开'))
const editorHead = ref(null)
const editorHeadHeight = ref(56)
const advancedFilters = ref(false)
const targetScore = ref(150)
const dragPosition = ref({ x: 0, y: 0 })
const searchText = ref('')
const saveFlash = ref('')
let saveFlashTimer = 0
function searchProblems() {
  updateKeyword(searchText.value)
}
const workbench = ref(null)
// 筛选列用固定像素宽（可拖），题库和卷面按比例分掉剩余空间——
// 原来的三列 fr 比例会被各自的最小宽度带偏，卷面拿不到它该有的宽度。
const COLUMNS_KEY = 'mathverse:paper-columns:v2'
const COLUMN_MIN = { filter: 160, bank: 240, editor: 320 }
const DEFAULT_FILTER_WIDTH = 216
// 题库 38 : 卷面 62 —— 组卷时卷面才是主角，题库保持和旧版差不多宽即可
const DEFAULT_BANK_SPLIT = [0.38, 0.62]
const filterWidth = ref(DEFAULT_FILTER_WIDTH)
const bankSplit = ref([...DEFAULT_BANK_SPLIT])
const resizing = ref(false)
const columnStyle = computed(() => {
  // Sub-unit fr tracks leave unused space when another track hits its minimum.
  // Keep proportions, but give every track a flex factor of at least one.
  const unit = Math.min(...bankSplit.value)
  return {
    '--filter-width': `${filterWidth.value}px`,
    '--bank-fr': `${bankSplit.value[0] / unit}fr`,
    '--editor-fr': `${bankSplit.value[1] / unit}fr`,
  }
})
let resizeSession = null
function saveColumns() {
  try {
    localStorage.setItem(
      COLUMNS_KEY,
      JSON.stringify({ filter: filterWidth.value, split: bankSplit.value }),
    )
  } catch {
    /* Optional preference. */
  }
}
function resetColumns() {
  filterWidth.value = DEFAULT_FILTER_WIDTH
  bankSplit.value = [...DEFAULT_BANK_SPLIT]
  saveColumns()
}
function columnWidths() {
  return ['.paper-filter-sidebar', '.paper-bank', '.paper-editor'].map(
    (selector) => workbench.value?.querySelector(selector)?.getBoundingClientRect().width ?? 0,
  )
}
function setFilterWidth(value) {
  const element = workbench.value
  if (!element) return
  const style = getComputedStyle(element)
  const inner = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const max = Math.max(COLUMN_MIN.filter, inner - 16 - COLUMN_MIN.bank - COLUMN_MIN.editor)
  filterWidth.value = Math.max(COLUMN_MIN.filter, Math.min(max, Math.round(value)))
}
function setBankWidth(value, total) {
  if (!total) return
  const bank = Math.max(COLUMN_MIN.bank, Math.min(total - COLUMN_MIN.editor, value))
  bankSplit.value = [bank / total, (total - bank) / total]
}
function applyResize(session, delta) {
  if (session.pair === 0) setFilterWidth(session.filterWidth + delta)
  else setBankWidth(session.bank + delta, session.bank + session.editor)
}
function beginResize(event, pair) {
  if (event.button !== 0) return
  const widths = columnWidths()
  resizeSession = {
    pair,
    startX: event.clientX,
    filterWidth: filterWidth.value,
    bank: widths[1],
    editor: widths[2],
  }
  resizing.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
  event.preventDefault()
}
function resizeColumns(event) {
  if (resizeSession) applyResize(resizeSession, event.clientX - resizeSession.startX)
}
function endResize() {
  if (!resizeSession) return
  resizeSession = null
  resizing.value = false
  saveColumns()
}
function nudgeColumn(pair, delta) {
  const widths = columnWidths()
  applyResize({ pair, filterWidth: filterWidth.value, bank: widths[1], editor: widths[2] }, delta)
  saveColumns()
}
const title = ref('数学练习卷'),
  size = ref('16k'),
  items = ref([]),
  history = ref([])
const preview = ref(!!sharedId),
  message = ref(''),
  storageMessage = ref('草稿仅保存在此浏览器')
const activeId = ref(''),
  drag = ref(null),
  dropIndex = ref(-1)
const {
  workspace,
  bindCanvas,
  bindMeasure,
  pages,
  layingOut,
  layoutError,
  printing,
  zoom,
  autoFit,
  sheet,
  sheetStyle,
  sections,
  totalScore,
  headingFor,
  showScoreFor,
  fit,
  fitWidth,
  stepZoom,
  queueLayout,
  printPaper,
} = usePaperSheet({
  items,
  title,
  size,
  fitRange: [0.28, 1],
  layoutGuard: () => Boolean(drag.value),
  onPrintError: (text) => {
    message.value = text
  },
})
const available = ref([]),
  total = ref(0),
  currentPage = ref(1),
  loading = ref(false),
  loadError = ref('')
const query = useProblemsQuery('paper')
const { clearFilters, updateKeyword, updateYear, updateSource, updateType, updateLevel } = query
const filters = computed(() => ({
  keyword: query.keyword.value,
  types: query.questionTypes.value,
  tags: query.tags.value,
  levels: query.levels.value,
  years: query.years.value,
  sources: query.sources.value,
  chapters: query.chapters.value,
  learned: query.learned.value,
  learning: query.learning.value,
}))
const hiddenFilterCount = computed(
  () =>
    filters.value.years.length +
    filters.value.sources.length +
    filters.value.learned.length +
    filters.value.chapters.length +
    (filters.value.learning ? 1 : 0),
)
const { filterMode, pinnedFilters, setFilterMode, setFilterPinned } = useProblemsFilterPreferences()
const visibleYearOptions = computed(() =>
  PROBLEMS_YEAR_CATALOG_OPTIONS.filter(
    (o) => !o.value || pinnedFilters.value.year.includes(o.value),
  ),
)
const visibleSourceOptions = computed(() =>
  PROBLEMS_SOURCE_CATALOG_OPTIONS.filter(
    (o) => !o.value || pinnedFilters.value.source.includes(o.value),
  ),
)
const visibleTypeOptions = computed(() =>
  PROBLEMS_TYPE_CATALOG_OPTIONS.filter(
    (o) => !o.value || pinnedFilters.value.type.includes(o.value),
  ),
)
function updateFilterMode(mode) {
  setFilterMode(mode)
  if (mode === 'single') query.collapseFiltersToSingle()
}
const sort = ref('newest'),
  seed = ref(crypto.randomUUID())
const expandedSources = ref(new Set())
function toggleSource(id) {
  const expanded = new Set(expandedSources.value)
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
  expandedSources.value = expanded
}
watch(
  () => filters.value.keyword,
  (value) => {
    searchText.value = value
  },
  { immediate: true },
)
// 窄屏下筛选变成浮在内容上的抽屉（≤1250 就收，三列硬挤的区间比原来更长）
const narrowScreen = window.matchMedia('(max-width: 1250px)')
const filterOpen = ref(!narrowScreen.matches)
const filterDrawer = ref(narrowScreen.matches)
const activeIndex = computed(() =>
  items.value.findIndex((item) => item.problem.id === activeId.value),
)
const scoreStatus = computed(() =>
  !targetScore.value
    ? ''
    : totalScore.value === targetScore.value
      ? '已达到目标分数'
      : totalScore.value < targetScore.value
        ? `还差 ${targetScore.value - totalScore.value} 分`
        : `超出 ${totalScore.value - targetScore.value} 分`,
)
const activeSection = computed(() =>
  sections.value.find((group) => group.entries.some((entry) => entry.index === activeIndex.value)),
)
function batchScore(group, event) {
  checkpoint()
  const score = cleanScore(event.target.value, group.score)
  group.entries.forEach(({ item }) => {
    item.score = score
  })
  event.target.value = score
}
function setTarget(event) {
  checkpoint()
  const value = Number(event.target.value)
  targetScore.value = Number.isFinite(value)
    ? Math.max(0, Math.min(1000, Math.round(value * 2) / 2))
    : 150
  event.target.value = targetScore.value
}
const selectedIds = computed(() => new Set(items.value.map((i) => i.problem.id)))
function adaptFilters(event) {
  filterDrawer.value = event.matches
  filterOpen.value = !event.matches
}
const state = () => ({
  version: 1,
  title: title.value,
  size: size.value,
  items: items.value,
  targetScore: targetScore.value,
})
let request,
  requestId = 0,
  searchTimer,
  resizeObserver,
  saveTimer,
  scrollFrame,
  lastDragY = 0
let disposed = false

function checkpoint() {
  history.value = [...history.value.slice(-19), JSON.stringify(state())]
}
function undo() {
  const previous = history.value.at(-1)
  if (!previous) return
  const restored = restorePaperDraft(previous)
  history.value = history.value.slice(0, -1)
  title.value = restored.title
  size.value = restored.size
  items.value = restored.items
  targetScore.value = restored.targetScore
  message.value = '已撤销上一步'
}
async function load(page = 1) {
  clearTimeout(searchTimer)
  request?.abort()
  request = new AbortController()
  const id = ++requestId
  loading.value = true
  loadError.value = ''
  available.value = []
  try {
    const result = await listProblems(
      { ...filters.value, sort: sort.value, seed: seed.value, page, pageSize: 12 },
      { signal: request.signal },
    )
    if (id !== requestId || disposed) return
    available.value = result.items
    total.value = result.pagination.total
    currentPage.value = page
  } catch (e) {
    if (id === requestId && e.name !== 'AbortError')
      loadError.value = e.message || '题库读取失败，请重试'
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch(
  [filters, sort, seed],
  () => {
    request?.abort()
    requestId++
    loading.value = true
    available.value = []
    total.value = 0
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => load(), 250)
  },
  { deep: true },
)
function shuffle() {
  sort.value = 'random'
  seed.value = crypto.randomUUID()
}
function add(problem, index = items.value.length) {
  if (selectedIds.value.has(problem.id)) {
    locate(problem.id)
    return
  }
  if (items.value.length >= 100) {
    message.value = '一份试卷最多添加 100 题'
    return
  }
  checkpoint()
  items.value.splice(index, 0, {
    problem: cleanPaperProblem(problem),
    space: 0,
    breakBefore: false,
    score: paperType(problem.type).score,
  })
  items.value = groupPaperItems(items.value)
  activeId.value = problem.id
  message.value = `已加入${paperType(problem.type).label}，默认 ${paperType(problem.type).score} 分，可修改`
}
function remove(index) {
  checkpoint()
  items.value.splice(index, 1)
  message.value = '已移除题目，可撤销'
}
function move(from, to) {
  if (to < 0 || to >= items.value.length || from === to) return
  if (
    paperType(items.value[from].problem.type).type !== paperType(items.value[to].problem.type).type
  ) {
    message.value = '请在同一题型内调整顺序'
    return
  }
  checkpoint()
  const [item] = items.value.splice(from, 1)
  items.value.splice(to, 0, item)
}
function changeItem(index, field, value) {
  checkpoint()
  items.value[index][field] =
    field === 'score' ? cleanScore(value, items.value[index].score) : value
}
function setQuestionScore(event) {
  const score = cleanScore(event.target.value, items.value[activeIndex.value].score)
  changeItem(activeIndex.value, 'score', score)
  event.target.value = score
}
function clearPaper() {
  if (!items.value.length) return
  if (!window.confirm(`清空试卷？卷面上的 ${items.value.length} 道题会被移除，清空后可以撤销。`))
    return
  checkpoint()
  items.value = []
  message.value = '已清空试卷，可撤销'
}
function resetZoom() {
  autoFit.value = false
  zoom.value = 1
}
function locate(id) {
  activeId.value = id
  workspace.value
    ?.querySelector(`[data-paper-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
let pendingDrag = null
let dragBoundaries = []
let edgeSince = 0,
  edgeDirection = 0,
  edgeFrame = 0
function rememberDragOrigin(event) {
  if (
    event.button !== 0 ||
    event.pointerType === 'touch' ||
    preview.value ||
    layingOut.value ||
    event.target.closest('button:not(.paper-grip), input, select, a')
  )
    return
  // 卷面里的 pointerdown 由 PaperSheetView 透传过来，currentTarget 已失效，改用 target。
  const source = event.target.closest('[data-source-id]')
  const id = event.target.closest('[data-paper-id]')?.dataset.paperId
  const from = source
    ? -1
    : id
      ? items.value.findIndex((item) => item.problem.id === id)
      : activeIndex.value
  const problem = source
    ? available.value.find((item) => item.id === source.dataset.sourceId)
    : items.value[from]?.problem
  if (!problem) return
  pendingDrag = { problem, from, x: event.clientX, y: event.clientY, pointerId: event.pointerId }
}
function collectBoundaries() {
  const box = workspace.value.getBoundingClientRect()
  const nodes = [...workspace.value.querySelectorAll('.paper-fragment')]
  const result = []
  items.value.forEach((item, index) => {
    const parts = nodes.filter((node) => node.dataset.paperId === item.problem.id)
    if (!parts.length) return
    result.push({
      index,
      y: parts[0].getBoundingClientRect().top - box.top + workspace.value.scrollTop,
    })
    result.push({
      index: index + 1,
      y: parts.at(-1).getBoundingClientRect().bottom - box.top + workspace.value.scrollTop,
    })
  })
  return result
}
const allowedDropRange = computed(() => {
  if (!drag.value) return [0, items.value.length]
  const type = paperType(drag.value.problem.type).type
  const group = sections.value.find((section) => section.type === type)
  if (group) return [group.entries[0].index, group.entries.at(-1).index + 1]
  const marker = { problem: drag.value.problem }
  const index = groupPaperItems([...items.value, marker]).indexOf(marker)
  return [index, index]
})
function allowedBoundary(index) {
  return index >= allowedDropRange.value[0] && index <= allowedDropRange.value[1]
}
function pointerMove(event) {
  if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return
  if (!drag.value) {
    if (Math.hypot(event.clientX - pendingDrag.x, event.clientY - pendingDrag.y) < 10) return
    drag.value = { problem: pendingDrag.problem, from: pendingDrag.from }
    dragBoundaries = collectBoundaries()
    window.getSelection()?.removeAllRanges()
    scrollFrame = requestAnimationFrame(scrollDrag)
  }
  event.preventDefault()
  dragPosition.value = { x: event.clientX, y: event.clientY }
  lastDragY = event.clientY
  updatePointerTarget()
}
function updatePointerTarget() {
  const { x, y } = dragPosition.value
  const hit = document.elementFromPoint(x, y)
  const row = hit?.closest('.paper-outline-item')
  if (row) {
    const index =
      Number(row.dataset.index) +
      (y > row.getBoundingClientRect().top + row.offsetHeight / 2 ? 1 : 0)
    dropIndex.value = allowedBoundary(index) ? index : -1
    return
  }
  if (!hit?.closest('.paper-canvas')) {
    dropIndex.value = -1
    return
  }
  if (!items.value.length) {
    dropIndex.value = 0
    return
  }
  const box = workspace.value.getBoundingClientRect()
  const position = y - box.top + workspace.value.scrollTop
  const candidates = dragBoundaries.filter((boundary) => allowedBoundary(boundary.index))
  const closest = candidates.reduce(
    (best, boundary) =>
      !best || Math.abs(boundary.y - position) < Math.abs(best.y - position) ? boundary : best,
    null,
  )
  if (!closest) {
    dropIndex.value = -1
    return
  }
  const oldDistance = Math.min(
    ...candidates
      .filter((boundary) => boundary.index === dropIndex.value)
      .map((boundary) => Math.abs(boundary.y - position)),
  )
  if (dropIndex.value < 0 || Math.abs(closest.y - position) + 18 < oldDistance)
    dropIndex.value = closest.index
}
function pointerUp(event) {
  if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return
  if (drag.value && dropIndex.value >= 0) {
    const { problem, from } = drag.value,
      index = dropIndex.value
    endDrag()
    if (from < 0) add(problem, index)
    else move(from, from < index ? index - 1 : index)
  } else endDrag()
}
function endDrag() {
  pendingDrag = null
  drag.value = null
  dropIndex.value = -1
  edgeSince = 0
  edgeDirection = 0
  edgeFrame = 0
  cancelAnimationFrame(scrollFrame)
}
function scrollDrag(time) {
  if (!drag.value || !workspace.value) return
  const box = workspace.value.getBoundingClientRect(),
    { x } = dragPosition.value
  const direction =
    x >= box.left && x <= box.right && lastDragY >= box.top && lastDragY <= box.bottom
      ? lastDragY < box.top + 36
        ? -1
        : lastDragY > box.bottom - 36
          ? 1
          : 0
      : 0
  if (direction !== edgeDirection) {
    edgeSince = time
    edgeDirection = direction
  }
  if (direction && time - edgeSince > 450) {
    const speed = Math.min(180, 40 + (time - edgeSince - 450) / 8)
    workspace.value.scrollTop +=
      (direction * speed * Math.min(32, time - (edgeFrame || time))) / 1000
    updatePointerTarget()
  }
  edgeFrame = time
  scrollFrame = requestAnimationFrame(scrollDrag)
}
function persist() {
  if (sharedId) return false
  try {
    if (paperId) savePaper(paperId, state())
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(state()))
    storageMessage.value = '草稿已保存在此浏览器'
    return true
  } catch {
    storageMessage.value = '浏览器存储不可用，离开页面可能丢失草稿'
    return false
  }
}

function saveNow() {
  const saved = persist()
  if (!saved) return

  message.value = '试卷已保存'
  saveFlash.value = '已保存'
  window.clearTimeout(saveFlashTimer)
  saveFlashTimer = window.setTimeout(() => {
    saveFlash.value = ''
  }, 1600)
}
function moreSave() {
  moreOpen.value = false
  saveNow()
}
function openSettings() {
  moreOpen.value = false
  settingsOpen.value = !settingsOpen.value
}
function closeMoreOnOutside(event) {
  if (moreOpen.value && !event.target.closest?.('.paper-more')) moreOpen.value = false
}
watch(
  [items, title, size, targetScore],
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 250)
  },
  { deep: true },
)
watch(preview, () => nextTick(fit))
// 「我的试卷」卡片上的「导出 PDF」带着 ?print=1 进来：等卷面排好版再唤起打印，
// 打印结束（含取消）后自动回到「我的试卷」。
const exportRequested = route.query.print === '1'
let exportPrinted = false
watch([layingOut, printing, () => items.value.length], () => {
  if (!exportRequested || exportPrinted || layingOut.value || printing.value) return
  if (!items.value.length) return
  exportPrinted = true
  void printPaper().finally(() => {
    if (exportRequested) router.replace({ name: 'paper-library' })
  })
})
function keydown(event) {
  if (drag.value) {
    if (event.key === 'Escape') endDrag()
    event.preventDefault()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault()
    if (items.value.length && !layingOut.value && !printing.value) printPaper()
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (!sharedId) saveNow()
  }
  if (event.key === 'Escape') {
    if (!sharedId) preview.value = false
    if (settingsOpen.value) settingsOpen.value = false
    else if (filterDrawer.value && filterOpen.value) filterOpen.value = false
    else activeId.value = ''
    endDrag()
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === 'z' &&
    !event.target.closest('input,textarea,select')
  ) {
    event.preventDefault()
    if (!sharedId) undo()
  }
}
onMounted(async () => {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) || 'null')
    if (
      Number.isFinite(saved?.filter) &&
      Array.isArray(saved?.split) &&
      saved.split.length === 2 &&
      saved.split.every((value) => Number.isFinite(value) && value > 0 && value < 1) &&
      Math.abs(saved.split[0] + saved.split[1] - 1) < 0.001
    ) {
      filterWidth.value = Math.max(COLUMN_MIN.filter, Math.min(420, Math.round(saved.filter)))
      bankSplit.value = saved.split
    }
  } catch {
    /* Ignore invalid optional layout preference. */
  }
  narrowScreen.addEventListener('change', adaptFilters)
  try {
    const shared = sharedId ? await apiRequest(`/api/v1/papers/${sharedId}`) : null
    if (disposed) return
    if (sharedId && !shared?.snapshot) throw new Error('No editable snapshot')
    const saved = sharedId
      ? restorePaperDraft(JSON.stringify(shared.snapshot))
      : paperId
        ? readPapers().find((paper) => paper.id === paperId && !paper.deletedAt)?.draft
        : restorePaperDraft(localStorage.getItem(DRAFT_KEY))
    if (saved) {
      title.value = saved.title
      size.value = saved.size
      items.value = saved.items
      targetScore.value = saved.targetScore
      storageMessage.value = '已恢复此浏览器的草稿'
    }
  } catch {
    storageMessage.value = '未能读取旧草稿，当前可正常组卷'
    if (sharedId) sharedError.value = '试卷加载失败，请返回详情页重试'
  }
  if (disposed) return
  resizeObserver = new ResizeObserver(() => {
    fit()
    if (editorHead.value) editorHeadHeight.value = editorHead.value.getBoundingClientRect().height
  })
  resizeObserver.observe(workspace.value)
  resizeObserver.observe(editorHead.value)
  document.addEventListener('pointermove', pointerMove, { passive: false })
  document.addEventListener('pointerup', pointerUp)
  document.addEventListener('pointerdown', closeMoreOnOutside)
  document.addEventListener('pointercancel', endDrag)
  window.addEventListener('blur', endDrag)
  window.addEventListener('resize', updateWindowWidth)
  window.addEventListener('keydown', keydown)
  if (!sharedId) load()
})
onBeforeUnmount(() => {
  narrowScreen.removeEventListener('change', adaptFilters)
  document.removeEventListener('pointermove', pointerMove)
  document.removeEventListener('pointerup', pointerUp)
  document.removeEventListener('pointerdown', closeMoreOnOutside)
  document.removeEventListener('pointercancel', endDrag)
  window.removeEventListener('blur', endDrag)
  window.removeEventListener('resize', updateWindowWidth)
  endDrag()
  disposed = true
  request?.abort()
  resizeObserver?.disconnect()
  persist()
  clearTimeout(searchTimer)
  clearTimeout(saveTimer)
  clearTimeout(saveFlashTimer)
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('keydown', keydown)
})
</script>

<template>
  <main
    class="paper-builder"
    :class="{ 'is-preview': preview, 'is-dragging': drag, 'is-laying-out': layingOut }"
  >
    <!-- 窄屏下筛选是浮在内容上的抽屉，点遮罩关掉它 -->
    <div
      v-if="filterDrawer && filterOpen && !preview"
      class="paper-filter-scrim"
      @click="filterOpen = false"
    ></div>
    <div
      ref="workbench"
      class="paper-workbench"
      :class="{ 'filters-hidden': !filterOpen, 'is-resizing': resizing }"
      :style="columnStyle"
    >
      <aside v-show="!preview && filterOpen" class="paper-filter-sidebar" aria-label="筛选条件">
        <div class="paper-filter-title">
          <div class="paper-left-tabs">
            <button :aria-pressed="leftTab === 'filters'" @click="leftTab = 'filters'">筛选</button
            ><button :aria-pressed="leftTab === 'outline'" @click="leftTab = 'outline'">
              目录
            </button>
          </div>
          <button class="paper-link" aria-label="收起筛选" @click="filterOpen = false">
            收起 ‹
          </button>
        </div>
        <div v-show="leftTab === 'outline'" class="paper-outline">
          <p v-if="!items.length">加入题目后，这里显示题型与题号。</p>
          <section v-for="group in sections" :key="group.type">
            <h3>
              {{ group.label }} <small>{{ group.total }} 分</small>
            </h3>
            <div
              v-for="entry in group.entries"
              :key="entry.item.problem.id"
              class="paper-outline-item"
              :class="{ 'is-drop-target': dropIndex === entry.index }"
              :data-paper-id="entry.item.problem.id"
              :data-index="entry.index"
              @pointerdown="rememberDragOrigin"
            >
              <button @click="locate(entry.item.problem.id)">
                第 {{ entry.index + 1 }} 题 <small>{{ entry.item.problem.id }}</small></button
              ><span>{{ entry.item.score }} 分</span
              ><span class="paper-outline-grip" aria-hidden="true">⠿</span>
            </div>
          </section>
        </div>
        <div v-show="leftTab === 'filters'" class="paper-shared-filters">
          <ProblemsFilterPanel
            route-name="paper"
            compact
            :advanced="advancedFilters"
            :filter-mode="filterMode"
            :keyword="filters.keyword"
            :level="filters.levels"
            :level-options="difficultyLevelOptions"
            :question-type="filters.types"
            :source="filters.sources"
            :source-catalog-options="PROBLEMS_SOURCE_CATALOG_OPTIONS"
            :source-options="visibleSourceOptions"
            :source-pinned-values="pinnedFilters.source"
            :type-catalog-options="PROBLEMS_TYPE_CATALOG_OPTIONS"
            :type-options="visibleTypeOptions"
            :type-pinned-values="pinnedFilters.type"
            :year="filters.years"
            :year-catalog-options="PROBLEMS_YEAR_CATALOG_OPTIONS"
            :year-options="visibleYearOptions"
            :year-pinned-values="pinnedFilters.year"
            @search="updateKeyword"
            @clear="clearFilters"
            @filter-mode-change="updateFilterMode"
            @year-change="updateYear"
            @source-change="updateSource"
            @type-change="updateType"
            @level-change="updateLevel"
            @year-pin-change="setFilterPinned('year', $event.value, $event.pinned)"
            @source-pin-change="setFilterPinned('source', $event.value, $event.pinned)"
            @type-pin-change="setFilterPinned('type', $event.value, $event.pinned)"
          />
          <button
            class="paper-more-filters"
            :aria-expanded="advancedFilters"
            @click="advancedFilters = !advancedFilters"
          >
            {{ advancedFilters ? '收起更多条件' : '更多筛选条件'
            }}<span v-if="hiddenFilterCount"> · 已选 {{ hiddenFilterCount }} 项</span>
          </button>
        </div>
      </aside>
      <div
        v-show="!preview && filterOpen"
        class="paper-splitter splitter-0"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-label="调整筛选区和题库宽度"
        :aria-valuenow="filterWidth"
        :aria-valuetext="`${filterWidth} 像素`"
        title="拖动调整宽度，双击恢复默认"
        @pointerdown="beginResize($event, 0)"
        @pointermove="resizeColumns"
        @pointerup="endResize"
        @pointercancel="endResize"
        @lostpointercapture="endResize"
        @dblclick="resetColumns"
        @keydown.left.prevent="nudgeColumn(0, -24)"
        @keydown.right.prevent="nudgeColumn(0, 24)"
      />
      <section v-show="!preview" class="paper-bank" aria-label="选题题库">
        <div class="paper-bank-head">
          <h2>
            题库 <small>共 {{ total }} 道题</small>
          </h2>
          <button v-if="!filterOpen" class="paper-link" @click="filterOpen = true">展开筛选</button>
        </div>
        <form class="paper-search" role="search" @submit.prevent="searchProblems">
          <input
            v-model="searchText"
            type="search"
            aria-label="搜索题目"
            placeholder="搜索题号、来源或知识点…"
          /><button type="submit">搜索</button>
        </form>
        <div class="paper-sortbar">
          <span>{{ loading ? '正在筛选…' : items.length ? `已选 ${items.length} 题` : '' }}</span
          ><select v-model="sort" aria-label="题目排序">
            <option value="newest">新题优先</option>
            <option value="random">随机排序</option>
            <option
              v-for="o in PROBLEMS_SORT_OPTIONS.filter((o) => o.value !== 'newest')"
              :key="o.value"
              :value="o.value"
            >
              {{ o.label }}
            </option></select
          ><button :disabled="loading" title="对全部筛选结果重新随机排序" @click="shuffle">
            ↻ 换一批
          </button>
        </div>
        <div class="paper-bank-results" :aria-busy="loading">
          <p v-if="loadError" class="paper-error" role="alert">
            {{ loadError }} <button @click="load()">重试</button>
          </p>
          <div v-else-if="loading" class="paper-result-placeholder">正在寻找合适的题目…</div>
          <div v-else-if="!available.length" class="paper-result-placeholder">
            没有符合条件的题目<br /><button class="paper-link" @click="clearFilters">
              调整或清除筛选条件
            </button>
          </div>
          <article
            v-for="problem in available"
            :key="problem.id"
            class="paper-source-card"
            :class="{ 'is-added': selectedIds.has(problem.id) }"
            :data-source-id="problem.id"
            :draggable="false"
            @pointerdown="rememberDragOrigin"
          >
            <header>
              <span class="paper-type-chip" :data-type="problem.type">{{ problem.typeLabel }}</span>
              <span v-for="tag in problem.tags?.slice(0, 2)" :key="tag" class="paper-tag-chip">{{
                tag
              }}</span>
              <button
                v-if="selectedIds.has(problem.id)"
                class="paper-added"
                @click="locate(problem.id)"
              >
                ✓ 已加入 · {{ items.findIndex((i) => i.problem.id === problem.id) + 1 }}</button
              ><button
                v-else
                class="paper-add"
                :aria-label="`添加题目 ${problem.id}`"
                @click="add(problem)"
              >
                ＋ 加入
              </button>
              <span class="paper-grip" title="整张题卡均可拖动">⠿</span>
            </header>
            <div
              class="paper-source-content"
              :class="{
                'is-collapsed':
                  !expandedSources.has(problem.id) &&
                  (problem.content.length > 350 || problem.content.split('\n').length > 7),
              }"
            >
              <MathText :text="problem.content" choices /><img
                v-for="asset in cleanPaperProblem(problem).assets.filter(
                  (a) => !problem.content.includes(`](${a.url})`),
                )"
                :key="asset.url"
                :src="asset.url"
                :alt="asset.altText"
                loading="lazy"
                draggable="false"
              />
            </div>
            <button
              v-if="problem.content.length > 350 || problem.content.split('\n').length > 7"
              class="paper-source-expand paper-link"
              :aria-expanded="expandedSources.has(problem.id)"
              @click="toggleSource(problem.id)"
            >
              {{ expandedSources.has(problem.id) ? '收起长题 ↑' : '展开完整题目 ↓' }}
            </button>
            <p class="paper-source-meta">{{ problem.sourceText }} · {{ problem.id }}</p>
          </article>
        </div>
        <nav class="paper-pagination" aria-label="题库翻页">
          <button :disabled="loading || currentPage <= 1" @click="load(currentPage - 1)">
            上一页</button
          ><span>{{ total ? `第 ${currentPage} / ${Math.ceil(total / 12)} 页` : '没有结果' }}</span
          ><button :disabled="loading || currentPage * 12 >= total" @click="load(currentPage + 1)">
            下一页
          </button>
        </nav>
      </section>
      <div
        v-show="!preview"
        class="paper-splitter splitter-1"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-label="调整题库和试卷宽度"
        :aria-valuenow="Math.round(bankSplit[0] * 100)"
        title="拖动调整宽度，双击恢复默认"
        @pointerdown="beginResize($event, 1)"
        @pointermove="resizeColumns"
        @pointerup="endResize"
        @pointercancel="endResize"
        @lostpointercapture="endResize"
        @dblclick="resetColumns"
        @keydown.left.prevent="nudgeColumn(1, -24)"
        @keydown.right.prevent="nudgeColumn(1, 24)"
      />
      <section
        class="paper-editor"
        aria-label="试卷工作区"
        :style="{ '--editor-head-height': `${editorHeadHeight}px` }"
      >
        <div ref="editorHead" class="paper-editor-head">
          <div class="paper-doc">
            <RouterLink
              :to="
                sharedId
                  ? { name: 'shared-paper', params: { id: sharedId } }
                  : { name: 'paper-library' }
              "
              class="paper-back-library"
              >← {{ sharedId ? '试卷详情' : '我的试卷' }}</RouterLink
            >
            <h2 class="paper-sr-only">我的试卷</h2>
            <input
              class="paper-name-input"
              :readonly="!!sharedId"
              v-model="title"
              aria-label="试卷名称"
              maxlength="100"
              title="点击修改试卷名称"
              @focus="checkpoint"
            />
            <span class="paper-count paper-doc-meta">
              {{ items.length }} 题 · {{ totalScore }} 分 · {{ sizeLabel }}
            </span>
          </div>
          <div class="paper-top-actions">
            <button
              v-if="!sharedId"
              class="paper-icon-button"
              :disabled="!history.length"
              aria-label="↶ 撤销"
              title="撤销"
              @click="undo"
            >
              ↶</button
            ><span v-if="!sharedId" class="paper-more">
              <button
                class="paper-icon-button"
                :aria-expanded="moreOpen"
                aria-label="更多操作"
                title="保存状态与试卷设置"
                @click="moreOpen = !moreOpen"
              >
                ⋯
              </button>
              <div v-if="moreOpen" class="paper-more-menu">
                <p class="paper-more-state">
                  {{ saveFlash || (layingOut ? '正在排版…' : storageMessage) }}
                </p>
                <button class="paper-more-item" aria-label="保存试卷" @click="moreSave">保存</button
                ><button class="paper-more-item" aria-label="设置" @click="openSettings">
                  设置
                </button>
              </div>
            </span>
            <button v-if="!sharedId" :aria-pressed="preview" @click="preview = !preview">
              {{ preview ? '← 返回编辑' : '预览' }}</button
            ><button
              class="paper-primary"
              :disabled="!items.length || layingOut || !!layoutError || printing"
              @click="printPaper"
            >
              打印 / PDF
            </button>
          </div>
        </div>
        <div v-if="settingsOpen" class="paper-settings-scrim" @click="settingsOpen = false"></div>
        <section
          v-if="settingsOpen"
          class="paper-settings-panel"
          aria-label="试卷设置"
          @keydown.esc.stop="settingsOpen = false"
        >
          <header>
            <h3>试卷设置</h3>
            <button aria-label="关闭试卷设置" @click="settingsOpen = false">×</button>
          </header>
          <label
            >纸张尺寸<select v-model="size" aria-label="纸张尺寸" @focus="checkpoint">
              <option value="a4">A4 纵向</option>
              <option value="16k">16 开 · 原卷尺寸</option>
            </select></label
          >
          <label
            >目标分数<input
              type="number"
              min="0"
              max="1000"
              step="0.5"
              :value="targetScore"
              @change="setTarget"
          /></label>
          <p>{{ scoreStatus || '不设目标分数' }}</p>
          <div v-if="sections.length" class="paper-settings-scores">
            <h4>批量设分</h4>
            <label v-for="group in sections" :key="group.type"
              >{{ group.label
              }}<input
                type="number"
                min="0"
                max="100"
                step="0.5"
                :aria-label="`${group.label}批量分值`"
                :value="
                  group.entries.every((entry) => entry.item.score === group.entries[0].item.score)
                    ? group.entries[0].item.score
                    : ''
                "
                placeholder="混合"
                @change="batchScore(group, $event)"
            /></label>
          </div>
          <footer>
            <button class="is-danger" :disabled="!items.length" @click="clearPaper">
              清空试卷
            </button>
          </footer>
        </section>
        <div class="paper-status paper-sr-only" aria-live="polite">
          <span>{{ message }}</span
          ><span v-if="layingOut">正在排版…</span>
        </div>
        <div v-if="layoutError" class="paper-error" role="alert">
          {{ layoutError }} <button @click="queueLayout">重试排版</button>
        </div>
        <div v-if="sharedError" class="paper-error" role="alert">{{ sharedError }}</div>
        <div v-if="!preview" class="paper-item-tools" @click.stop>
          <span v-if="activeIndex < 0" class="paper-item-tools-hint">
            点选卷面上的题目，可调分值、留白与位置
          </span>
          <template v-else>
            <span class="paper-item-tools-title">第 {{ activeIndex + 1 }} 题</span
            ><label class="paper-question-score"
              >分值<input
                type="number"
                min="0"
                max="100"
                step="0.5"
                :aria-label="`第 ${activeIndex + 1} 题分值`"
                :value="items[activeIndex].score"
                @change="setQuestionScore" /></label
            ><select
              aria-label="移至题号"
              :value="activeIndex"
              @change="move(activeIndex, Number($event.target.value))"
            >
              <option
                v-for="entry in activeSection?.entries"
                :key="entry.item.problem.id"
                :value="entry.index"
              >
                移至第 {{ entry.index + 1 }} 题
              </option>
            </select>
            <select
              :value="items[activeIndex].space"
              :aria-label="`第 ${activeIndex + 1} 题答题留白`"
              @change="changeItem(activeIndex, 'space', Number($event.target.value))"
            >
              <option :value="0">无留白</option>
              <option :value="20">留白 · 少</option>
              <option :value="40">留白 · 中</option>
              <option :value="60">留白 · 多</option>
            </select>
            <button
              :aria-pressed="items[activeIndex].breakBefore"
              title="从新页开始"
              @click="changeItem(activeIndex, 'breakBefore', !items[activeIndex].breakBefore)"
            >
              另起一页</button
            ><span class="paper-item-tools-move"
              ><button
                class="paper-grip"
                :draggable="false"
                @pointerdown="rememberDragOrigin"
                title="拖动排序"
                :aria-label="`拖动第 ${activeIndex + 1} 题`"
              >
                ⠿</button
              ><button
                :disabled="activeIndex === activeSection?.entries[0].index"
                title="上移"
                @click="move(activeIndex, activeIndex - 1)"
              >
                ↑</button
              ><button
                :disabled="activeIndex === activeSection?.entries.at(-1).index"
                title="下移"
                @click="move(activeIndex, activeIndex + 1)"
              >
                ↓
              </button></span
            ><span class="paper-item-tools-end"
              ><button
                class="paper-item-tools-remove"
                :aria-label="`移除第 ${activeIndex + 1} 题`"
                @click="remove(activeIndex)"
              >
                移除</button
              ><button aria-label="取消选择题目" @click="activeId = ''">取消选择</button></span
            >
          </template>
        </div>
        <PaperSheetView
          :bind-canvas="bindCanvas"
          :bind-measure="bindMeasure"
          :pages="pages"
          :items="items"
          :sheet="sheet"
          :sheet-style="sheetStyle"
          :zoom="zoom"
          :title="title"
          :total-score="totalScore"
          :heading-for="headingFor"
          :show-score-for="showScoreFor"
          :active-id="activeId"
          :drop-index="dropIndex"
          :dragging="Boolean(drag)"
          editable
          empty-hint
          @fragment-pointerdown="rememberDragOrigin"
          @fragment-activate="activeId = $event"
        />

        <footer class="paper-workspace-footer">
          <span class="paper-save-state" :title="storageMessage">{{
            layingOut ? '正在排版…' : storageMessage
          }}</span>
          <div class="paper-zoom-controls">
            <button aria-label="缩小卷面" @click="stepZoom(-0.1)">−</button
            ><button
              class="paper-zoom-value"
              aria-label="预览缩放"
              title="点击回到 100%"
              @click="resetZoom"
            >
              {{ Math.round(zoom * 100) }}%</button
            ><button aria-label="放大卷面" @click="stepZoom(0.1)">＋</button
            ><button :aria-pressed="autoFit" @click="fitWidth">适合宽度</button>
          </div>
        </footer>
      </section>
    </div>
    <div
      v-if="drag"
      class="paper-drag-ghost"
      :style="{
        left: `${Math.min(dragPosition.x + 16, windowWidth - 270)}px`,
        top: `${dragPosition.y + 14}px`,
      }"
    >
      {{ paperType(drag.problem.type).label }} · {{ drag.problem.id
      }}<small>{{
        dropIndex < 0
          ? '移动到卷面或目录，松手取消'
          : `松手放入第 ${dropIndex + 1} 题位置（按题型归组）`
      }}</small>
    </div>
  </main>
</template>
