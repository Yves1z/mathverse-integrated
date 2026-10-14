import { computed, reactive } from 'vue'

const context = reactive({
  owner: '',
  type: 'page',
  id: '',
  title: '',
  text: '',
  tags: [],
  answer: '',
  solution: '',
})

const focusContext = reactive({
  type: '',
  problemId: '',
  problemTitle: '',
  solutionId: '',
  sectionType: '',
  sectionLabel: '',
  stepId: '',
  stepNumber: 0,
  selectedText: '',
  paragraphText: '',
  previousSteps: [],
  nextStep: '',
  selectionStart: -1,
  selectionEnd: -1,
  sourceType: 'unknown',
  reviewStatus: 'unknown',
})

const assistantRequest = reactive({ sequence: 0, action: '', draft: '' })

function emptyFocusContext() {
  return {
    type: '',
    problemId: '',
    problemTitle: '',
    solutionId: '',
    sectionType: '',
    sectionLabel: '',
    stepId: '',
    stepNumber: 0,
    selectedText: '',
    paragraphText: '',
    previousSteps: [],
    nextStep: '',
    selectionStart: -1,
    selectionEnd: -1,
    sourceType: 'unknown',
    reviewStatus: 'unknown',
  }
}

export function setAssistantContext(owner, value = {}) {
  if (focusContext.problemId && focusContext.problemId !== String(value.id || '')) clearAssistantFocus()
  Object.assign(context, {
    owner,
    type: value.type || 'page',
    id: String(value.id || ''),
    title: String(value.title || ''),
    text: String(value.text || ''),
    tags: Array.isArray(value.tags) ? value.tags.map(String) : [],
    answer: String(value.answer || ''),
    solution: String(value.solution || ''),
  })
}

export function clearAssistantContext(owner) {
  if (context.owner !== owner) return
  Object.assign(context, { owner: '', type: 'page', id: '', title: '', text: '', tags: [], answer: '', solution: '' })
  clearAssistantFocus()
}

export function setAssistantFocus(value = {}) {
  Object.assign(focusContext, emptyFocusContext(), value, {
    previousSteps: Array.isArray(value.previousSteps) ? value.previousSteps.map(String) : [],
  })
}

export function clearAssistantFocus() {
  Object.assign(focusContext, emptyFocusContext())
}

export function requestAssistantOpen({ action = 'ask', draft = '' } = {}) {
  assistantRequest.sequence += 1
  assistantRequest.action = action
  assistantRequest.draft = String(draft)
}

export function useAssistantContext(route) {
  const effectiveContext = computed(() => {
    if (context.owner) return context
    return {
      owner: 'route',
      type: 'page',
      id: String(route.name || ''),
      title: String(route.meta?.title || document.title || '当前页面'),
      text: '',
      tags: [],
      answer: '',
      solution: '',
    }
  })
  const effectiveFocus = computed(() => focusContext.type ? focusContext : null)
  return { assistantRequest, context, effectiveContext, effectiveFocus, focusContext }
}
