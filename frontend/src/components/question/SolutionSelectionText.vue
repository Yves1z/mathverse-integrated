<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePracticeListsStore } from '../../stores/practiceLists.js'
import MathText from '../content/MathText.vue'
import {
  buildSolutionSelectionContext,
  segmentSolutionText,
} from '../../features/ai-assistant/solutionSelection.js'
import {
  requestAssistantOpen,
  setAssistantFocus,
} from '../../features/ai-assistant/assistantContext.js'

const props = defineProps({
  problem: { type: Object, required: true },
  text: { type: String, required: true },
  sectionType: { type: String, required: true },
  sectionLabel: { type: String, required: true },
})

const practiceListsStore = usePracticeListsStore()
const root = ref(null)
const toolbarVisible = ref(false)
const toolbarPosition = ref({ left: 12, top: 12 })
const activeSelection = ref(null)
const steps = computed(() => segmentSolutionText(props.text, props.sectionType))
let selectionFrame = 0

const toolbarStyle = computed(() => ({
  left: `${toolbarPosition.value.left}px`,
  top: `${toolbarPosition.value.top}px`,
}))

function selectionElement(node) {
  return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement
}

function hideToolbar() {
  toolbarVisible.value = false
  activeSelection.value = null
}

function captureSelection() {
  cancelAnimationFrame(selectionFrame)
  selectionFrame = requestAnimationFrame(() => {
    if (!practiceListsStore.isAdmin) { hideToolbar(); return }
    const selection = window.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed || !root.value) {
      hideToolbar()
      return
    }

    const range = selection.getRangeAt(0)
    const startElement = selectionElement(range.startContainer)
    const endElement = selectionElement(range.endContainer)
    if (!root.value.contains(startElement) || !root.value.contains(endElement)) {
      hideToolbar()
      return
    }

    const stepElement = startElement.closest('[data-solution-step]')
    const stepIndex = Number(stepElement?.dataset.solutionStepIndex)
    const selectedText = selection.toString().replace(/\s+/g, ' ').trim()
    if (!stepElement || !Number.isInteger(stepIndex) || selectedText.length < 2) {
      hideToolbar()
      return
    }

    const rect = range.getBoundingClientRect()
    if (!rect.width && !rect.height) {
      hideToolbar()
      return
    }

    activeSelection.value = buildSolutionSelectionContext({
      problem: props.problem,
      sectionType: props.sectionType,
      sectionLabel: props.sectionLabel,
      sectionText: props.text,
      steps: steps.value,
      stepIndex,
      selectedText,
    })
    const toolbarWidth = Math.min(340, window.innerWidth - 24)
    const left = window.innerWidth <= 430
      ? 12
      : Math.min(
          Math.max(12, rect.left + rect.width / 2 - toolbarWidth / 2),
          window.innerWidth - toolbarWidth - 12,
        )
    const preferredTop = rect.top - 52
    toolbarPosition.value = {
      left: Math.round(left),
      top: Math.round(preferredTop >= 8 ? preferredTop : rect.bottom + 10),
    }
    toolbarVisible.value = true
  })
}

function scheduleSelectionCapture() {
  window.setTimeout(captureSelection, 0)
}

function openSelectionInAssistant(action) {
  if (!practiceListsStore.isAdmin || !activeSelection.value) return
  const prompts = {
    motivation: '我不理解这里为什么会想到这样做。请先判断这一步是否正确，再解释它的动机、识别线索，以及不用这种方法通常会遇到什么困难。',
    expand: '请先判断这一步是否正确，再补全这里省略的推导。请逐步说明每一次变形的依据，但不要跳过关键中间步骤。',
    ask: '我对这一步的具体疑问是：',
  }
  setAssistantFocus(activeSelection.value)
  requestAssistantOpen({ action, draft: prompts[action] || prompts.ask })
  window.getSelection()?.removeAllRanges()
  hideToolbar()
}

function handleDocumentPointerDown(event) {
  if (root.value?.contains(event.target) || event.target.closest?.('.solution-selection-toolbar')) return
  hideToolbar()
}

onMounted(() => {
  document.addEventListener('selectionchange', scheduleSelectionCapture)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', scheduleSelectionCapture)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  cancelAnimationFrame(selectionFrame)
})

defineExpose({ captureSelection })
</script>

<template>
  <div
    ref="root"
    class="question-solution-steps"
    @keyup="captureSelection"
    @pointerup="scheduleSelectionCapture"
  >
    <div
      v-for="step in steps"
      :key="step.id"
      class="question-solution-step"
      :data-solution-step="step.id"
      :data-solution-step-index="step.index"
    >
      <MathText :text="step.text" />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="toolbarVisible"
      class="solution-selection-toolbar"
      :style="toolbarStyle"
      role="toolbar"
      aria-label="向 AI 询问选中的解析"
      @pointerdown.prevent
    >
      <button type="button" @click="openSelectionInAssistant('motivation')">解释动机</button>
      <button type="button" @click="openSelectionInAssistant('expand')">展开推导</button>
      <button type="button" @click="openSelectionInAssistant('ask')">问 AI</button>
    </div>
  </Teleport>
</template>
