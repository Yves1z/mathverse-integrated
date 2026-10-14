import { verifyCombinationEquality } from './arithmeticVerifier.js'
import { findExplicitLogBindingRisk } from './explicitLogBinding.js'

const LOG_DENIAL = /无定义|未定义|不可|不能|不应|错误|反例/
const CONDITION_DENIAL = /不成立|不对|错误|并非|不是|不可能|不能|无效|应排除|需排除/
const LOG_LITERAL = /(?:\\ln|\\log|\bln|\blog)\s*(?:\(\s*(-?\d+(?:\.\d+)?)\s*\)|(-?\d+(?:\.\d+)?)(?![\d.]))/gi
const CONDITION_UNIVERSE = /(?:条件下|前提下|已知.{0,24}(?:时|后)|给定.{0,24}(?:时|后)).{0,40}样本空间.{0,20}(?:仍|依然|还是|不变|所有|全部)/

function hasUnnegatedNonpositiveLog(raw) {
  for (const clause of raw.split(/[。；;！？!?\n]/)) {
    if (LOG_DENIAL.test(clause)) continue
    for (const match of clause.matchAll(LOG_LITERAL)) {
      if (Number(match[1] ?? match[2]) <= 0) return true
    }
  }
  return false
}

function assertsUnchangedConditionalSpace(raw) {
  return raw.split(/[。；;！？!?\n]/).some((clause) =>
    CONDITION_UNIVERSE.test(clause) && !CONDITION_DENIAL.test(clause))
}

// These are conservative review holds, not proofs that a whole step is wrong.
// The only numerical assertion below is the exact combination identity.
export function findAttemptReviewCaution(attempt, review, analysis) {
  if (analysis?.firstIssueStep !== null && analysis?.firstIssueStep !== undefined) {
    const step = attempt.steps[analysis.firstIssueStep - 1]
    const combination = verifyCombinationEquality(analysis.evidenceQuote)
    if (step && combination.status === 'valid') {
      return { kind: 'verified_quote_conflict', step,
        content: `第 ${step.number} 步引用的组合等式 ${combination.checkedClaim} 数值成立；这不证明它适用于本题，但模型对该步的否定也尚无充分依据。请先核对计数对应的事件与条件。` }
    }
  }

  const last = Math.min(review.reviewThrough,
    analysis?.firstIssueStep === null ? Infinity : analysis?.firstIssueStep - 1)
  const bindingRisk = findExplicitLogBindingRisk(attempt.steps.slice(0, last))
  for (const step of attempt.steps.slice(0, last)) {
    const raw = step.rawContent
    if (hasUnnegatedNonpositiveLog(raw)) {
      return { kind: 'literal_log_nonpositive', step,
        content: `第 ${step.number} 步出现对非正数取对数的表达式，它在实数范围无定义。请先检查这里是否把它当作可计算的函数值；后续算术错误不能代替这个前提检查。` }
    }
    if (bindingRisk?.step.id === step.id) {
      return { kind: 'bound_log_nonpositive', step,
        content: `第 ${bindingRisk.bindingStep.number} 步明确取 ${bindingRisk.variable}=${bindingRisk.value}；按这个取值，第 ${step.number} 步的对数在实数范围无定义。请先核对取值是否仍适用于这里，再继续检查后续；这只是明确取值下的前提提示，不是整条路线已验证。` }
    }
    if (assertsUnchangedConditionalSpace(raw)) {
      return { kind: 'conditional_sample_space', step,
        content: `第 ${step.number} 步声称加入条件后样本空间仍是全部。请先核对条件事件是否排除了一些取法；这一步尚未被工具证明，暂不把后续算术错误当作全稿第一处障碍。` }
    }
    const previous = review.evidence.find((entry) => entry.order === step.number - 1)
    if (previous?.status === 'valid' && /^(?:所以|因此|故|由此)/.test(raw.trim())
      && /任意|任何|所有|一切|每个|恒|必然/.test(raw)) {
      return { kind: 'unverified_implication', step,
        content: `第 ${step.number} 步由前一条成立的算术等式推出全称结论。算术核验不能证明这个推理；请先补充从等式到结论的依据。` }
    }
  }
  return null
}
