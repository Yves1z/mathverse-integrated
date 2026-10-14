<script setup>
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { authOwner } from '../../services/authIdentity.js'
import { authService } from '../../services/authService.js'
import DraftCanvas from '../../features/draft/DraftCanvas.vue'

defineProps({ problem: { type: Object, required: true } })

const isExpanded = ref(false)
const fullscreen = ref(false)
const sceneSeed = shallowRef(null)
const canvas = ref(null)
const inlineCanvas = ref(null)
const dialog = ref(null)
let previousOverflow = ''
const mountVersion = ref(0)
watch(authOwner, () => {
  if (fullscreen.value) document.body.style.overflow = previousOverflow
  fullscreen.value = false
  sceneSeed.value = null
  mountVersion.value += 1
}, { flush: 'sync' })
function restoreScene(scene) {
  sceneSeed.value = scene
  mountVersion.value += 1
}
async function retryIdentity() { try { await authService.me() } catch { /* The identity notice remains visible for retry. */ } }
function toggleExpanded() {
  if (isExpanded.value) {
    const scene = inlineCanvas.value?.snapshot()
    if (scene) sceneSeed.value = scene
  }
  isExpanded.value = !isExpanded.value
}

function openFullscreen(scene) {
  sceneSeed.value = scene ? JSON.parse(JSON.stringify(scene)) : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  fullscreen.value = true
  nextTick(() => dialog.value?.focus())
}

function closeFullscreen() {
  const scene = canvas.value?.snapshot()
  if (scene) sceneSeed.value = JSON.parse(JSON.stringify(scene))
  fullscreen.value = false
  document.body.style.overflow = previousOverflow
}

function dialogKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); closeFullscreen(); return }
  if (event.key !== 'Tab') return
  const controls = [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, [tabindex="0"]')]
    .filter((element) => element.getClientRects().length)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) {
    event.preventDefault(); last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onBeforeUnmount(() => { if (fullscreen.value) document.body.style.overflow = previousOverflow })
</script>

<template>
  <section class="question-forum-placeholder" aria-labelledby="question-forum-title">
    <header class="question-forum-placeholder-header">
      <div>
        <h2 id="question-forum-title">演算草稿</h2>
        <p>在 Excalidraw 中手写，再选择笔迹交给 AI 检查。画板保存在本机浏览器。</p>
      </div>
    </header>

    <div
      id="question-forum-placeholder-content"
      class="question-sidebar-content question-forum-placeholder-content"
      role="region"
      aria-labelledby="question-forum-title"
      :hidden="!isExpanded"
    >
      <p v-if="isExpanded && !authOwner" role="status">账号尚未确认，暂不打开或保存画板。<button type="button" @click="retryIdentity">重新确认账号</button></p>
      <DraftCanvas v-if="isExpanded && !fullscreen && authOwner" ref="inlineCanvas" :key="`${authOwner}:${problem.id}:${mountVersion}`" :owner="authOwner" :problem-id="problem.id" :problem="problem"
        :scene-seed="sceneSeed" @request-fullscreen="openFullscreen" @restore-scene="restoreScene" />
    </div>

    <button
      type="button"
      class="question-sidebar-toggle"
      :aria-expanded="isExpanded"
      aria-controls="question-forum-placeholder-content"
      @click="toggleExpanded"
    >
      <span class="question-sidebar-arrow" aria-hidden="true"></span>
      <span>{{ isExpanded ? '收起草稿区' : '展开草稿区' }}</span>
    </button>
  </section>
  <Teleport to="body">
    <div v-if="fullscreen" ref="dialog" class="agent-draft-fullscreen" role="dialog" aria-modal="true" aria-label="全屏演算草稿" tabindex="-1" @keydown="dialogKeydown">
      <header><strong>演算草稿 · 选中笔迹后提交给 AI</strong><button type="button" @click="closeFullscreen">返回题目</button></header>
      <DraftCanvas v-if="authOwner" ref="canvas" :key="`${authOwner}:${mountVersion}`" :owner="authOwner" :problem-id="problem.id" :problem="problem" :scene-seed="sceneSeed" fill @agent-review="closeFullscreen" @restore-scene="restoreScene" />
    </div>
  </Teleport>
</template>

<style scoped>
.agent-draft-fullscreen { position: fixed; inset: 0; z-index: 1800; display: flex; flex-direction: column; background: #fff; padding: 12px; gap: 10px; }
.agent-draft-fullscreen header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.agent-draft-fullscreen header button { padding: 8px; }
</style>
