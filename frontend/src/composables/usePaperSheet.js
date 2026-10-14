import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MM, PAPER_SIZES, paperSections, questionBands, safePageCut } from '../utils/paperLayout.js'

// 「适合宽度」在画布内边距之外再留一点余量，避免滚动条取整把纸张顶出边界。
const FIT_MARGIN = 2
const ZOOM_RANGE = [0.28, 1.5]

/**
 * 试卷卷面的排版引擎：把 items 排成固定纸张尺寸的分页，负责缩放、适合宽度与打印。
 * 组卷页（PaperBuilderView）与试卷详情页（SharedPaperView）共用同一套排版结果，
 * 因此两边的卷面 DOM 必须由 PaperSheetView 渲染，保持一致。
 */
export function usePaperSheet({
  items,
  title,
  size,
  fitRange = ZOOM_RANGE,
  initialZoom = 0.8,
  initialAutoFit = true,
  layoutGuard = null,
  onPrintError = null,
}) {
  const workspace = ref(null)
  const measure = ref(null)
  const pages = ref([{ fragments: [] }])
  const layingOut = ref(false)
  const layoutError = ref('')
  const printing = ref(false)
  const zoom = ref(initialZoom)
  const autoFit = ref(initialAutoFit)
  let layoutTimer = 0
  let layoutId = 0
  let resizeObserver = null
  let disposed = false

  const sheet = computed(() => PAPER_SIZES[size.value])
  // 稳定引用的 ref 回调，交给 PaperSheetView 绑定画布与测量容器。
  const bindCanvas = (element) => {
    workspace.value = element
  }
  const bindMeasure = (element) => {
    measure.value = element
  }

  const sheetStyle = computed(() => ({
    '--paper-width': `${sheet.value.width}mm`,
    '--paper-height': `${sheet.value.height}mm`,
  }))
  const sections = computed(() => paperSections(items.value))
  const totalScore = computed(() => sections.value.reduce((sum, group) => sum + group.total, 0))
  const headingFor = (index) =>
    sections.value.find((group) => group.entries[0].index === index)?.heading || ''
  const showScoreFor = (index) =>
    sections.value.find((group) => group.entries.some((entry) => entry.index === index))
      ?.showItemScore ?? true

  function fit() {
    const element = workspace.value
    if (!autoFit.value || !element) return
    const style = getComputedStyle(element)
    const available =
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    zoom.value = Math.min(
      fitRange[1],
      Math.max(fitRange[0], (available - FIT_MARGIN) / (sheet.value.width * MM)),
    )
  }

  function fitWidth() {
    autoFit.value = true
    fit()
  }

  function setZoom(event) {
    autoFit.value = false
    zoom.value = Number(event.target.value) / 100
  }

  function stepZoom(delta) {
    autoFit.value = false
    zoom.value = Math.max(
      ZOOM_RANGE[0],
      Math.min(ZOOM_RANGE[1], Math.round((zoom.value + delta) * 100) / 100),
    )
  }

  function queueLayout() {
    layoutId++
    layingOut.value = true
    clearTimeout(layoutTimer)
    layoutTimer = setTimeout(layout, 80)
  }

  async function layout() {
    if (layoutGuard?.()) {
      layoutTimer = setTimeout(layout, 120)
      return
    }
    const id = ++layoutId
    layingOut.value = true
    layoutError.value = ''
    await nextTick()
    await document.fonts.ready
    if (disposed || id !== layoutId || !measure.value) return
    const images = [...measure.value.querySelectorAll('img')]
    const loaded = await Promise.all(
      images.map(async (img) => {
        img.loading = 'eager'
        try {
          await Promise.race([
            img.decode(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
          ])
          return true
        } catch {
          return false
        }
      }),
    )
    if (disposed || id !== layoutId) return
    if (loaded.some((ok) => !ok))
      layoutError.value = '部分配图未加载，暂不能打印。请检查网络后重试排版。'
    measure.value.querySelectorAll('.paper-choices').forEach((el) => {
      el.style.setProperty('--choice-columns', '1')
      el.querySelectorAll('.paper-choice-content').forEach((choice) => {
        choice.style.maxWidth = ''
      })
      const widths = [...el.querySelectorAll('.paper-choice-content')].map(
        (choice) => choice.getBoundingClientRect().width,
      )
      const max = Math.max(...widths)
      const style = getComputedStyle(el)
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const gap = parseFloat(style.columnGap)
      el.style.setProperty(
        '--choice-columns',
        max <= (width - 3 * gap) / 4 ? '4' : max <= (width - gap) / 2 ? '2' : '1',
      )
      el.querySelectorAll('.paper-choice-content').forEach((choice) => {
        choice.style.maxWidth = '100%'
      })
    })
    measure.value.querySelectorAll('.katex').forEach((el) => {
      if (el.parentElement.closest('.katex')) return
      el.style.fontSize = ''
      const container =
        el.closest('.paper-choice') ||
        el.closest('.math-question-body') ||
        el.closest('.paper-question-stem') ||
        el.closest('.math-text')
      if (container && el.getBoundingClientRect().width > container.clientWidth)
        el.style.fontSize = `${container.clientWidth / el.getBoundingClientRect().width}em`
    })
    const capacity = (sheet.value.height - 40) * MM
    const header = measure.value.querySelector('.paper-heading')
    const headerHeight =
      header.getBoundingClientRect().height + parseFloat(getComputedStyle(header).marginBottom)
    const result = [{ fragments: [], used: headerHeight }]
    const nextPage = () => {
      const p = { fragments: [], used: 0 }
      result.push(p)
      return p
    }
    const elements = [...measure.value.querySelectorAll('.paper-measure-question')]
    for (let index = 0; index < elements.length; index++) {
      const el = elements[index],
        item = items.value[index]
      const height = Math.ceil(el.getBoundingClientRect().height) + 1
      const html = el.innerHTML,
        bands = questionBands(el)
      const sectionHeading = el.querySelector('.paper-section-heading')
      if (sectionHeading)
        bands.push([
          0,
          sectionHeading.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 35,
        ])
      let page = result.at(-1)
      if (
        (item.breakBefore || (height > capacity - page.used && height <= capacity)) &&
        page.used > 0
      )
        page = nextPage()
      let offset = 0
      while (offset < height) {
        let room = capacity - page.used
        if (room < 45) {
          page = nextPage()
          room = capacity
        }
        let end = safePageCut(bands, offset, room, height)
        if (end <= offset + 1) {
          if (page.used) {
            page = nextPage()
            continue
          }
          // A single unusually tall formula is kept whole and scaled to one page.
          const scale = Math.min(1, capacity / (height - offset))
          page.fragments.push({
            index,
            html,
            offset,
            height: (height - offset) * scale,
            scale,
            first: offset === 0,
          })
          page.used = capacity
          offset = height
        } else {
          page.fragments.push({
            index,
            html,
            offset,
            height: end - offset,
            scale: 1,
            first: offset === 0,
          })
          page.used += end - offset
          offset = end
          if (offset < height) page = nextPage()
        }
      }
    }
    pages.value = result
    layingOut.value = false
    fit()
  }

  function finishPrint() {
    printing.value = false
    document.getElementById('paper-print-root')?.remove()
    document.getElementById('paper-print-page-rule')?.remove()
    document.body.classList.remove('is-printing-paper')
  }

  async function printPaper() {
    await layout()
    if (layoutError.value || layingOut.value || !items.value.length) return
    await nextTick()
    const root = document.createElement('div')
    root.id = 'paper-print-root'
    const style = document.createElement('style')
    style.id = 'paper-print-page-rule'
    style.textContent = `@page { size: ${sheet.value.width}mm ${sheet.value.height}mm; margin: 0; }`
    workspace.value.querySelectorAll('.paper-sheet').forEach((el) => {
      const clone = el.cloneNode(true)
      clone.querySelectorAll('.paper-item-tools,.paper-drop-line').forEach((tool) => tool.remove())
      clone.removeAttribute('id')
      clone.style.zoom = '1'
      root.append(clone)
    })
    document.head.append(style)
    document.body.append(root)
    try {
      await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode()))
      printing.value = true
      document.body.classList.add('is-printing-paper')
      window.print()
    } catch {
      finishPrint()
      onPrintError?.('打印准备失败，请检查配图后重试')
    }
  }

  // 后台标签页里字体与图片解码可能一直不完成，排版会停在「正在排版…」，
  // 所以页面重新可见时再排一次。
  function handleVisibility() {
    if (document.visibilityState === 'visible') queueLayout()
  }

  // 详情页要等接口返回才渲染卷面，onMounted 时画布还不存在，
  // 所以观察器必须跟着画布元素走，否则窗口缩放后「适合宽度」不会再适配。
  function observeCanvas(element) {
    resizeObserver ??= new ResizeObserver(() => fit())
    resizeObserver.disconnect()
    if (!element) return
    resizeObserver.observe(element)
    if (!disposed) queueLayout()
  }

  watch([items, title, size], queueLayout, { deep: true })
  watch(workspace, observeCanvas)

  onMounted(() => {
    observeCanvas(workspace.value)
    window.addEventListener('resize', fit)
    window.addEventListener('afterprint', finishPrint)
    document.addEventListener('visibilitychange', handleVisibility)
  })

  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(layoutTimer)
    resizeObserver?.disconnect()
    window.removeEventListener('resize', fit)
    window.removeEventListener('afterprint', finishPrint)
    document.removeEventListener('visibilitychange', handleVisibility)
    finishPrint()
  })

  return {
    workspace,
    measure,
    bindCanvas,
    bindMeasure,
    pages,
    layingOut,
    layoutError,
    printing,
    zoom,
    autoFit,
    sheet,
    sheetStyle,
    sections,
    totalScore,
    headingFor,
    showScoreFor,
    fit,
    fitWidth,
    setZoom,
    stepZoom,
    queueLayout,
    printPaper,
  }
}
