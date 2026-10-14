<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppPageHeader from '../components/layout/AppPageHeader.vue'
import AppPageStats from '../components/layout/AppPageStats.vue'
import { pickRandomPageQuote } from '../data/pageQuotes.js'
import { apiRequest } from '../services/apiClient.js'
import { useProblemsUserMarks } from '../composables/useProblemsUserMarks.js'
import { usePracticeListsStore } from '../stores/practiceLists.js'
import '../assets/styles/shared-papers.css'
const pageQuote = pickRandomPageQuote()
const route = useRoute(),
  router = useRouter()
const data = ref(null),
  error = ref(''),
  loading = ref(false)
const paperStats = ref({ publicPaperCount: '—', publicContributorCount: '—', totalPaperCount: '—' })
const paperStatItems = computed(() => [
  { label: '已公开试卷', value: paperStats.value.publicPaperCount },
  { label: '贡献者', value: paperStats.value.publicContributorCount },
  { label: '累计创建', value: paperStats.value.totalPaperCount },
])
async function loadPaperStats() {
  try {
    const result = await apiRequest('/api/v1/papers/stats')
    paperStats.value = {
      publicPaperCount: Number(result?.publicPaperCount) || 0,
      publicContributorCount: Number(result?.publicContributorCount) || 0,
      totalPaperCount: Number(result?.totalPaperCount) || 0,
    }
  } catch {
    // 统计接口不可用时保留占位符。
  }
}
const q = ref(String(route.query.q || '')),
  kind = ref(String(route.query.kind || '')),
  year = ref(String(route.query.year || '')),
  examMode = ref(String(route.query.examMode || '')),
  checked = ref(route.query.checked === 'true'),
  sort = ref(String(route.query.sort || 'newest'))
const scope = computed(() => String(route.query.scope || 'all'))
const practiceListsStore = usePracticeListsStore()
const { completedProblemIds, setProblemsCompleted } = useProblemsUserMarks()
const PAPER_PROBLEM_IDS_KEY = 'paper-library-problem-ids'
const favoritePaperIds = ref([])
const paperProblemIds = ref(readPaperProblemIds())
const busyPaper = ref('')
const completedProblemSet = computed(() => new Set(completedProblemIds.value))
function readPaperProblemIds() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PAPER_PROBLEM_IDS_KEY) || 'null')
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}
function rememberPaperProblems(paperId, problemIds) {
  paperProblemIds.value = { ...paperProblemIds.value, [paperId]: problemIds }
  try {
    window.localStorage.setItem(PAPER_PROBLEM_IDS_KEY, JSON.stringify(paperProblemIds.value))
  } catch {
    // 本地存储不可用时，本次会话内仍然可以标记。
  }
}
function isPaperDone(paper) {
  const problemIds = paperProblemIds.value[paper.id]
  return Boolean(problemIds?.length) && problemIds.every((id) => completedProblemSet.value.has(id))
}
function isPaperFavorite(paper) {
  return favoritePaperIds.value.includes(paper.id)
}
async function loadFavoritePapers() {
  if (!practiceListsStore.authenticated) return
  try {
    const result = await apiRequest('/api/v1/papers?' + new URLSearchParams({ scope: 'favorites' }))
    favoritePaperIds.value = (result.items || []).map((item) => item.id)
  } catch {
    // 取不到收藏状态时按未收藏显示，不影响浏览。
  }
}
function requireLogin() {
  if (practiceListsStore.authenticated) return true
  router.push({ name: 'login', query: { redirect: route.fullPath } })
  return false
}
async function toggleFavorite(paper) {
  if (busyPaper.value || !requireLogin()) return
  const favorite = !isPaperFavorite(paper)
  busyPaper.value = paper.id
  error.value = ''
  try {
    await apiRequest(`/api/v1/papers/${paper.id}/favorite`, {
      method: 'PUT',
      body: { favorite },
    })
    favoritePaperIds.value = favorite
      ? [...favoritePaperIds.value, paper.id]
      : favoritePaperIds.value.filter((id) => id !== paper.id)
    paper.favorite_count = Math.max(0, (paper.favorite_count || 0) + (favorite ? 1 : -1))
  } catch (e) {
    error.value = e.message
  } finally {
    busyPaper.value = ''
  }
}
async function togglePaperDone(paper) {
  if (busyPaper.value) return
  busyPaper.value = paper.id
  error.value = ''
  try {
    const completed = !isPaperDone(paper)
    let problemIds = paperProblemIds.value[paper.id]
    if (!problemIds) {
      const detail = await apiRequest(`/api/v1/papers/${paper.id}`)
      problemIds = (detail.snapshot?.items || []).map((item) => item.problem?.id).filter(Boolean)
      if (!problemIds.length) {
        error.value = '这份试卷没有可标记的题目'
        return
      }
      rememberPaperProblems(paper.id, problemIds)
    }
    setProblemsCompleted(problemIds, completed)
  } catch (e) {
    error.value = e.message
  } finally {
    busyPaper.value = ''
  }
}
watch(
  () => practiceListsStore.authenticated,
  (authenticated) => {
    if (authenticated) void loadFavoritePapers()
  },
  { immediate: true },
)
let revision = 0
async function load() {
  const request = ++revision
  loading.value = true
  error.value = ''
  try {
    const result = await apiRequest('/api/v1/papers?' + new URLSearchParams(route.query))
    if (request === revision) data.value = result
  } catch (e) {
    if (request === revision) {
      error.value = e.message
      data.value = null
    }
  } finally {
    if (request === revision) loading.value = false
  }
}
function filter() {
  router.replace({
    query: {
      ...route.query,
      q: q.value,
      kind: kind.value,
      year: year.value || undefined,
      examMode: examMode.value,
      checked: String(checked.value),
      sort: sort.value,
      page: '1',
    },
  })
}
function tab(value) {
  router.replace({ query: { ...route.query, scope: value, page: '1' } })
}
function turn(step) {
  router.replace({ query: { ...route.query, page: String(data.value.page + step) } })
}
const KIND_OPTIONS = [
  { value: '', label: '全部格式' },
  { value: 'PDF', label: 'PDF 原卷' },
  { value: 'BUILDER', label: '可编辑组卷' },
]
const EXAM_OPTIONS = [
  { value: '', label: '全部考试' },
  { value: '新高考Ⅰ卷', label: '新高考Ⅰ卷' },
  { value: '新高考Ⅱ卷', label: '新高考Ⅱ卷' },
  { value: '地方卷', label: '地方卷' },
  { value: '其他', label: '其他' },
]
const openChip = ref('')
const kindLabel = computed(() =>
  kind.value ? KIND_OPTIONS.find((option) => option.value === kind.value)?.label || '' : '',
)
const hasActiveFilters = computed(
  () => Boolean(q.value || kind.value || year.value || examMode.value) || checked.value,
)
const emptyCopy = computed(() => {
  if (hasActiveFilters.value) {
    return { title: '没有找到匹配的试卷', hint: '换个筛选条件试试，或者清除全部条件。' }
  }
  if (scope.value === 'mine') {
    return { title: '你还没有发布过试卷', hint: '发布入口已关闭，这里只显示你以前发布过的试卷。' }
  }
  if (scope.value === 'favorites') {
    return { title: '还没有收藏的试卷', hint: '在试卷详情页点「收藏试卷」，就会出现在这里。' }
  }
  return { title: '这里还没有试卷', hint: '试卷库还在整理中，稍后再来看看。' }
})
function toggleChip(key) {
  openChip.value = openChip.value === key ? '' : key
}
function pickOption(key, value) {
  if (key === 'kind') kind.value = value
  else if (key === 'examMode') examMode.value = value
  openChip.value = ''
  filter()
}
function setYear(value) {
  year.value = String(value || '')
  openChip.value = ''
  filter()
}
function toggleChecked() {
  checked.value = !checked.value
  filter()
}
function clearChip(key) {
  if (key === 'checked') checked.value = false
  else if (key === 'year') year.value = ''
  else if (key === 'kind') kind.value = ''
  else if (key === 'examMode') examMode.value = ''
  filter()
}
function resetFilters() {
  q.value = ''
  kind.value = ''
  year.value = ''
  examMode.value = ''
  checked.value = false
  router.replace({ query: { scope: scope.value, sort: sort.value, page: '1' } })
}
function submitSearch() {
  window.clearTimeout(searchTimer)
  filter()
}
function onDocumentPointerDown(event) {
  if (!event.target?.closest?.('.shared-chip')) openChip.value = ''
}
function onDocumentKeydown(event) {
  if (event.key === 'Escape') openChip.value = ''
}
let searchTimer = 0
watch(q, (value) => {
  window.clearTimeout(searchTimer)
  if (value === String(route.query.q || '')) return
  searchTimer = window.setTimeout(() => {
    if (q.value !== String(route.query.q || '')) filter()
  }, 450)
})
onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  void loadPaperStats()
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.clearTimeout(searchTimer)
})
watch(
  () => route.fullPath,
  () => {
    q.value = String(route.query.q || '')
    kind.value = String(route.query.kind || '')
    year.value = String(route.query.year || '')
    examMode.value = String(route.query.examMode || '')
    checked.value = route.query.checked === 'true'
    sort.value = String(route.query.sort || 'newest')
    load()
  },
  { immediate: true },
)
</script>
<template>
  <div class="shared-papers-screen app-page">
    <main class="shared-papers-page app-page-container">
      <AppPageHeader title="试卷资源库" :quote="pageQuote">
        <template #aside>
          <AppPageStats aria-label="试卷概况" :items="paperStatItems" />
        </template>
      </AppPageHeader>
      <div class="shared-tabs" role="group" aria-label="试卷分类">
        <button
          v-for="entry in [
            { key: 'all', label: '全部试卷' },
            { key: 'mine', label: '我的发布' },
            { key: 'favorites', label: '我的收藏' },
          ]"
          :key="entry.key"
          :aria-pressed="scope === entry.key"
          @click="tab(entry.key)"
        >
          {{ entry.label }}
        </button>
      </div>
      <form class="shared-filters" @submit.prevent="submitSearch">
        <div class="shared-filter-fields">
          <input
            v-model="q"
            type="search"
            class="shared-search"
            aria-label="搜索试卷"
            placeholder="搜索试卷名称或来源…"
            maxlength="160"
          />
          <div class="shared-chip" :class="{ 'is-active': !!kind }">
            <button
              type="button"
              class="shared-chip-label"
              :aria-expanded="openChip === 'kind'"
              @click="toggleChip('kind')"
            >
              格式<b v-if="kindLabel">{{ kindLabel }}</b>
            </button>
            <button
              v-if="kind"
              type="button"
              class="shared-chip-clear"
              aria-label="清除格式筛选"
              @click="clearChip('kind')"
            >
              ✕
            </button>
            <div v-if="openChip === 'kind'" class="shared-chip-popover">
              <button
                v-for="option in KIND_OPTIONS"
                :key="option.value || 'all'"
                type="button"
                :class="{ 'is-active': kind === option.value }"
                @click="pickOption('kind', option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="shared-chip" :class="{ 'is-active': !!year }">
            <button
              type="button"
              class="shared-chip-label"
              :aria-expanded="openChip === 'year'"
              @click="toggleChip('year')"
            >
              年份<b v-if="year">{{ year }}</b>
            </button>
            <button
              v-if="year"
              type="button"
              class="shared-chip-clear"
              aria-label="清除年份筛选"
              @click="clearChip('year')"
            >
              ✕
            </button>
            <div v-if="openChip === 'year'" class="shared-chip-popover is-form">
              <label>
                年份
                <input
                  :value="year"
                  type="number"
                  min="1900"
                  max="2100"
                  placeholder="如 2025"
                  @keyup.enter="setYear($event.target.value)"
                  @change="setYear($event.target.value)"
                />
              </label>
              <button type="button" @click="setYear('')">不限年份</button>
            </div>
          </div>
          <div class="shared-chip" :class="{ 'is-active': !!examMode }">
            <button
              type="button"
              class="shared-chip-label"
              :aria-expanded="openChip === 'examMode'"
              @click="toggleChip('examMode')"
            >
              考试<b v-if="examMode">{{ examMode }}</b>
            </button>
            <button
              v-if="examMode"
              type="button"
              class="shared-chip-clear"
              aria-label="清除考试筛选"
              @click="clearChip('examMode')"
            >
              ✕
            </button>
            <div v-if="openChip === 'examMode'" class="shared-chip-popover">
              <button
                v-for="option in EXAM_OPTIONS"
                :key="option.value || 'all'"
                type="button"
                :class="{ 'is-active': examMode === option.value }"
                @click="pickOption('examMode', option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="shared-chip-toggle"
            :class="{ 'is-active': checked }"
            :aria-pressed="checked"
            @click="toggleChecked"
          >
            人工校核
          </button>
        </div>
        <div v-if="data?.total" class="shared-filter-summary">
          <span>{{ data.total }} 份试卷</span
          ><select v-model="sort" aria-label="试卷排序" @change="filter">
            <option value="newest">最新发布</option>
            <option value="favorites">收藏最多</option>
            <option value="hot">近期热门</option>
          </select>
        </div>
      </form>
      <p v-if="error" role="alert" class="shared-error">
        {{ error }} <button @click="load">重试</button
        ><RouterLink
          v-if="scope !== 'all'"
          :to="{ name: 'login', query: { redirect: route.fullPath } }"
          >登录账号</RouterLink
        >
      </p>
      <p v-if="loading" class="shared-empty" role="status">正在加载试卷…</p>
      <div v-else-if="data?.items.length" class="shared-list">
        <article
          v-for="paper in data.items"
          :key="paper.id"
          class="shared-row"
          :class="{ 'is-done': paper.kind === 'BUILDER' && isPaperDone(paper) }"
        >
          <RouterLink
            class="shared-row-body"
            :to="{ name: 'shared-paper', params: { id: paper.id } }"
          >
            <span class="shared-row-main">
              <span class="shared-row-title">
                <b :title="paper.title">{{ paper.title }}</b
                ><em v-if="paper.hot" class="shared-hot">HOT</em
                ><small v-if="paper.revision">v{{ paper.revision }}</small
                ><span
                  class="shared-row-format"
                  :class="paper.kind === 'PDF' ? 'is-pdf' : 'is-builder'"
                  >{{ paper.kind === 'PDF' ? 'PDF 原卷' : '可编辑组卷' }}</span
                >
              </span>
              <span class="shared-row-meta">
                <span>{{ paper.exam_mode || '数学试卷' }}</span
                ><span v-if="paper.source">{{ paper.source }}</span
                ><span v-if="paper.year">{{ paper.year }}</span
                ><span v-if="paper.checked_at" class="is-verified"
                  >✓ {{ paper.original_paper_id ? '原卷已核验' : '人工校核' }}</span
                ><span v-if="paper.has_answers">含答案</span>
              </span>
            </span>
            <span class="shared-row-stats">
              <b v-if="paper.kind === 'BUILDER'"
                >{{ paper.question_count }} 题 · {{ paper.total_score }} 分</b
              ><b v-else>{{ (paper.file_bytes / 1048576).toFixed(1) }} MB</b>
              <small>{{ paper.author }} · 收藏 {{ paper.favorite_count }}</small>
            </span>
          </RouterLink>
          <div class="shared-row-actions">
            <button
              type="button"
              class="shared-row-action is-star"
              :class="{ 'is-on': isPaperFavorite(paper) }"
              :disabled="busyPaper === paper.id"
              :aria-pressed="isPaperFavorite(paper)"
              :title="isPaperFavorite(paper) ? '取消收藏' : '收藏试卷'"
              :aria-label="isPaperFavorite(paper) ? '取消收藏' : '收藏试卷'"
              @click="toggleFavorite(paper)"
            >
              {{ isPaperFavorite(paper) ? '★' : '☆' }}
            </button>
            <button
              v-if="paper.kind === 'BUILDER'"
              type="button"
              class="shared-row-action is-complete"
              :class="{ 'is-on': isPaperDone(paper) }"
              :disabled="busyPaper === paper.id"
              :aria-pressed="isPaperDone(paper)"
              :title="isPaperDone(paper) ? '标记整份试卷为未做' : '标记整份试卷为已做'"
              :aria-label="isPaperDone(paper) ? '标记整份试卷为未做' : '标记整份试卷为已做'"
              @click="togglePaperDone(paper)"
            >
              {{ isPaperDone(paper) ? '✓' : '' }}
            </button>
          </div>
        </article>
      </div>
      <div v-else-if="!error" class="shared-empty app-empty-state app-surface">
        <h2>{{ emptyCopy.title }}</h2>
        <p>{{ emptyCopy.hint }}</p>
        <div v-if="hasActiveFilters" class="shared-empty-actions">
          <button type="button" @click="resetFilters">清除筛选条件</button>
        </div>
      </div>
      <footer v-if="data?.total > 20" class="shared-pagination">
        <button :disabled="data.page <= 1 || loading" @click="turn(-1)">上一页</button
        ><span>{{ data.page }} / {{ Math.ceil(data.total / 20) }}</span
        ><button :disabled="data.page * 20 >= data.total || loading" @click="turn(1)">
          下一页
        </button>
      </footer>
    </main>
  </div>
</template>
