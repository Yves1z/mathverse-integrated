// Fit A–D into 4, 2 or 1 columns by measured width, matching the paper print layout.
export function applyChoiceColumns(root) {
  for (const choices of root.querySelectorAll('.math-choices')) {
    const items = [...choices.querySelectorAll('.math-choice-content')]
    if (!items.length) continue
    choices.style.setProperty('--choice-columns', '1')
    for (const item of items) item.style.maxWidth = ''
    const widest = Math.max(...items.map((item) => item.getBoundingClientRect().width))
    const style = getComputedStyle(choices)
    const gap = parseFloat(style.columnGap) || 0
    const width =
      choices.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    choices.style.setProperty(
      '--choice-columns',
      widest <= (width - 3 * gap) / 4 ? '4' : widest <= (width - gap) / 2 ? '2' : '1',
    )
    for (const item of items) item.style.maxWidth = '100%'
  }
}
