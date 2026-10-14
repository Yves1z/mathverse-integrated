// Excalidraw 和 React 运行时都在这里按需加载：两者合计约 490 KB（gzip），
// 只有真正需要画板时才下载，题目页入口包不受影响。
function loadDraftCanvasModules() {
  return Promise.all([
    import('react-dom/client'),
    import('react'),
    import('./DraftCanvasIsland.jsx'),
  ])
}

export async function mountDraftCanvas(host, props = {}) {
  const [{ createRoot }, { createElement }, { default: DraftCanvasIsland }] =
    await loadDraftCanvasModules()
  if (props.isActive && !props.isActive()) return () => {}

  const root = createRoot(host)
  root.render(createElement(DraftCanvasIsland, props))

  return () => root.unmount()
}

// 触屏设备默认就走画板版式，空闲时先把 chunk 取回来，展开时不用等下载。
export function prefetchDraftCanvas() {
  void loadDraftCanvasModules().catch(() => {})
}
