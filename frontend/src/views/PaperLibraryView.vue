<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppPageHeader from '../components/layout/AppPageHeader.vue'
import { pickRandomPageQuote } from '../data/pageQuotes.js'
import {
  createPaper,
  deletePaper,
  importPapers,
  readPapers,
  recyclePaper,
} from '../services/paperLibrary.js'
const pageQuote = pickRandomPageQuote()
const router = useRouter()
const fileInput = ref(null)
async function importBackup(event) {
  const file = event.target.files[0]
  if (!file) return
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('too large')
    importPapers(await file.text())
    refresh()
  } catch {
    error.value = '导入失败，请选择有效的试卷备份文件（不超过 10 MB）。原有试卷未改变。'
  }
  event.target.value = ''
}
const papers = ref([])
const query = ref('')
const trash = ref(false)
const error = ref('')
const visible = computed(() =>
  papers.value
    .filter(
      (p) =>
        Boolean(p.deletedAt) === trash.value &&
        p.draft.title.toLowerCase().includes(query.value.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt),
)
function refresh() {
  try {
    papers.value = readPapers()
    error.value = ''
  } catch {
    error.value = '无法读取此浏览器的试卷，请检查浏览器存储设置后重试。'
  }
}
function open(paper) {
  router.push({ name: 'paper', params: { id: paper.id } })
}
function create(source) {
  try {
    const paper = createPaper(
      source ? { ...source.draft, title: source.draft.title + '（副本）' } : undefined,
    )
    // 复制留在列表里（副本会排在首位），只有新建空白卷才直接进组卷页
    if (source) refresh()
    else open(paper)
  } catch {
    error.value = '保存失败，浏览器存储空间可能不足，请先导出备份。'
  }
}
function exportPdf(paper) {
  router.push({ name: 'paper', params: { id: paper.id }, query: { print: '1' } })
}
function recycle(paper) {
  try {
    recyclePaper(paper.id, trash.value)
    refresh()
  } catch {
    error.value = '操作未保存，请检查浏览器存储后重试。'
  }
}
function remove(paper) {
  if (!window.confirm(`彻底删除《${paper.draft.title}》？删除后无法恢复，请确认已导出备份。`))
    return
  try {
    deletePaper(paper.id)
    refresh()
  } catch {
    error.value = '操作未保存，请检查浏览器存储后重试。'
  }
}
function backup() {
  const blob = new Blob([JSON.stringify({ version: 1, papers: papers.value }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '我的试卷备份.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function date(value) {
  return new Date(value).toLocaleDateString('zh-CN')
}
function total(paper) {
  return paper.draft.items.reduce((sum, item) => sum + item.score, 0)
}
function sizeLabel(paper) {
  return paper.draft.size === 'a4' ? 'A4' : '16 开'
}
onMounted(() => {
  refresh()
  window.addEventListener('storage', refresh)
})
onBeforeUnmount(() => window.removeEventListener('storage', refresh))
</script>

<template>
  <div class="paper-library-page app-page">
    <main class="paper-library app-page-container">
      <AppPageHeader :title="trash ? '回收站' : '我的试卷'" :quote="trash ? '' : pageQuote">
        <template #actions>
          <div class="library-actions">
            <input
              ref="fileInput"
              type="file"
              accept=".json,application/json"
              hidden
              @change="importBackup"
            /><button @click="trash = !trash">{{ trash ? '返回我的试卷' : '回收站' }}</button
            ><button class="primary" @click="create()">＋ 新建试卷</button>
          </div>
        </template>
      </AppPageHeader>
      <div class="library-bar">
        <span>{{ trash ? `回收站 ${visible.length} 份` : `${visible.length} 份试卷` }}</span
        ><input
          v-model="query"
          class="library-search"
          type="search"
          aria-label="搜索试卷"
          placeholder="搜索试卷名称…"
        />
      </div>
      <p v-if="error" role="alert">{{ error }} <button @click="refresh">重试</button></p>
      <section
        v-if="visible.length"
        class="library-grid"
        :aria-label="trash ? '回收站中的试卷' : '试卷列表'"
      >
        <article
          v-for="paper in visible"
          :key="paper.id"
          class="library-card"
          :class="{ 'is-trashed': trash }"
        >
          <div class="library-card-copy">
            <div class="library-card-top">
              <span class="library-card-chip">{{ sizeLabel(paper) }}</span
              ><span v-if="!paper.draft.items.length" class="library-card-chip is-blank">空卷</span>
              <div class="library-card-actions">
                <template v-if="trash">
                  <button
                    type="button"
                    class="library-card-icon"
                    :aria-label="`恢复试卷：${paper.draft.title}`"
                    title="恢复试卷"
                    @click="recycle(paper)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
                      <path d="M20 4v4.5h-4.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="library-card-icon is-danger"
                    :aria-label="`彻底删除：${paper.draft.title}`"
                    title="彻底删除"
                    @click="remove(paper)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M4 7h16" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M6 7l1 13h10l1-13" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                  </button>
                </template>
                <template v-else>
                  <button
                    v-if="paper.draft.items.length"
                    type="button"
                    class="library-card-icon"
                    :aria-label="`导出 PDF：${paper.draft.title}`"
                    title="导出为 PDF"
                    @click="exportPdf(paper)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M12 4v9" />
                      <path d="M8.5 9.5 12 13l3.5-3.5" />
                      <path d="M5.5 15v2.5A1.5 1.5 0 0 0 7 19h10a1.5 1.5 0 0 0 1.5-1.5V15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="library-card-icon"
                    :aria-label="`复制试卷：${paper.draft.title}`"
                    title="复制试卷"
                    @click="create(paper)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <rect x="9" y="9" width="10" height="10.5" rx="1.5" />
                      <path
                        d="M15 9V6.5A1.5 1.5 0 0 0 13.5 5H6A1.5 1.5 0 0 0 4.5 6.5V14A1.5 1.5 0 0 0 6 15.5h3"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="library-card-icon is-danger"
                    :aria-label="`移入回收站：${paper.draft.title}`"
                    title="移入回收站"
                    @click="recycle(paper)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M4 7h16" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M6 7l1 13h10l1-13" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                  </button>
                </template>
              </div>
            </div>
            <h2 class="library-card-title">
              <RouterLink
                v-if="!trash"
                class="library-card-link"
                :to="{ name: 'paper', params: { id: paper.id } }"
                >{{ paper.draft.title }}</RouterLink
              ><template v-else>{{ paper.draft.title }}</template>
            </h2>
            <p class="library-card-meta">
              <span>{{ paper.draft.items.length }} 题</span><span>{{ total(paper) }} 分</span
              ><span>编辑于 {{ date(paper.updatedAt) }}</span>
            </p>
          </div>
          <span class="library-card-sheet" aria-hidden="true"></span>
        </article>
      </section>
      <div v-else class="library-empty app-empty-state app-surface">
        <h2>{{ trash ? '回收站为空' : query ? '没有找到匹配的试卷' : '还没有试卷' }}</h2>
        <p v-if="trash">移入回收站的试卷可以随时恢复。</p>
        <p v-else-if="query">换个关键词试试，或清空搜索查看全部试卷。</p>
        <p v-else>新建一份空白卷开始组卷，或者导入之前导出的备份文件。</p>
        <div v-if="!trash && !query" class="library-empty-actions">
          <button class="primary" @click="create()">＋ 新建试卷</button
          ><button @click="fileInput.click()">导入备份</button>
        </div>
      </div>
      <p class="library-foot">
        <span v-if="trash">回收站中的试卷可以随时恢复，彻底删除后无法恢复。</span
        ><span v-else>试卷只保存在当前浏览器中，清理浏览器数据前请先导出备份。</span
        ><span v-if="!trash" class="library-foot-actions"
          ><button type="button" @click="fileInput.click()">导入备份</button
          ><button type="button" :disabled="!papers.length" @click="backup">导出备份</button></span
        >
      </p>
    </main>
  </div>
</template>

<style scoped>
.paper-library {
  color: var(--color-ink);
  font-family: var(--font-ui);
}
.library-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.paper-library button,
.paper-library input {
  font: inherit;
  font-size: 14px;
  min-height: 38px;
  padding: 0 15px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: white;
  color: var(--color-ink-secondary);
}
.paper-library button {
  cursor: pointer;
}
.paper-library button:disabled {
  cursor: default;
  opacity: 0.65;
}
.paper-library button:hover:not(:disabled) {
  border-color: var(--color-blue-700);
}
.paper-library button:focus-visible,
.paper-library input:focus-visible,
.library-card-link:focus-visible {
  outline: 2px solid var(--color-blue-800);
  outline-offset: 3px;
}
.paper-library .primary {
  background: var(--color-blue-800);
  color: white;
  border-color: var(--color-blue-800);
}
.paper-library .primary:hover:not(:disabled) {
  border-color: var(--color-blue-700);
}
.library-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 16px;
  color: var(--color-ink-muted);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.library-search {
  width: 280px;
}
.library-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.library-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  align-items: center;
  gap: 18px;
  min-width: 0;
  min-height: 152px;
  padding: 18px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: white;
  box-shadow: 0 3px 10px #17384b05;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.library-card:hover {
  border-color: var(--color-blue-700);
  box-shadow: 0 4px 14px #19436514;
}
.library-card.is-trashed {
  background: #f8fafb;
}
.library-card-copy {
  min-width: 0;
}
.library-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.library-card-chip {
  display: inline-flex;
  min-height: 27px;
  align-items: center;
  padding: 3px 8px;
  border-radius: 3px;
  color: var(--color-blue-800);
  background: #e8eff5;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}
.library-card-chip.is-blank {
  color: var(--color-ink-muted);
  background: #eef1f4;
}
/* 整张卡片可点：标题链接铺满卡片，图标动作必须浮在它上面 */
.library-card-actions {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 4px;
  margin-left: auto;
}
/* 选择器要压过 .paper-library button 的默认边框与内边距，否则图标会被挤进带框的方盒 */
.paper-library .library-card-icon {
  display: grid;
  width: 30px;
  height: 30px;
  min-height: 0;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--color-ink-muted);
}
.paper-library .library-card-icon svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.paper-library .library-card-icon:hover:not(:disabled) {
  color: var(--color-blue-800);
  background: #eef1f4;
}
.paper-library .library-card-icon.is-danger:hover:not(:disabled) {
  color: #a4402f;
  background: #fbf2f2;
}
.library-card-title {
  margin: 12px 0 0;
  color: var(--color-ink);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.42;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.library-card-link {
  color: inherit;
  text-decoration: none;
}
.library-card-link::after {
  position: absolute;
  inset: 0;
  content: '';
}
.library-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 10px 0 0;
  color: var(--color-ink-muted);
  font-size: 13px;
}
.library-card-meta span::before {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 5px;
  border-radius: 50%;
  background: #8ca2b5;
  content: '';
  vertical-align: 2px;
}
/* 右侧纸张小样（约按 A4 / 16 开的真实比例），替代原来的假书封 */
.library-card-sheet {
  position: relative;
  width: 54px;
  height: 76px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  background: white;
  box-shadow: 0 2px 6px #17384b12;
}
.library-card-sheet::before {
  position: absolute;
  top: 11px;
  left: 50%;
  width: 22px;
  height: 2px;
  border-radius: 1px;
  background: var(--color-blue-700);
  content: '';
  transform: translateX(-50%);
}
.library-card-sheet::after {
  position: absolute;
  top: 24px;
  right: 8px;
  bottom: 11px;
  left: 8px;
  background: repeating-linear-gradient(to bottom, #cfdae3 0 1.5px, transparent 1.5px 8px);
  content: '';
}
.library-empty {
  min-height: 240px;
}
.library-empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}
.library-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin: 20px 0 0;
  color: var(--color-ink-muted);
  font-size: 13px;
}
.paper-library .library-foot-actions button {
  min-height: 32px;
  padding: 0 12px;
  font-size: 13px;
}
@media (max-width: 1180px) {
  .library-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 980px) {
  .library-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 700px) {
  .library-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .library-search {
    width: 100%;
  }
  .library-card {
    grid-template-columns: minmax(0, 1fr) 46px;
    gap: 14px;
    min-height: 136px;
    padding: 16px 16px 16px 18px;
  }
  .library-card-title {
    font-size: 17px;
  }
  .library-card-sheet {
    width: 46px;
    height: 64px;
  }
}
</style>
