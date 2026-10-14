import { useCallback, useRef, useState } from 'react'
import {
  convertToExcalidrawElements,
  Excalidraw,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { draftSceneSignature, selectInkScene } from './inkSelection.js'

// Excalidraw 自带的十字线和橡皮光标在白色画布/题目图的文字上几乎看不见，
// 所以按当前工具给容器挂个 class，由外层 CSS 换成高对比光标。
const DRAW_TOOL_TYPES = new Set([
  'freedraw',
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'text',
  'image',
  'frame',
])

function toolKindOf(type) {
  if (type === 'eraser') {
    return 'eraser'
  }

  return DRAW_TOOL_TYPES.has(type) ? 'draw' : 'select'
}

// 这些键每次交互都在变，存下来会让恢复后的画布停在半途状态
// （比如恢复成"笔刷选中"，用户一点画布就画出一道线）。
const VOLATILE_APP_STATE_KEYS = new Set([
  'activeTool',
  'collaborators',
  'contextMenu',
  'cursorButton',
  'draggingElement',
  'editingElement',
  'height',
  'multiElement',
  'offsetLeft',
  'offsetTop',
  'openDialog',
  'openPopup',
  'pendingImageElementId',
  'resizingElement',
  'scrollX',
  'scrollY',
  'selectionElement',
  'showStats',
  'width',
])

function pickAppState(appState) {
  const picked = {}

  for (const [key, value] of Object.entries(appState || {})) {
    if (VOLATILE_APP_STATE_KEYS.has(key)) {
      continue
    }
    picked[key] = value
  }

  return picked
}

export default function DraftCanvasIsland({ initialScene, onChange, onReady }) {
  // Excalidraw 挂载后马上会触发一次 onChange（内容是刚落盘的初始场景），
  // 不跳过的话一打开草稿区就会写盘、状态直接显示成"已保存"。
  const mountedRef = useRef(false)
  const [toolKind, setToolKind] = useState('select')

  const handleChange = useCallback(
    (elements, appState, files) => {
      setToolKind(toolKindOf(appState?.activeTool?.type))

      if (!mountedRef.current) {
        mountedRef.current = true
        return
      }
      onChange?.({ elements, appState: pickAppState(appState), files })
    },
    [onChange],
  )

  const bindApi = useCallback(
    (api) => {
      setToolKind(toolKindOf(api.getAppState()?.activeTool?.type))
      const snapshot = () => ({
        elements: api.getSceneElements(),
        appState: api.getAppState(),
        files: api.getFiles(),
      })

      // 草稿按坐标保存，恢复后的视口默认在原点；手机上画布窄，内容很容易落在屏幕外，
      // 那样打开草稿只会看到一张空画布，所以挂载后把内容滚回视野（不动缩放）。
      if (initialScene?.elements?.length) {
        window.setTimeout(() => {
          api.scrollToContent(api.getSceneElements(), { animate: false })
        }, 0)
      }

      onReady?.({
        getScene: () => ({ ...snapshot(), appState: pickAppState(api.getAppState()) }),
        captureSelection: async () => {
          const source = snapshot()
          const sceneSignature = draftSceneSignature(source)
          const scene = selectInkScene(source)
          const blob = await exportToBlob({ ...scene, mimeType: 'image/png', maxWidthOrHeight: 1800 })
          if (sceneSignature !== draftSceneSignature(snapshot())) throw new Error('画板已修改，请重新提交选区')
          return { blob, scene, sceneSignature }
        },
        exportPng: async () => {
          const scene = snapshot()
          return exportToBlob({
            elements: scene.elements,
            appState: scene.appState,
            files: scene.files,
            mimeType: 'image/png',
          })
        },
        exportSvg: async () => {
          const scene = snapshot()
          const svg = await exportToSvg({
            elements: scene.elements,
            appState: scene.appState,
            files: scene.files,
          })
          return new Blob([new XMLSerializer().serializeToString(svg)], {
            type: 'image/svg+xml',
          })
        },
        clear: () => api.updateScene({ elements: [] }),
        isEmpty: () => api.getSceneElements().length === 0,
        // 把一张图插到当前视口中央，并按视口大小缩到合适尺寸（用户可以再拖动缩放）。
        // 视口尺寸由外层量好传进来：容器宽度变化后 appState.width/height 可能还是旧值。
        insertImage: ({
          dataURL,
          mimeType = 'image/png',
          width,
          height,
          viewportWidth,
          viewportHeight,
        }) => {
          const appState = api.getAppState()
          const zoom = appState.zoom?.value || 1
          const viewWidth = viewportWidth || appState.width / zoom
          const viewHeight = viewportHeight || appState.height / zoom
          // viewWidth/viewHeight 是画布自身的尺寸（不是页面坐标），所以不要再减
          // appState.offsetLeft/offsetTop —— 那两个是画布相对页面的偏移，嵌在文档流里
          // 会等于页面上那个位置（测得 174/224），减掉会把内容摆到视口左上角外面去。
          const centerX = viewWidth / 2 / zoom - appState.scrollX
          const centerY = viewHeight / 2 / zoom - appState.scrollY
          // 让整张题目图一插入就完整可见（用户再自己缩放去写），所以宽高都要收着放。
          const fit = Math.min((viewWidth * 0.9) / width, (viewHeight * 0.85) / height, 1)
          const finalWidth = Math.round(width * fit)
          const finalHeight = Math.round(height * fit)
          const fileId = `stem-${Date.now()}`

          api.addFiles([{ id: fileId, dataURL, mimeType, created: Date.now() }])
          const [element] = convertToExcalidrawElements([
            {
              type: 'image',
              fileId,
              x: Math.round(centerX - finalWidth / 2),
              y: Math.round(centerY - finalHeight / 2),
              width: finalWidth,
              height: finalHeight,
              status: 'saved',
            },
          ])
          api.updateScene({ elements: [...api.getSceneElements(), element] })

          return `${finalWidth}×${finalHeight}`
        },
      })
    },
    [initialScene, onReady],
  )

  return (
    <div className={`question-draft-stage-inner is-tool-${toolKind}`}>
      <Excalidraw
        initialData={initialScene || undefined}
        excalidrawAPI={bindApi}
        onChange={handleChange}
        langCode="zh-CN"
      />
    </div>
  )
}
