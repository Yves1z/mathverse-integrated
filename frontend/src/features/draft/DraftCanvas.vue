<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { usePracticeListsStore } from '../../stores/practiceLists.js'
import { mountDraftCanvas } from './mountDraftCanvas.js'
import { readDraft, readLegacyDraft, writeDraft, deleteDraft } from './draftStore.js'
import { draftSourceReference, publishDraftScene, requestHandwritingReview } from './draftAgentBridge.js'

const practiceListsStore = usePracticeListsStore()
const props = defineProps({
  owner: { type: String, required: true },
  problemId: { type: [String, Number], required: true },
  problem: { type: Object, default: null },
  // 抽屉里画板要撑满可用高度，内联时用固定高度。
  fill: { type: Boolean, default: false },
  sceneSeed: { type: Object, default: null },
})

const emit = defineEmits(['request-fullscreen', 'agent-review', 'restore-scene'])
// Immutable for this mount. The parent remounts on every identity change.
const storageOwner = props.owner
const storageProblem = props.problemId

// 草稿里的题目图用与「导出图片」同一套渲染管线，长边超过这个值就压缩，避免草稿记录过大。

const exportMenuOpen = ref(false)
const exportMenu = ref(null)

function closeExportMenu() {
  exportMenuOpen.value = false
}

function toggleExportMenu() {
  exportMenuOpen.value = !exportMenuOpen.value
}

function handleDocumentPointerDown(event) {
  if (!exportMenuOpen.value || exportMenu.value?.contains(event.target)) {
    return
  }

  closeExportMenu()
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closeExportMenu()
  }
}

const SAVE_DELAY = 800

const host = ref(null)
const status = ref('正在准备画板…')
const agentStatus = ref('')
const api = shallowRef(null)
defineExpose({ snapshot: () => api.value?.getScene() || null })
const busy = ref(false)
const storageBroken = ref(false)
const mountFailed = ref(false)
const legacyAvailable = ref(false)

let dispose = null
let saveTimer = null
let pendingScene = null
let alive = true
let hasStoredRecord = false
let suppressSaves = false

async function flush() {
  const scene = pendingScene
  if (!scene) {
    return
  }

  pendingScene = null

  // 本机还没有记录、画布又是空的，就没必要写一条空草稿出去
  // （挂载时 Excalidraw 会自己回显一次场景，会走到这里）。
  if (!hasStoredRecord && !scene.elements?.length) {
    return
  }

  try {
    await writeDraft(storageOwner, storageProblem, scene)
    hasStoredRecord = true
    if (alive) {
      status.value = `已保存 ${new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    }
  } catch {
    storageBroken.value = true
    if (alive) {
      status.value = '本机存储不可用，草稿不会保存'
    }
  }
}

function scheduleSave(scene) {
  if (!alive || suppressSaves) return
  publishDraftScene(storageProblem, scene, storageOwner)
  pendingScene = scene
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flush()
  }, SAVE_DELAY)
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportAs(kind) {
  if (!api.value || busy.value) {
    return
  }

  closeExportMenu()

  if (api.value.isEmpty()) {
    status.value = '草稿还是空的，先写点东西吧'
    return
  }

  busy.value = true

  try {
    const blob = kind === 'png' ? await api.value.exportPng() : await api.value.exportSvg()
    download(blob, `演算草稿-${props.problemId}.${kind}`)
    status.value = `已导出 ${kind.toUpperCase()}`
  } catch {
    status.value = '导出失败，请重试'
  } finally {
    busy.value = false
  }
}

function clearCanvas() {
  if (!api.value || api.value.isEmpty()) {
    return
  }

  if (!window.confirm('清空这道题的草稿？清空后无法恢复。')) {
    return
  }

  api.value.clear()
  status.value = '已清空'
}

async function submitSelection() {
  if (!practiceListsStore.isAdmin || !api.value || busy.value) return
  busy.value = true
  agentStatus.value = '正在准备选区…'
  try {
    const source = draftSourceReference(storageProblem)
    const capture = await api.value.captureSelection()
    if (!alive) return
    await requestHandwritingReview(storageProblem, { ...source, ...capture, owner: storageOwner })
    agentStatus.value = '已提交手写选区，请在 AI 助手中核对读法'
    emit('agent-review')
  } catch (error) {
    agentStatus.value = error.message || '选区导出失败，请重试'
  } finally {
    busy.value = false
  }
}

async function importLegacy() {
  if (!api.value?.isEmpty()) { agentStatus.value = '请先导出并删除当前画板，再导入旧版草稿，避免覆盖现有笔迹'; return }
  if (!window.confirm('旧版草稿未区分账号，可能来自此设备的其他使用者。确认属于你并复制到当前账号？旧记录仍保留。')) return
  busy.value = true
  try {
    const scene = await readLegacyDraft(storageProblem)
    if (!alive || !scene) return
    await writeDraft(storageOwner, storageProblem, scene)
    if (alive) emit('restore-scene', scene)
  } catch { agentStatus.value = '旧版草稿导入失败，原记录仍保留，请重试' }
  finally { busy.value = false }
}

async function removeSavedCanvas() {
  if (!window.confirm('删除当前账号在本机保存的本题画板，并清空当前笔迹？其他账号和旧版记录不受影响。')) return
  busy.value = true
  suppressSaves = true
  clearTimeout(saveTimer)
  pendingScene = null
  try {
    await deleteDraft(storageOwner, storageProblem)
    if (alive) {
      publishDraftScene(storageProblem, { elements: [], appState: {}, files: {} }, storageOwner)
      emit('restore-scene', { elements: [], appState: {}, files: {} })
    }
  } catch { suppressSaves = false; agentStatus.value = '删除失败，当前笔迹仍保留，请重试或导出' }
  finally { busy.value = false }
}

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)

  let initialScene = props.sceneSeed

  try {
    const saved = initialScene || await readDraft(storageOwner, storageProblem)
    initialScene = saved?.elements?.length
      ? { elements: saved.elements, appState: saved.appState, files: saved.files }
      : null
    hasStoredRecord = Boolean(initialScene)
    legacyAvailable.value = Boolean((await readLegacyDraft(storageProblem))?.elements?.length)
  } catch {
    storageBroken.value = true
  }
  if (!alive) return

  try {
    dispose = await mountDraftCanvas(host.value, {
      initialScene,
      isActive: () => alive,
      onChange: scheduleSave,
      onReady: (handle) => {
        if (!alive) return
        api.value = handle
        const currentScene = handle.getScene()
        // The React API can bind before initialData has populated the scene.
        // Do not publish that transient empty scene as a learner erasure.
        publishDraftScene(storageProblem, initialScene?.elements?.length && !currentScene.elements.length
          ? initialScene : currentScene, storageOwner)
        status.value = initialScene ? '已恢复本机草稿' : '空白草稿'
      },
    })
    if (!alive) { dispose?.(); dispose = null }
  } catch {
    mountFailed.value = true
    status.value = '画板加载失败'
  }
})

onBeforeUnmount(() => {
  alive = false
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)

  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  if (pendingScene && (hasStoredRecord || pendingScene.elements?.length)) {
    void writeDraft(storageOwner, storageProblem, pendingScene).catch(() => {})
    pendingScene = null
  }

  if (dispose) {
    dispose()
    dispose = null
  }

  api.value = null
})
</script>

<template>
  <div class="question-draft" :class="{ 'is-fill': fill }">
    <div class="question-draft-toolbar">
      <span class="question-draft-status" role="status">{{ status }}</span>
      <button v-if="practiceListsStore.isAdmin" type="button" :disabled="!api || busy" @click="submitSelection">提交选区给 AI</button>

      <div ref="exportMenu" class="question-draft-menu">
        <button
          type="button"
          class="is-plain"
          :disabled="!api || busy"
          aria-haspopup="menu"
          :aria-expanded="exportMenuOpen"
          @click="toggleExportMenu"
        >
          导出 <span aria-hidden="true">▾</span>
        </button>
        <ul v-if="exportMenuOpen" class="question-draft-menu-list" role="menu">
          <li role="none">
            <button type="button" role="menuitem" @click="exportAs('png')">PNG 图片</button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" @click="exportAs('svg')">SVG 矢量图</button>
          </li>
        </ul>
      </div>

      <button v-if="!fill" type="button" class="is-plain" :disabled="!api || busy" @click="emit('request-fullscreen', api.getScene())">
        全屏
      </button>
      <button type="button" class="is-plain is-danger" :disabled="!api || busy" @click="clearCanvas">
        清空
      </button>
      <button type="button" :disabled="!api || busy" @click="removeSavedCanvas">删除本题已保存画板</button>
    </div>

    <p v-if="practiceListsStore.isAdmin" class="question-draft-notice">用选择工具框选要检查的几行，再提交给 AI。选区发送前会显示接收模型并请求授权。</p>
    <p class="question-draft-notice">{{ owner === 'anon' ? '当前为访客草稿：此浏览器的访客共享此范围。' : '画板按当前账号和题目保存，仅保存在本机浏览器。' }}</p>
    <p v-if="legacyAvailable" class="question-draft-notice">发现旧版未区分账号的草稿，不会自动打开。
      <button type="button" :disabled="busy || !api" @click="importLegacy">确认归属并导入旧版草稿</button>
    </p>
    <p v-if="agentStatus" class="question-draft-notice" role="status">{{ agentStatus }}</p>
    <div ref="host" class="question-draft-stage" :inert="busy"></div>

    <p v-if="mountFailed" class="question-draft-notice">
      画板没能加载，可能是网络或浏览器版本问题；刷新页面可以重试。
    </p>
    <p v-else-if="storageBroken" class="question-draft-notice">
      本机存储不可用（可能是浏览器隐私模式），这次写的草稿不会被保存，请先导出再离开。
    </p>
  </div>
</template>

<style scoped>
.question-draft {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 抽屉 body 是 flex 行容器：不伸展开的话本组件只有内容宽度（约 300px），
   Excalidraw 会据此判定成窄屏、渲染成移动版布局。 */
.question-draft.is-fill {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  height: 100%;
}

.question-draft-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.question-draft-status {
  flex: 1 1 auto;
  color: var(--question-ink-muted, #8495a2);
  font-size: 12px;
}

.question-draft-toolbar button {
  padding: 4px 10px;
  border: 1px solid var(--question-border, #dce4ea);
  border-radius: 6px;
  background: #fff;
  color: var(--question-ink-secondary, #506b80);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

/* 次要动作去掉边框只留文字，hover 才浮出底色：
   一行按钮等重地抢视线会让人看着累。 */
.question-draft-toolbar button.is-plain {
  border-color: transparent;
  background: none;
}

.question-draft-toolbar button:hover:not(:disabled) {
  border-color: #175b8d;
  color: #175b8d;
}

.question-draft-toolbar button.is-plain:hover:not(:disabled) {
  border-color: transparent;
  background: #eef4f8;
}

.question-draft-toolbar button.is-danger:hover:not(:disabled) {
  color: #b42318;
  background: #fdeceb;
}

.question-draft-toolbar button:disabled {
  color: #b3c1cb;
  cursor: default;
}

.question-draft-stage {
  height: clamp(360px, 72vh, 760px);
  border: 1px solid var(--question-border, #dce4ea);
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.question-draft.is-fill .question-draft-stage {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  border: 0;
  border-radius: 0;
}

/* 这层 div 由 React 岛渲染，拿不到 scoped 属性，要用 :deep 穿透。 */
.question-draft-stage :deep(.question-draft-stage-inner) {
  width: 100%;
  height: 100%;
}

/* 草稿区用不到的 Excalidraw 入口：素材库、更多工具（画框/网页嵌入/激光笔/Mermaid）、帮助。 */
.question-draft-stage :deep(.sidebar-trigger),
.question-draft-stage :deep([data-testid='dropdown-menu-button']),
.question-draft-stage :deep(.help-icon) {
  display: none !important;
}

/* Excalidraw 自带的细十字线和淡灰圆环，压在白色画布或题目图的黑色文字上几乎看不见，
   所以按当前工具换成黑线带白描边的高对比光标（看不清比不好看更影响使用）。 */
.question-draft-stage :deep(.is-tool-draw .excalidraw__canvas) {
  cursor:
    url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczMicgaGVpZ2h0PSczMic+PHBhdGggZD0nTTE2IDRWMjhNNCAxNkgyOCcgc3Ryb2tlPScjZmZmZmZmJyBzdHJva2Utd2lkdGg9JzUuNScgc3Ryb2tlLWxpbmVjYXA9J3JvdW5kJy8+PHBhdGggZD0nTTE2IDRWMjhNNCAxNkgyOCcgc3Ryb2tlPScjMGYxNzJhJyBzdHJva2Utd2lkdGg9JzEuNicgc3Ryb2tlLWxpbmVjYXA9J3JvdW5kJy8+PGNpcmNsZSBjeD0nMTYnIGN5PScxNicgcj0nMi40JyBmaWxsPScjMGYxNzJhJyBzdHJva2U9JyNmZmZmZmYnIHN0cm9rZS13aWR0aD0nMS4zJy8+PC9zdmc+')
      16 16,
    crosshair !important;
}

.question-draft-stage :deep(.is-tool-eraser .excalidraw__canvas) {
  cursor:
    url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczMicgaGVpZ2h0PSczMic+PGNpcmNsZSBjeD0nMTYnIGN5PScxNicgcj0nMTAnIGZpbGw9J25vbmUnIHN0cm9rZT0nI2ZmZmZmZicgc3Ryb2tlLXdpZHRoPSc2Jy8+PGNpcmNsZSBjeD0nMTYnIGN5PScxNicgcj0nMTAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzBmMTcyYScgc3Ryb2tlLXdpZHRoPScyJy8+PHBhdGggZD0nTTE2IDExLjVWMjAuNU0xMS41IDE2SDIwLjUnIHN0cm9rZT0nIzBmMTcyYScgc3Ryb2tlLXdpZHRoPScxLjQnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcvPjwvc3ZnPg==')
      16 16,
    crosshair !important;
}

.question-draft-menu {
  position: relative;
}

.question-draft-menu-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 5;
  min-width: 132px;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--question-border, #dce4ea);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(35 59 77 / 14%);
}

.question-draft-menu-list button {
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--question-ink-secondary, #506b80);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.question-draft-menu-list button:hover {
  color: #175b8d;
  background: #eef4f8;
}

.question-draft-notice {
  margin: 8px 0 0;
  color: #a2622e;
  font-size: 12px;
}

/* 窄屏把状态单独放一行，四个操作按钮才能排成一行。 */
@media (max-width: 899px) {
  .question-draft-toolbar {
    gap: 6px;
  }

  .question-draft-status {
    flex: 1 1 100%;
  }
}
</style>
