export function draftSceneSignature(scene) {
  const liveFileIds = new Set((scene.elements || []).filter((e) => !e.isDeleted).map((e) => e.fileId).filter(Boolean))
  // Excalidraw may normalize version/nonce on remount without changing the ink.
  const metadata = new Set(['version', 'versionNonce', 'updated', 'index'])
  return JSON.stringify([
    (scene.elements || []).filter((e) => !e.isDeleted).map((e) => Object.fromEntries(
      Object.entries(e).filter(([key]) => !metadata.has(key)).sort(([a], [b]) => a.localeCompare(b)),
    )),
    Object.entries(scene.files || {}).filter(([id]) => liveFileIds.has(id)).map(([id, file]) => [id, file.dataURL]),
  ])
}

export function selectInkScene(scene) {
  const selected = scene.appState?.selectedElementIds || {}
  const elements = (scene.elements || []).filter((e) => selected[e.id] && !e.isDeleted)
  if (!elements.length) throw new Error('请用画板的选择工具框选要检查的笔迹，再提交选区')
  if (elements.length > 500) throw new Error('选区过大，请只选择当前要检查的几行')
  const fileIds = new Set(elements.map((e) => e.fileId).filter(Boolean))
  const files = Object.fromEntries(Object.entries(scene.files || {}).filter(([id]) => fileIds.has(id)))
  const raw = JSON.stringify({
    elements, files,
    appState: { exportBackground: true, viewBackgroundColor: '#ffffff' },
  })
  if (raw.length > 4_000_000) throw new Error('选区数据过大，请只选择当前要检查的几行')
  return JSON.parse(raw)
}
