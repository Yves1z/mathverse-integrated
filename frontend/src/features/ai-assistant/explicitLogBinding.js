const DENIAL = /无定义|未定义|不可|不能|不应|错误|反例/
const BRANCH = /^(?:若|如果|假设|当|分情况|反证|否则|另一方面|另一种情况)/
const LOG_VARIABLE = /(?:\\ln|\\log|\bln|\blog)\s*(?:\(\s*([A-Za-z])\s*\)|([A-Za-z])(?![A-Za-z0-9_^²³⁰¹⁴⁵⁶⁷⁸⁹′']))/g

// A small text guard, not an equation solver or a proof of dependency.
// Only literal, explicit 设/令/取 assignments survive; branches and unknown
// assignments invalidate the environment. Never substitute into expressions.
export function findExplicitLogBindingRisk(steps) {
  const bindings = new Map()
  for (const step of steps) {
    for (const part of step.rawContent.split(/[，,。；;！？!?\n]/)) {
      const clause = part.trim().replace(/\$/g, '')
      if (BRANCH.test(clause)) { bindings.clear(); continue }
      const assignment = clause.match(/^(?:设|令|取|改取|另取)\s*([A-Za-z])\s*=\s*(.+)$/)
      if (assignment) {
        const [, variable, rawValue] = assignment
        bindings.delete(variable)
        if (/^[+-]?\d+(?:\.\d+)?$/.test(rawValue) && rawValue.length <= 16) {
          bindings.set(variable, { value: Number(rawValue), bindingStep: step })
        }
        continue
      }
      const plainAssignment = clause.match(/^([A-Za-z])\s*=/)
      if (plainAssignment) bindings.delete(plainAssignment[1])
      if (/改为|重新|不再|变化/.test(clause)) bindings.clear()
      if (DENIAL.test(clause)) continue
      for (const match of clause.matchAll(LOG_VARIABLE)) {
        const variable = match[1] ?? match[2]
        const binding = bindings.get(variable)
        if (binding && binding.value <= 0) return { step, variable, ...binding }
      }
    }
  }
  return null
}
