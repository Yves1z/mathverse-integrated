import { repeatsProvidedRange } from './routeConditionRange.js'
import { assertContextIntegrity } from './contextIntegrity.js'
import { reviewRouteCondition, needsRouteConditionRange, needsRouteConditionReading, needsDiscussionRangeCorrection } from './routeConditionReview.js'
import { validateStrategyMap } from './strategyMap.js'
import { parseRouteConditionResponse } from './routeCondition.js'
const SCHEMA_VERSION = 1
const BLOCK_TYPES = new Set(['text', 'hint', 'solution', 'warning', 'verification', 'error_location', 'question', 'strategy_map'])
const VERIFICATION_STATUSES = new Set(['valid', 'invalid', 'conditional', 'unknown'])
const OBVIOUS_ANSWER_DISCLOSURE = /\\boxed\s*\{|(?:最终|完整|直接)(?:答案|解答)|答案\s*(?:[:：]|为(?!什)|是(?!什))|故选\s*[A-D]/

function block(type, content, extra = {}) {
  return {
    id: crypto.randomUUID(),
    type,
    source: extra.source || 'provider',
    pedagogicalRole: extra.pedagogicalRole || 'explain',
    visibility: 'visible',
    content,
    ...extra,
  }
}

export function validateAgentResponse(response) {
  if (response?.metadata?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(response.blocks)) return false
  if (response.blocks.length < 1 || response.blocks.length > 4) return false
  return response.blocks.every((item) => (
    typeof item.id === 'string'
    && BLOCK_TYPES.has(item.type)
    && typeof item.content === 'string'
    && item.content.length > 0
    && item.content.length <= 12000
    && item.visibility === 'visible'
    && (item.type !== 'question' || response.intent !== 'teach_back' || (
      item.source === 'provider' && ['condition', 'reasoning', 'reading', 'method'].includes(item.probeKind)
      && typeof item.sourceQuote === 'string' && item.sourceQuote.trim().length > 0 && item.sourceQuote.length <= 80
      && typeof item.purpose === 'string' && item.purpose.trim().length > 0 && item.purpose.length <= 120
    ))
    && (item.type !== 'question' || response.intent !== 'route_condition' || (
      (item.source === 'provider' || (item.source === 'context_policy'
        && response.metadata.status === 'unknown'
        && ((item.reason === 'unsupported_discussion_range' && !item.provenance)
          || (item.reason === 'unconfirmed_reading' && item.readingState === 'unconfirmed' && !item.provenance)
          || (item.provenance?.tool === 'verify_interval_condition' && item.provenance.version === 1
            && item.provenance.scope === 'single_variable_interval' && item.reason === 'missing_range')))) && /^method-[1-3]$/.test(item.routeId)
      && ['applicability', 'missing'].includes(item.conditionKind)
      && typeof item.conditionText === 'string' && item.conditionText.trim().length > 0 && item.conditionText.length <= 160
      && (response.metadata.questionProtocol !== 'range_scoped_v1' || Boolean(item.probeKind))
      && (!item.probeKind || (['discussion_range', 'condition_reasoning', 'reading'].includes(item.probeKind)
        && typeof item.sourceQuote === 'string' && item.sourceQuote.trim().length > 0 && item.sourceQuote.length <= 80
        && typeof item.purpose === 'string' && item.purpose.trim().length > 0 && item.purpose.length <= 120
        && ['condition', 'problem', 'selection', 'note', 'discussion_range'].includes(item.quoteSource)
        && (item.probeKind === 'discussion_range' ? /^[A-Za-z]$/.test(item.rangeVariable) : item.rangeVariable === null)))
      && item.content.length <= 200 && (item.content.match(/[?？]/g) || []).length <= 1
    ))
    && (item.type !== 'solution' || response.intent === 'solution')
    && (item.type !== 'hint' || (
      response.intent === 'hint'
      && Number.isInteger(item.hintLevel)
      && item.hintLevel >= 0
      && item.hintLevel <= 4
    ))
    && (item.type !== 'verification' || (
      item.source === 'math_tool'
      && VERIFICATION_STATUSES.has(item.status)
      && (item.provenance?.tool === 'verify_arithmetic_equality'
        || (['verify_ordered_difference_sign', 'verify_interval_condition'].includes(item.provenance?.tool)
          && item.provenance.version === 1
          && item.provenance.scope === (item.provenance.tool === 'verify_interval_condition' ? 'single_variable_interval' : 'single_difference_sign')
          && Array.isArray(item.assumptions) && item.assumptions.length === 1
          && typeof item.assumptions[0] === 'string'
          && (item.provenance.tool !== 'verify_interval_condition'
            || (['valid', 'invalid'].includes(item.status)
              && item.relation === (item.status === 'valid' ? 'subset' : 'disjoint')))))
    ))
    && (item.type !== 'verification' || response.intent !== 'route_condition' || (
      ['verify_ordered_difference_sign', 'verify_interval_condition'].includes(item.provenance?.tool)
      && ['valid', 'invalid'].includes(item.status) && /^method-[1-3]$/.test(item.routeId)
      && ['applicability', 'missing'].includes(item.conditionKind)
      && typeof item.conditionText === 'string' && item.conditionText.trim().length > 0 && item.conditionText.length <= 160
      && typeof item.checkedClaim === 'string' && item.checkedClaim.length > 0 && item.checkedClaim.length <= 80
      && typeof item.expectedClaim === 'string' && item.expectedClaim.length > 0 && item.expectedClaim.length <= 80
    ))
    && (item.type !== 'error_location' || (
      typeof item.attemptStepId === 'string'
      && Number.isInteger(item.attemptVersion)
      && item.attemptVersion > 0
    ))
    && (item.type !== 'strategy_map' || (
      response.intent === 'strategy'
      && validateStrategyMap(item.map)
    ))
  ))
}

export function composeRouteConditionReviewResponse(context) {
  // Recompute from the validated snapshot; provider-supplied proof fields are never accepted.
  const review = reviewRouteCondition(context)
  if (!['valid', 'invalid'].includes(review.status) && !needsRouteConditionRange(context, review) && !needsRouteConditionReading(context, review) && !needsDiscussionRangeCorrection(context)) throw new Error('当前路线条件没有可用的确定性核验结果')
  const target = context.routeCondition
  const response = { responseId: crypto.randomUUID(), intent: 'route_condition', blocks: [],
    metadata: { schemaVersion: SCHEMA_VERSION, status: review.status, createdAt: new Date().toISOString() } }
  if (OBVIOUS_ANSWER_DISCLOSURE.test([target.routeName, target.conditionText, target.clue.sourceQuote].join('\n'))) {
    response.blocks.push(block('warning', '条件内容可能提前泄露答案，已隐藏。可重新比较当前路线，或主动查看完整解答。',
      { source: 'response_guard', pedagogicalRole: 'warn' }))
  } else if (needsRouteConditionReading(context, review)) {
    response.blocks.push(block('text', '当前条件读法尚未确认，先核对关键符号。', { source: 'context_policy' }))
    response.blocks.push(block('question', '你能核对题干、所选条件和当前说明的关键符号，再明确确认读法吗？', {
      source: 'context_policy', pedagogicalRole: 'prompt', reason: 'unconfirmed_reading', readingState: 'unconfirmed',
      routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText }))
    response.blocks.push(block('warning', '读法未确认不代表数学错误。模型不能替你确认；本次未调用模型或数学工具，条件仍未经数学工具验证。',
      { source: 'response_guard', pedagogicalRole: 'warn' }))
  } else if (needsDiscussionRangeCorrection(context)) {
    response.blocks.push(block('text', '讨论范围尚不能按支持语法读取，原输入已保留。', { source: 'context_policy' }))
    response.blocks.push(block('question', '请将本次讨论范围写成一个明确的单变量区间，例如 x≥0 或 x∈[0,2]？', {
      source: 'context_policy', pedagogicalRole: 'prompt', reason: 'unsupported_discussion_range',
      routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText,
      probeKind: 'reading', rangeVariable: null, quoteSource: 'discussion_range',
      sourceQuote: context.routeConditionDiscussionRange.raw.slice(0, 80), purpose: '明确本次讨论范围的区间读法' }))
    response.blocks.push(block('warning', '输入未被支持不代表数学错误；本次未调用模型或数学工具。讨论范围仍是学生选择，不是题设。', { source: 'response_guard' }))
  } else if (needsRouteConditionRange(context, review)) {
    response.blocks.push(block('text', '当前材料还不能核对所选区间条件。', { source: 'context_policy' }))
    response.blocks.push(block('question', `请补充题设中 ${review.variable} 的取值范围，或说明你打算在哪个范围讨论？`, {
      source: 'context_policy', pedagogicalRole: 'prompt', reason: 'missing_range',
      routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText,
      provenance: { tool: review.tool, version: review.version, scope: review.scope } }))
    response.blocks.push(block('warning', '未取得支持语法内的明确题设范围，所选条件未经数学工具验证；缺少材料不代表数学错误。本次未发送给模型。',
      { source: 'response_guard', pedagogicalRole: 'warn' }))
  } else {
    const interval = review.tool === 'verify_interval_condition'
    const content = interval ? review.status === 'invalid'
      ? `AI 候选条件“${review.checkedClaim}”与题设范围“${review.assumptions[0]}”不相交；候选条件与该范围冲突。`
      : `题设范围“${review.assumptions[0]}”包含于所选条件“${review.checkedClaim}”的范围，所选区间条件成立。`
      : review.status === 'invalid'
      ? `AI 候选条件“${review.checkedClaim}”与题设“${review.assumptions[0]}”冲突；该题设给出的差值符号为“${review.expectedClaim}”。`
      : `在题设“${review.assumptions[0]}”下，所选条件“${review.checkedClaim}”的差值符号成立。`
    response.blocks.push(block('verification', content, { source: 'math_tool', pedagogicalRole: 'verify',
      status: review.status, ...(interval ? { relation: review.relation } : {}),
      checkedClaim: review.checkedClaim, expectedClaim: review.expectedClaim,
      assumptions: [...review.assumptions], routeId: target.routeId, conditionKind: target.conditionKind,
      conditionText: target.conditionText,
      contextRef: { problemId: context.problem.problemId, snapshotId: context.contextMetadata.snapshotId, mapId: target.mapId },
      provenance: { tool: review.tool, version: review.version, scope: review.scope } }))
    response.blocks.push(block('warning', `本次只核验所选候选条件的${interval ? '区间包含或不相交关系' : '差值符号'}。路线是否适用、条件是否充分及学生说明仍待单独判断。本次未发送给模型。`,
      { source: 'response_guard', pedagogicalRole: 'warn' }))
  }
  if (!validateAgentResponse(response)) throw new Error('路线条件核验未通过回复结构校验')
  return response
}

export function composeRouteConditionResponse(analysis, target, context) {
  assertContextIntegrity(context, 'route_condition')
  if (JSON.stringify(target) !== JSON.stringify(context.routeCondition)) throw new Error('回复目标与当前条件上下文不符')
  if (context.routeConditionReading.state !== 'confirmed' || needsDiscussionRangeCorrection(context)) return composeRouteConditionReviewResponse(context)
  const checked = parseRouteConditionResponse(JSON.stringify({ routeId: analysis.routeId, conditionKind: analysis.conditionKind,
    conditionText: analysis.conditionText, status: analysis.status, feedback: analysis.feedback, nextQuestion: analysis.nextQuestion,
    ...(context.routeConditionDiscussionRange ? { probe: analysis.probe } : {}) }), target, context)
  const response = { responseId: crypto.randomUUID(), intent: 'route_condition', blocks: [],
    metadata: { schemaVersion: SCHEMA_VERSION, status: checked.status,
      ...(context.routeConditionDiscussionRange ? { questionProtocol: 'range_scoped_v1' } : {}), createdAt: new Date().toISOString() } }
  const content = [checked.feedback, checked.nextQuestion, checked.probe?.purpose, checked.probe?.sourceQuote, target.routeName, target.conditionText, target.clue.sourceQuote].join('\n')
  if (OBVIOUS_ANSWER_DISCLOSURE.test(content)) {
    response.blocks.push(block('warning', '条件核对回复可能提前泄露答案，已隐藏。可重试当前条件，或主动查看完整解答。', { source: 'response_guard', pedagogicalRole: 'warn' }))
  } else if (repeatsProvidedRange(checked, context.routeConditionDiscussionRange)) {
    response.metadata.status = 'range_recorded'
    response.blocks.push(block('text', `已记录你选定的讨论范围：${context.routeConditionDiscussionRange.raw}。本次停止重复询问该范围。`, { source: 'context_policy' }))
    response.blocks.push(block('warning', '只结束这项范围补充；题设范围、条件是否成立和整条路线是否充分仍未验证。模型的重复问题及反馈已隐藏。', { source: 'response_guard' }))
  } else {
    response.blocks.push(block('text', checked.feedback))
    if (checked.nextQuestion) response.blocks.push(block('question', checked.nextQuestion, { pedagogicalRole: 'prompt',
      routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText,
      ...(checked.probe ? { probeKind: checked.probe.kind, rangeVariable: checked.probe.variable,
        quoteSource: checked.probe.source, sourceQuote: checked.probe.sourceQuote, purpose: checked.probe.purpose } : {}) }))
    response.blocks.push(block('warning', '这里只讨论所选的一个条件，属于 AI 初步反馈，未经数学工具验证，不代表整条路线已成立。', { source: 'response_guard', pedagogicalRole: 'warn' }))
  }
  if (!validateAgentResponse(response)) throw new Error('条件核对未通过回复结构校验')
  return response
}

export function composeStrategyMapResponse(map) {
  if (!validateStrategyMap(map)) throw new Error('路线图未通过结构校验')
  const response = {
    responseId: crypto.randomUUID(), intent: 'strategy', blocks: [],
    metadata: { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() },
  }
  const allText = [map.overview, map.choiceRule,
    ...map.routes.flatMap((route) => [route.name, route.when, route.firstMove, route.workload, route.switchSignal,
      route.basis.sourceQuote, route.basis.missingCondition])].join('\n')
  if (OBVIOUS_ANSWER_DISCLOSURE.test(allText)) {
    response.blocks.push(block('warning', '路线图可能提前泄露答案，已隐藏。可重新请求路线图，或主动查看完整解答。', {
      source: 'response_guard', pedagogicalRole: 'warn',
    }))
  } else {
    response.blocks.push(block('strategy_map', map.overview, {
      map, pedagogicalRole: 'compare',
    }))
    response.blocks.push(block('warning', '原文线索只核对了来源，不证明方法成立或最快。路线与条件是 AI 的初步判断，尚未经确定性数学工具验证。', {
      source: 'response_guard', pedagogicalRole: 'warn',
    }))
  }
  if (!validateAgentResponse(response)) throw new Error('路线图未通过结构校验')
  return response
}

export function composeAgentResponse({ intent, content = '', hintLevel = 0, verification = null }) {
  const text = String(content).trim()
  const response = {
    responseId: crypto.randomUUID(),
    intent,
    blocks: [],
    metadata: { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() },
  }

  if (verification?.status === 'valid' || verification?.status === 'invalid') {
    response.blocks.push(block('verification', verification.explanation, {
      source: 'math_tool',
      pedagogicalRole: 'verify',
      status: verification.status,
      checkedClaim: verification.checkedClaim,
      provenance: { tool: 'verify_arithmetic_equality', version: 1 },
    }))
  } else if (intent === 'hint' && hintLevel < 5 && OBVIOUS_ANSWER_DISCLOSURE.test(text)) {
    response.blocks.push(block('warning', '模型回复可能提前泄露答案，已隐藏。这条内容未计入已展示提示；可以重新请求提示，或主动查看完整解答。', {
      source: 'response_guard',
      pedagogicalRole: 'warn',
    }))
  } else if (text) {
    const type = intent === 'hint' && hintLevel < 5 ? 'hint' : intent === 'solution' ? 'solution' : 'text'
    response.blocks.push(block(type, text.slice(0, 12000), {
      pedagogicalRole: type === 'hint' ? 'prompt' : type === 'solution' ? 'reveal' : 'explain',
      ...(type === 'hint' ? { hintLevel } : {}),
    }))
    if (intent === 'verify') {
      response.blocks.push(block('warning', '这是 AI 对步骤的分析，尚未经确定性数学工具验证。', {
        source: 'response_guard',
        pedagogicalRole: 'warn',
      }))
    }
  }

  if (!validateAgentResponse(response)) throw new Error('学习回复未通过结构校验')
  return response
}

export function composeDraftHintResponse(options) {
  const premiseStepNumber = options?.premiseStepNumber
  const text = String(options?.content ?? '').trim()
  if (directlyEndorsesSelectedPremise(text, premiseStepNumber)) {
    const response = { responseId: crypto.randomUUID(), intent: 'hint', blocks: [
      block('warning', `模型直接肯定了学生选入的第 ${premiseStepNumber} 步，但这一步未经完整数学验证；已隐藏这条回复，且未计入提示进度。请核对或修改该步，也可取消补入此前提后重试。`, {
        source: 'response_guard', pedagogicalRole: 'warn',
        guardReason: 'unverified_premise_endorsement', attemptStepNumber: premiseStepNumber,
      }),
    ], metadata: { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() } }
    if (!validateAgentResponse(response)) throw new Error('前提肯定守卫未通过结构校验')
    return response
  }
  const response = composeAgentResponse({ ...options, intent: 'hint', verification: null })
  if (response.blocks[0].type !== 'warning') response.blocks.push(block('warning',
    '这是基于当前草稿的 AI 初步提示，数学路线尚未经完整验证。请先尝试这一小步。',
    { source: 'response_guard', pedagogicalRole: 'warn' }))
  if (!validateAgentResponse(response)) throw new Error('草稿提示未通过结构校验')
  return response
}

function directlyEndorsesSelectedPremise(text, stepNumber) {
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 40) return false
  const chinese = stepNumber <= 10 ? '一二三四五六七八九十'[stepNumber - 1] : null
  const step = `(?:草稿)?第\\s*(?:${stepNumber}${chinese ? `|${chinese}` : ''})\\s*步`
  const premise = '(?:(?:学生)?(?:选入的|补入的|该|这个))?前提'
  const subject = `(?:${step}|${premise})`
  const approval = '(?:(?:完全|确实|已经|本身|是|就是|肯定|显然)\\s*){0,3}(?:正确|没问题|无误|成立|是对的|没有错|没错|可以放心沿用|可以直接沿用|可直接沿用)'
  // A predicate prefix is not an assertion: “成立的条件” and “正确与否” stay review questions.
  const assertionEnd = '(?=\\s*(?:的\\s*)?(?:$|[。；;！!\\n]|[，,](?!\\s*(?:是吗|对吗|仅当|当且仅当|还是[^。！？!?\\n]{0,100}[？?]))))'
  const direct = new RegExp(`(?:^|[。！？!?\\n])\\s*${subject}\\s*[：:]?\\s*${approval}${assertionEnd}`)
  const referent = '(?:这一步|该步|它|这个前提|该前提)'
  const introduced = new RegExp(`(?:^|[。！？!?\\n])\\s*(?:先看|来看|关于|就)\\s*${subject}\\s*(?:而言|来说)?\\s*[：:，,]\\s*${referent}\\s*${approval}${assertionEnd}`)
  // Inspect a copy; retain the exact provider text for display and the separate answer guard.
  const probe = text
    .replace(/“[^”]*”|「[^」]*」|『[^』]*』|‘[^’]*’|"[^"\n]*"/g, quoted => quoted.replace(/[^\n]/g, ' '))
    .replace(/^[\t ]*(?:[-+*]|\d{1,2}[.)、])[\t ]+/gm, '')
    .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, stars, underscores) => stars ?? underscores)
  return direct.test(probe) || introduced.test(probe)
}

export function composePremiseSignResponse(result, stepNumber) {
  if (result?.tool !== 'verify_ordered_difference_sign' || result.version !== 1
    || result.status !== 'invalid' || result.scope !== 'single_difference_sign'
    || !Number.isInteger(stepNumber) || stepNumber < 1
    || typeof result.checkedClaim !== 'string' || typeof result.expectedClaim !== 'string'
    || !Array.isArray(result.assumptions) || result.assumptions.length !== 1) {
    throw new Error('前提核对证据不完整')
  }
  const response = { responseId: crypto.randomUUID(), intent: 'verify', blocks: [
    block('verification', `草稿第 ${stepNumber} 步的“${result.checkedClaim}”与题目条件“${result.assumptions[0]}”冲突；由该条件可核对“${result.expectedClaim}”。`, {
      source: 'math_tool', pedagogicalRole: 'verify', status: 'invalid',
      checkedClaim: result.checkedClaim, assumptions: [...result.assumptions],
      provenance: { tool: result.tool, version: result.version, scope: result.scope },
    }),
    block('warning', '这里只核对这一条差值符号，未验证整步。本次未发送给模型；请修改草稿或取消补入该前提。', {
      source: 'response_guard', pedagogicalRole: 'warn',
    }),
  ], metadata: { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() } }
  if (!validateAgentResponse(response)) throw new Error('前提核对回复未通过结构校验')
  return response
}

export function composeAttemptResponse({ attempt, analysis = null, arithmeticIssue = null,
  reviewCaution = null, prefixReviewed = false, reviewScope = null }) {
  if (analysis && (analysis.attemptId !== attempt.id || analysis.attemptVersion !== attempt.version
    || (analysis.firstIssueStepId && !attempt.steps.some((step) => (
      step.id === analysis.firstIssueStepId && step.number === analysis.firstIssueStep
      && typeof analysis.evidenceQuote === 'string' && analysis.evidenceQuote.length > 0
      && analysis.evidenceQuote.length <= 120 && step.rawContent.includes(analysis.evidenceQuote)
    ))) || (!analysis.firstIssueStepId && analysis.evidenceQuote))) {
    throw new Error('草稿分析引用与当前版本不一致，请重新检查')
  }
  if (arithmeticIssue && (!attempt.steps.some((step) => step.id === arithmeticIssue.step?.id
    && step.rawContent === arithmeticIssue.step.rawContent)
    || arithmeticIssue.verification?.status !== 'invalid')) {
    throw new Error('算术证据与当前草稿不一致，请重新检查')
  }
  if (reviewCaution && (!attempt.steps.some((step) => step.id === reviewCaution.step?.id
    && step.number === reviewCaution.step.number && step.rawContent === reviewCaution.step.rawContent)
    || typeof reviewCaution.content !== 'string' || !reviewCaution.content)) {
    throw new Error('前提检查与当前草稿不一致，请重新检查')
  }
  const response = {
    responseId: crypto.randomUUID(),
    intent: 'diagnose',
    blocks: [],
    metadata: {
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      attemptId: attempt.id,
      attemptVersion: attempt.version,
    },
  }

  if (reviewCaution) {
    response.blocks.push(block('warning', reviewCaution.content, {
      source: 'response_guard', pedagogicalRole: 'warn',
      attemptStepId: reviewCaution.step.id, attemptVersion: attempt.version,
      stepNumber: reviewCaution.step.number,
    }))
  } else if (arithmeticIssue) {
    response.blocks.push(block('error_location',
      `第 ${arithmeticIssue.step.number} 步的纯算术等式左右不相等。这是本次找到的首个可验证算术问题；此前与其它逻辑尚未核验，请先重新计算这一行。`, {
        source: 'math_tool',
        pedagogicalRole: 'warn',
        attemptStepId: arithmeticIssue.step.id,
        attemptVersion: attempt.version,
        stepNumber: arithmeticIssue.step.number,
        provenance: { tool: 'verify_arithmetic_equality', version: 1 },
      }))
    response.blocks.push(block('verification', arithmeticIssue.verification.explanation, {
      source: 'math_tool',
      pedagogicalRole: 'verify',
      status: 'invalid',
      checkedClaim: arithmeticIssue.verification.checkedClaim,
      attemptStepId: arithmeticIssue.step.id,
      attemptVersion: attempt.version,
      provenance: { tool: 'verify_arithmetic_equality', version: 1 },
    }))
    if (prefixReviewed) response.blocks.push(block('warning',
      '前面的步骤仅经 AI 初步分析，未发现更早障碍，但尚未经确定性工具证明。这里的“已验证”只指当前算术等式不成立。', {
        source: 'response_guard', pedagogicalRole: 'warn',
      }))
  } else if (analysis) {
    if (OBVIOUS_ANSWER_DISCLOSURE.test(`${analysis.evidenceQuote || ''}\n${analysis.feedback}\n${analysis.nextQuestion}`)) {
      response.blocks.push(block('warning', '模型分析可能提前透露完整答案，已隐藏。草稿仍保留，你可以重新检查。', {
        source: 'response_guard',
        pedagogicalRole: 'warn',
      }))
    } else {
      response.blocks.push(block(analysis.firstIssueStepId ? 'error_location' : 'text',
        analysis.firstIssueStepId ? `草稿原文：${analysis.evidenceQuote}\n${analysis.feedback}` : analysis.feedback, {
        source: 'provider',
        pedagogicalRole: analysis.firstIssueStepId ? 'warn' : 'explain',
        ...(analysis.firstIssueStepId ? {
          attemptStepId: analysis.firstIssueStepId,
          attemptVersion: attempt.version,
          stepNumber: analysis.firstIssueStep,
        } : {}),
      }))
      if (analysis.nextQuestion) response.blocks.push(block('question', analysis.nextQuestion, {
        source: 'provider',
        pedagogicalRole: 'prompt',
      }))
      response.blocks.push(block('warning', '以上为 AI 初步分析，尚未经确定性数学工具验证；若与草稿不符，请指出具体步骤。', {
        source: 'response_guard',
        pedagogicalRole: 'warn',
      }))
      if (reviewScope) response.blocks.push(block('warning',
        `本轮先检查第 1 至 ${reviewScope} 步。请先处理这里的障碍或不确定之处，再检查后续；未展示的后续步骤不代表正确。`, {
          source: 'response_guard', pedagogicalRole: 'warn',
        }))
    }
  }

  if (!validateAgentResponse(response)) throw new Error('草稿回复未通过结构校验')
  return response
}

export function composeTeachBackResponse(analysis) {
  const response = {
    responseId: crypto.randomUUID(),
    intent: 'teach_back',
    blocks: [],
    metadata: {
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      status: analysis.status,
    },
  }
  if (OBVIOUS_ANSWER_DISCLOSURE.test(`${analysis.feedback}\n${analysis.nextQuestion}\n${analysis.probe?.sourceQuote || ''}\n${analysis.probe?.purpose || ''}`)) {
    response.blocks.push(block('warning', '模型反馈可能提前泄露答案，已隐藏。你的解释仍保留，可以重新提交。', {
      source: 'response_guard', pedagogicalRole: 'warn',
    }))
  } else {
    response.blocks.push(block('text', analysis.feedback, { pedagogicalRole: 'explain' }))
    if (analysis.nextQuestion) response.blocks.push(block('question', analysis.nextQuestion, {
      pedagogicalRole: 'prompt', probeKind: analysis.probe?.kind,
      sourceQuote: analysis.probe?.sourceQuote, purpose: analysis.probe?.purpose,
    }))
    response.blocks.push(block('warning', '这是 AI 的初步反馈，未经确定性数学工具验证，也不作为长期掌握度评分。', {
      source: 'response_guard', pedagogicalRole: 'warn',
    }))
  }
  if (!validateAgentResponse(response)) throw new Error('理解反馈未通过结构校验')
  return response
}
