<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import 'katex/dist/katex.min.css'
import '../../assets/styles/math-text.css'
import { renderMathText, renderQuestionText } from '../../utils/renderMathText.js'
import { normalizeQuestionSpacing } from '../../utils/questionSpacing.js'
import { splitPaperChoices } from '../../utils/questionChoices.js'
import { applyChoiceColumns } from '../../utils/choiceColumns.js'

const props = defineProps({
  text: { type: String, default: '' },
  inline: { type: Boolean, default: false },
  choices: { type: Boolean, default: false },
  questionLayout: { type: Boolean, default: true },
})

function choiceHtml(option, index) {
  const label = `${'ABCD'[index]}．${renderMathText(option)}`
  return `<div class="math-choice"><span class="math-choice-content">${label}</span></div>`
}

const rendered = computed(() => {
  if (props.inline || !props.questionLayout) return renderMathText(props.text)
  const content = normalizeQuestionSpacing(props.text)
  const split = props.choices ? splitPaperChoices(content) : null
  if (!split) return renderQuestionText(content)
  const options = split.options.map(choiceHtml).join('')
  return `${renderQuestionText(split.stem)}<div class="math-choices">${options}</div>`
})

const root = ref(null)
let observer, frame

function measureNow() {
  const el = root.value
  if (!el || props.inline || !el.clientWidth) return
  applyChoiceColumns(el)
  const formulas = [...el.querySelectorAll('.katex')].filter(
    (formula) => !formula.closest('.katex-display'),
  )
  for (const formula of formulas) formula.classList.remove('math-formula-scroll')
  const overflowing = formulas.filter((formula) => {
    const container = formula.closest('.math-choice-content, .math-question-body') || el
    return formula.getBoundingClientRect().width > container.clientWidth + 1
  })
  for (const formula of overflowing) formula.classList.add('math-formula-scroll')
}

function measure() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(measureNow)
}

function measureForPrint() {
  cancelAnimationFrame(frame)
  measureNow()
}

onMounted(() => {
  observer = new ResizeObserver(measure)
  observer.observe(root.value)
  document.fonts?.ready.then(measure)
  window.addEventListener('beforeprint', measureForPrint)
  measure()
})
watch(rendered, async () => {
  await nextTick()
  measure()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('beforeprint', measureForPrint)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <span v-if="inline" ref="root" class="math-text is-inline" v-html="rendered" />
  <div v-else ref="root" class="math-text" v-html="rendered" />
</template>

<style scoped>
.math-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.math-text :deep(.math-choices) {
  display: grid;
  grid-template-columns: repeat(var(--choice-columns, 1), minmax(0, 1fr));
  gap: 0 12px;
  margin-top: 0.25em;
}

.math-text :deep(.math-choice) {
  min-width: 0;
}

.math-text :deep(.math-choice-content) {
  display: inline-block;
  width: max-content;
  max-width: 100%;
}

.math-text :deep(.katex-display) {
  margin: 0.65em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

/* Imported choices can form one long inline formula. Scroll only the formula. */
.math-text :deep(.math-formula-scroll) {
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  vertical-align: middle;
  padding: 0.15em 0;
}

@media print {
  .math-text :deep(.math-formula-scroll) {
    display: inline;
    max-width: none;
    overflow: visible;
    padding: 0;
  }
  .math-text :deep(.katex-display) {
    overflow: visible;
  }
}
</style>
