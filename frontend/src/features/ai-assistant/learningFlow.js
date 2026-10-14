import { parseRouteConditionRequest } from './routeCondition.js'

const HINT_INSTRUCTIONS = [
  '只指出最值得关注的对象或条件，不透露方法、关键变换和答案。',
  '提醒一个与当前卡点有关的结构或性质，留给学生自己判断如何使用。',
  '指出可尝试的方法或定理，不写出决定性的代换或完整推导。',
  '可以揭示一个关键变换或中间目标，但不要继续完成后续步骤。',
  '给出一个可执行的局部步骤，并让学生完成剩余推理；不要展示完整解答。',
]

export function parseDraftStepHintRequest(userText = '') {
  const text = String(userText).trim()
  const premiseFirst = text.match(/^(?:请)?(?:把|将)\s*草稿第\s*(\d+)\s*步(?:作为|当作|用作)(?:较早)?(?:前提|条件)[，,、\s]*(?:请)?(?:给|针对)?\s*草稿第\s*(\d+)\s*步.{0,12}(?:提示|线索)/)
  const targetFirst = text.match(/^(?:请)?(?:给|针对)?\s*草稿第\s*(\d+)\s*步.{0,12}(?:提示|线索)[，,、\s]*(?:并|把|将)?\s*草稿第\s*(\d+)\s*步(?:作为|当作|用作)(?:较早)?(?:前提|条件)/)
  const target = text.match(/草稿第\s*(\d+)\s*步/)
  if (!premiseFirst && !targetFirst && !target) return null
  return {
    stepNumber: Number(premiseFirst?.[2] || targetFirst?.[1] || target?.[1]),
    premiseStepNumber: premiseFirst ? Number(premiseFirst[1]) : targetFirst ? Number(targetFirst[2]) : null,
    obstacle: text.split(/[：:]/).slice(1).join('：').slice(0, 500),
  }
}

export function resolveLearningIntent(taskType, userText = '') {
  if (taskType !== 'chat') return taskType
  const text = String(userText).trim()
  if (parseRouteConditionRequest(text)) return 'route_condition'
  if (/^(?:请)?回答本次追问[：:]\s*\S+/.test(text)) return 'teach-back-reply'
  if (/^(?:请)?(?:检验|检查)(?:一下)?(?:我的理解|我是否真正理解)[：:]\s*\S+/.test(text)) {
    return 'teach_back'
  }
  if (/^(?:请)?(?:检验|检查)(?:一下)?(?:我的理解|我是否真正理解)(?:这道题)?[。！!？?]?$/.test(text)) {
    return 'teach_back_entry'
  }
  if (/(?:解法路线图|解题思维导图|比较.{0,8}(?:解法|方法)|哪种.{0,8}更快|怎样.{0,8}换.{0,4}方法)/.test(text)) {
    return 'strategy'
  }
  const rejectsAnswer = /(?:不要|别|先不|暂时不).{0,8}(?:答案|完整解答|完整解法)/.test(text)
  if (!rejectsAnswer && /(?:直接.{0,8}(?:答案|解答|解法)|完整.{0,4}(?:答案|解答|解法|步骤)|(?:答案|解答|解法).{0,4}(?:完整|全部))/.test(text)) {
    return 'solution'
  }
  if (/^(?:请)?(?:把|将)\s*草稿第\s*\d+\s*步/.test(text) && parseDraftStepHintRequest(text)?.premiseStepNumber != null) return 'draft-step-hint'
  if (/^(?:请)?(?:针对|给|基于)?(?:我的|这版)?草稿第\s*\d+\s*步.{0,12}(?:提示|线索)/.test(text)) return 'draft-step-hint'
  if (/^(?:请)?(?:基于|根据|沿着|针对|按).{0,8}(?:草稿|我的思路|我的路线).{0,12}(?:提示|线索)/.test(text)) return 'draft-hint'
  if (/^(?:请)?(?:再|多|继续).{0,8}(?:提示|线索)|^(?:请)?(?:给我|请给|来).{0,8}(?:提示|线索)/.test(text)) {
    return 'hint'
  }
  if (/^(?:请)?(?:只|仅)?(?:检查|验证|判断).{0,12}(?:这一步|这一行|步骤|等式)/.test(text)) {
    return 'verify'
  }
  if (/^(?:请)?(?:检查|诊断|看看).{0,10}(?:我的|这份)?(?:草稿|解题过程|推导)/.test(text)) {
    return 'diagnose'
  }
  return 'chat'
}

export function nextHintLevel(previousLevel = -1) {
  if (Number(previousLevel) >= 5) return 5
  return Math.min(4, Math.max(-1, Number(previousLevel) || 0) + 1)
}

export function hintInstruction(level, previousHints = []) {
  if (Number(level) >= 5) {
    return '用户已经查看完整解答。请针对当前具体疑问解释，不要假装关键步骤尚未揭示，也不要重复整篇解答。'
  }
  const safeLevel = Math.max(0, Math.min(4, Number(level) || 0))
  const previous = previousHints
    .slice(-3)
    .map((hint, index) => `${index + 1}. ${String(hint).slice(0, 180)}`)
    .join('\n')
  return [
    `这是第 ${safeLevel} 级渐进提示。${HINT_INSTRUCTIONS[safeLevel]}`,
    '先判断学生当前可能卡在哪里；只给一条最小有效提示，尊重其可行路线。',
    previous ? `此前已展示的提示（不要重复）：\n${previous}` : '',
  ].filter(Boolean).join('\n')
}

export function learningScopeKey(context, focus) {
  const owner = String(context?.owner || 'route')
  const id = String(context?.id || '')
  const step = focus?.type === 'solution_step' ? String(focus.stepId || '') : ''
  return JSON.stringify([owner, id, step])
}

export function buildTurnPrompt({
  context,
  focus,
  contextLabel,
  includeContext,
  includeSolution,
  intent,
  userText = '',
  hintLevel = 0,
  previousHints = [],
}) {
  const parts = []
  if (includeContext) {
    parts.push(`当前上下文：${contextLabel}`)
    if (context.tags?.length) parts.push(`现有标签：${context.tags.join('、')}`)
    if (context.text) parts.push(`题目：\n${context.text}`)
    if (focus?.type === 'solution_step') {
      parts.push(`当前引用位置：${focus.sectionLabel} · 第 ${focus.stepNumber} 步`)
      parts.push(`用户选中文字：\n${focus.selectedText}`)
      parts.push(`当前步骤原文：\n${focus.paragraphText}`)
      if (focus.previousSteps?.length) parts.push(`必要前文：\n${focus.previousSteps.join('\n\n')}`)
      if (focus.nextStep && intent !== 'hint' && intent !== 'verify') {
        parts.push(`下一步（仅用于理解上下文）：\n${focus.nextStep}`)
      }
      const source = focus.sourceType === 'official'
        ? '官方'
        : focus.sourceType === 'community' ? '社区用户' : '来源未标明'
      parts.push(`内容来源：${source}；审核状态：${focus.reviewStatus === 'approved' ? '已审核' : '未确认'}`)
      if (focus.sourceType === 'community' && focus.reviewStatus !== 'approved') {
        parts.push('强制规则：这是一份尚未审核的社区解析。回答前必须先独立检查当前步骤的数学正确性；若错误或条件不足，先明确指出，不得沿着错误思路继续解释。')
      }
    }
    if (includeSolution && intent !== 'hint' && intent !== 'verify') {
      if (context.answer) parts.push(`参考答案：\n${context.answer}`)
      if (context.solution) parts.push(`参考解析：\n${context.solution}`)
    }
  }

  const instructions = {
    hint: hintInstruction(hintLevel, previousHints),
    solution: '用户明确要求完整解答。请给出有条件说明和关键推导的完整解法；不要再要求用户先尝试。',
    verify: '仅讨论用户指出的当前步骤，判断依据与缺失条件；不要透露后续步骤或完整答案。此处没有确定性数学验证工具，不要声称已经通过工具验证。',
    explain: '请分析这道题的考点、突破口和关键步骤，再给出清晰但不过度冗长的讲解。若仅凭题干无法确定唯一方法，请明确说明。',
    'search-help': '请把用户的训练目标整理成适合高考数学题库搜索的知识点、题型结构和方法关键词。',
    chat: userText,
  }
  parts.push(instructions[intent] || userText)
  if (intent !== 'chat' && userText) parts.push(userText)
  return parts.filter(Boolean).join('\n\n')
}

export function responseActions(intent, hintLevel, { canWriteAttempt = false } = {}) {
  const tryNextStep = canWriteAttempt
    ? [{ label: '写下我的下一步', type: 'continue_attempt', primary: true }]
    : []
  if (intent === 'explain' || intent === 'verify') return tryNextStep
  if (intent !== 'hint') return []
  if (hintLevel >= 5) return []
  if (hintLevel < 4) {
    return [
      ...tryNextStep,
      { label: '再提示一点', taskType: 'hint', primary: !canWriteAttempt },
      { label: '查看完整解答', taskType: 'solution', primary: false },
    ]
  }
  return [...tryNextStep, { label: '查看完整解答', taskType: 'solution', primary: !canWriteAttempt }]
}

export function attemptFollowUpAction({ routeStatus = '', arithmeticIssue = false } = {}) {
  if (arithmeticIssue) return { label: '修正这一行', type: 'edit_attempt', primary: true }
  if (['valid', 'valid_but_incomplete', 'valid_but_inefficient'].includes(routeStatus)) {
    return { label: '继续补充草稿', type: 'continue_attempt', primary: true }
  }
  return { label: '修改草稿', type: 'edit_attempt', primary: true }
}
