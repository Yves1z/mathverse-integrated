<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../services/apiClient.js'
import { createPaper } from '../services/paperLibrary.js'
import PaperSheetView from '../components/paper/PaperSheetView.vue'
import { usePaperSheet } from '../composables/usePaperSheet.js'
import { restorePaperDraft } from '../utils/paperLayout.js'
import '../assets/styles/shared-papers.css'
import '../assets/styles/paper-builder.css'

const DIFFICULTY_LABELS = ['很容易', '较容易', '中等', '较难', '很难']
const ALIGNMENT_LABELS = ['很低', '较低', '一般', '较高', '很高']

const route = useRoute(),
  router = useRouter(),
  paper = ref(null),
  error = ref(''),
  busy = ref(false),
  pdfUrl = ref(''),
  difficulty = ref(3),
  alignment = ref(3),
  note = ref(''),
  saved = ref(''),
  message = ref(''),
  ratingOpen = ref(false),
  adminOpen = ref(false)
let id = route.params.id

// 卷面直接渲染成打印排版，默认「适合宽度」（窄屏给 100%，避免整页缩成缩略图）。
const items = ref([]),
  title = ref(''),
  size = ref('a4')
const narrowScreen = window.matchMedia('(max-width: 720px)')
const {
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
  totalScore,
  headingFor,
  showScoreFor,
  fitWidth,
  setZoom,
  stepZoom,
  queueLayout,
  printPaper,
} = usePaperSheet({
  items,
  title,
  size,
  fitRange: [0.5, 1.4],
  initialZoom: narrowScreen.matches ? 1 : 0.8,
  initialAutoFit: !narrowScreen.matches,
  onPrintError: (text) => {
    message.value = text
  },
})

const isPdf = computed(() => paper.value?.kind === 'PDF')
const sheetReady = computed(() => pages.value.some((page) => page.fragments.length))
const kindLabel = computed(() => (isPdf.value ? 'PDF 原卷' : '可编辑组卷'))
const verifyLabel = computed(() => (paper.value?.original_paper_id ? '原卷已核验' : '人工校核'))
const publishedAt = computed(() =>
  paper.value ? new Date(paper.value.created_at).toLocaleDateString('zh-CN') : '',
)

watch(
  () => route.params.id,
  (value) => {
    if (value) {
      id = value
      paper.value = null
      error.value = ''
      pdfUrl.value = ''
      saved.value = ''
      message.value = ''
      load()
    }
  },
)

async function load() {
  try {
    paper.value = await apiRequest(`/api/v1/papers/${id}`)
    const mine = paper.value.myRating?.[0]
    if (mine) {
      difficulty.value = mine.difficulty
      alignment.value = mine.alignment
    }
    note.value = paper.value.check_note || ''
    ratingOpen.value = Boolean(paper.value.myRating?.length) || paper.value.rating_count > 0
    const restored = isPdf.value
      ? null
      : restorePaperDraft(JSON.stringify(paper.value.snapshot ?? null))
    if (restored) {
      items.value = restored.items
      title.value = restored.title
      size.value = restored.size
    }
  } catch (e) {
    error.value = e.message
  }
}

async function act(work) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  saved.value = ''
  try {
    await work()
  } catch (e) {
    error.value = e.message
    if (e.status === 401) router.push({ name: 'login', query: { redirect: route.fullPath } })
  } finally {
    busy.value = false
  }
}

function favorite() {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/favorite`, {
      method: 'PUT',
      body: { favorite: !paper.value.favorite },
    })
    await load()
  })
}

function rate() {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/rating`, {
      method: 'PUT',
      body: { difficulty: difficulty.value, alignment: alignment.value },
    })
    await load()
    saved.value = '评价已保存'
  })
}

function check(value) {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/check`, {
      method: 'PUT',
      body: { checked: value, note: note.value },
    })
    await load()
    saved.value = value ? '校核记录已保存' : '已撤销校核'
  })
}

function remove() {
  if (!window.confirm('下架这份试卷？下架后其他用户将无法访问，个人组卷草稿不受影响。')) return
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}`, { method: 'DELETE' })
    router.push({ name: 'papers', query: { scope: 'mine' } })
  })
}

function pdf(download = false) {
  act(async () => {
    const result = await apiRequest(`/api/v1/papers/${id}/access?download=${download}`, {
      method: 'POST',
    })
    if (download) {
      const a = document.createElement('a')
      a.href = result.url
      a.rel = 'noopener'
      a.click()
    } else pdfUrl.value = result.url
  })
}

function copy() {
  act(async () => {
    await apiRequest(`/api/v1/papers/${id}/access`, { method: 'POST' })
    const created = createPaper(paper.value.snapshot)
    router.push({ name: 'paper', params: { id: created.id } })
  })
}

onMounted(load)
</script>

<template>
  <div class="shared-paper-screen app-page">
    <main class="shared-papers-page app-page-container">
      <RouterLink class="shared-back" :to="{ name: 'papers' }">← 返回试卷库</RouterLink>

      <p v-if="error" role="alert" class="shared-error">
        {{ error }} <button @click="load">重新加载</button>
      </p>

      <template v-if="paper">
        <header class="shared-paper-head">
          <div class="shared-paper-title">
            <h1>{{ paper.title }}</h1>
            <p class="shared-meta">
              <span class="shared-meta-kind">{{ kindLabel }}</span>
              <span v-if="paper.source">{{ paper.source }}</span>
              <span v-if="paper.year">{{ paper.year }}</span>
              <span v-if="paper.exam_mode">{{ paper.exam_mode }}</span>
              <span>{{ paper.question_count }} 题 · {{ paper.total_score }} 分</span>
              <span v-if="paper.has_answers">含答案</span>
              <span v-if="paper.checked_at" class="is-verified">✓ {{ verifyLabel }}</span>
              <span v-if="paper.revision" class="is-version">v{{ paper.revision }}</span>
              <span v-if="paper.hot" class="shared-hot">HOT</span>
            </p>
            <p class="shared-byline">{{ paper.author }} 分享 · {{ publishedAt }}</p>
          </div>

          <div class="shared-paper-tools">
            <button
              type="button"
              class="shared-star"
              :class="{ 'is-on': paper.favorite }"
              :disabled="busy"
              :aria-pressed="paper.favorite"
              :aria-label="paper.favorite ? '取消收藏' : '收藏试卷'"
              @click="favorite"
            >
              <span aria-hidden="true">{{ paper.favorite ? '★' : '☆' }}</span
              >{{ paper.favorite_count }}
            </button>
            <template v-if="isPdf">
              <button type="button" :disabled="busy" @click="pdf(false)">
                {{ pdfUrl ? '重新加载预览' : '打开预览' }}
              </button>
              <button type="button" class="primary" :disabled="busy" @click="pdf(true)">
                下载 PDF
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="primary"
                :disabled="busy || layingOut || printing || !items.length"
                @click="printPaper"
              >
                打印 / PDF
              </button>
              <button type="button" :disabled="busy" @click="copy">复制到我的组卷</button>
            </template>
          </div>
        </header>

        <div class="shared-detail-layout">
          <section class="shared-sheet-panel" aria-label="试卷卷面">
            <template v-if="isPdf">
              <iframe
                v-if="pdfUrl"
                :src="pdfUrl"
                title="试卷 PDF 预览"
                referrerpolicy="no-referrer"
              />
              <div v-else class="shared-empty">
                <span class="shared-pdf-symbol">PDF</span>
                <h3>按需加载原卷</h3>
                <p>{{ (paper.file_bytes / 1048576).toFixed(1) }} MB · 登录后可预览、下载</p>
                <p>移动端如无法显示预览，可下载后打开。</p>
              </div>
            </template>
            <template v-else>
              <p v-if="layoutError" class="shared-sheet-error" role="alert">
                {{ layoutError }}
                <button type="button" @click="queueLayout">重试排版</button>
              </p>
              <p v-if="!sheetReady" class="shared-sheet-pending" role="status">正在排版…</p>
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
              />
              <footer class="shared-sheet-bar">
                <div class="paper-zoom-controls">
                  <button type="button" aria-label="缩小卷面" @click="stepZoom(-0.1)">−</button
                  ><select :value="Math.round(zoom * 100)" aria-label="预览缩放" @change="setZoom">
                    <option :value="Math.round(zoom * 100)">{{ Math.round(zoom * 100) }}%</option>
                    <option v-for="z in [50, 75, 100, 125, 150]" :key="z" :value="z">
                      {{ z }}%
                    </option></select
                  ><button type="button" aria-label="放大卷面" @click="stepZoom(0.1)">＋</button
                  ><button type="button" :aria-pressed="autoFit" @click="fitWidth">适合宽度</button>
                </div>
                <span class="shared-sheet-count"
                  >{{ pages.length }} 页 · 共 {{ items.length }} 题</span
                >
                <button
                  type="button"
                  class="primary"
                  :disabled="busy || layingOut || printing || !items.length"
                  @click="printPaper"
                >
                  打印 / PDF
                </button>
              </footer>
              <p v-if="message" class="shared-sheet-error" role="status">
                {{ message }}
                <button type="button" @click="queueLayout">重试排版</button>
              </p>
            </template>
          </section>

          <aside class="shared-detail-aside">
            <section class="shared-panel">
              <h2>试卷信息</h2>
              <p class="shared-description">{{ paper.description || '作者尚未添加说明。' }}</p>
              <div v-if="paper.checked_at" class="shared-notice">
                <strong>✓ {{ paper.original_paper_id ? '原卷已核验' : '已人工校核' }}</strong>
                <p v-if="paper.check_note">{{ paper.check_note }}</p>
                <small
                  >{{ paper.checked_by_name }} ·
                  {{ new Date(paper.checked_at).toLocaleDateString('zh-CN') }}</small
                >
              </div>
              <p v-else class="shared-muted">尚未完成人工校核</p>
              <div v-if="paper.versions?.length" class="shared-notice">
                <strong>版本记录</strong>
                <p>
                  当前为 v{{ paper.revision }}，题目内容与分值已固定。复制到自己的组卷后可自由修改。
                </p>
                <p v-if="paper.versions[0].revision > paper.revision">
                  已有新版 v{{ paper.versions[0].revision }}，建议查看修订说明。
                </p>
                <p v-for="version in paper.versions" :key="version.id">
                  <RouterLink :to="`/papers/${version.id}`"
                    >v{{ version.revision
                    }}{{ version.revision === paper.revision ? '（当前）' : '' }}</RouterLink
                  >
                  · {{ version.revision_note }}
                </p>
              </div>
            </section>

            <section class="shared-panel">
              <h2>
                读者评价 <small>{{ paper.rating_count }} 人</small>
              </h2>
              <div class="shared-rating-summary">
                <div>
                  <strong>{{ paper.rating_count >= 5 ? paper.difficulty : '—' }}</strong
                  ><span>难度 / 5</span>
                </div>
                <div>
                  <strong>{{ paper.rating_count >= 5 ? paper.alignment : '—' }}</strong
                  ><span>高考契合度 / 5</span>
                </div>
              </div>
              <p class="shared-muted">
                难度分越高越难，契合度分越高越贴近高考。满 5 人评价后展示均分。
              </p>
              <p v-if="paper.canEdit" class="shared-muted">作者不能评价自己发布的试卷。</p>
              <template v-else>
                <button
                  v-if="!ratingOpen"
                  type="button"
                  class="shared-rating-open"
                  @click="ratingOpen = true"
                >
                  写评价
                </button>
                <form v-else class="shared-rating-form" @submit.prevent="rate">
                  <div class="shared-rating-field">
                    <span>难度</span>
                    <div class="shared-stars" role="radiogroup" aria-label="我认为的难度">
                      <button
                        v-for="n in 5"
                        :key="n"
                        type="button"
                        role="radio"
                        :aria-checked="difficulty === n"
                        :aria-label="`难度 ${n} 星`"
                        :class="{ 'is-on': n <= difficulty }"
                        @click="difficulty = n"
                      >
                        ★
                      </button>
                    </div>
                    <small>{{ DIFFICULTY_LABELS[difficulty - 1] }}</small>
                  </div>
                  <div class="shared-rating-field">
                    <span>契合度</span>
                    <div class="shared-stars" role="radiogroup" aria-label="与高考的契合度">
                      <button
                        v-for="n in 5"
                        :key="n"
                        type="button"
                        role="radio"
                        :aria-checked="alignment === n"
                        :aria-label="`契合度 ${n} 星`"
                        :class="{ 'is-on': n <= alignment }"
                        @click="alignment = n"
                      >
                        ★
                      </button>
                    </div>
                    <small>{{ ALIGNMENT_LABELS[alignment - 1] }}</small>
                  </div>
                  <button type="submit" class="primary" :disabled="busy">
                    {{ paper.myRating.length ? '更新评价' : '提交评价' }}
                  </button>
                </form>
              </template>
            </section>

            <section v-if="paper.canCheck || paper.canEdit" class="shared-panel">
              <h2>
                <button
                  type="button"
                  class="shared-fold-toggle"
                  :aria-expanded="adminOpen"
                  @click="adminOpen = !adminOpen"
                >
                  管理员操作 <span aria-hidden="true">{{ adminOpen ? '▴' : '▾' }}</span>
                </button>
              </h2>
              <template v-if="adminOpen">
                <template v-if="paper.canCheck">
                  <label class="shared-field"
                    >已核对的内容<textarea
                      v-model="note"
                      maxlength="500"
                      rows="3"
                      placeholder="例如：已逐题核对题干、配图和参考答案"
                    />
                  </label>
                  <div class="shared-actions">
                    <button type="button" :disabled="busy || !note.trim()" @click="check(true)">
                      记录校核</button
                    ><button
                      v-if="paper.checked_at"
                      type="button"
                      :disabled="busy"
                      @click="check(false)"
                    >
                      撤销
                    </button>
                  </div>
                </template>
                <button
                  v-if="paper.canEdit || paper.canCheck"
                  type="button"
                  class="shared-danger"
                  :disabled="busy"
                  @click="remove"
                >
                  下架试卷
                </button>
              </template>
            </section>

            <p v-if="saved" role="status">{{ saved }}</p>
          </aside>
        </div>
      </template>

      <p v-else-if="!error" class="shared-empty">正在加载试卷…</p>
    </main>
  </div>
</template>
