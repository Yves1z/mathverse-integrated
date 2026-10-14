<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { loadPaperImage, createPaperArtifact, paperCropFromPercent, paperCropToPercent, orientedPaperDimensions, paperPreviewUrl } from './paperImage.js'
import { revisePaperSource, installPaperImage, isHandwritingCurrent } from '../draft/draftAgentBridge.js'

const props = defineProps({ problemId: { type: String, required: true }, disabled: Boolean,
  restoredArtifact: { type: Object, default: null } })
const emit = defineEmits(['cleared'])
const photo = ref(null)
const rotation = ref(0)
const previewUrl = ref('')
const crop = reactive({ x: 10, y: 10, width: 80, height: 80 })
const chosen = ref(false)
const busy = ref(false)
const error = ref('')
const enlarged = ref(null)
let operation = 0, source = null, dragStart = null, alive = true
const cropValid = computed(() => {
  if (!photo.value) return false
  try { paperCropFromPercent(photo.value.image.naturalWidth, photo.value.image.naturalHeight, crop, rotation.value); return true } catch { return false }
})
const cropStyle = computed(() => ({ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }))
const enlargedStyle = computed(() => {
  const d = photo.value ? orientedPaperDimensions(photo.value.image.naturalWidth, photo.value.image.naturalHeight, rotation.value) : { width: 1, height: 1 }
  return { width: `min(80vw, calc((100dvh - 140px) * ${d.width / d.height}))` }
})
watch(() => props.restoredArtifact, async (artifact) => {
  if (!artifact?.restored || artifact.sourceKind !== 'paper_image') return
  const run = ++operation
  busy.value = true; error.value = ''
  try {
    const loaded = await loadPaperImage(artifact.originalBlob)
    if (!alive || run !== operation || !isHandwritingCurrent(artifact)) { URL.revokeObjectURL(loaded.url); return }
    let preview
    try { preview = paperPreviewUrl(loaded, artifact.rotation ?? 0) }
    catch (failure) { URL.revokeObjectURL(loaded.url); throw failure }
    if (photo.value) URL.revokeObjectURL(photo.value.url)
    photo.value = loaded
    rotation.value = artifact.rotation ?? 0; previewUrl.value = preview
    Object.assign(crop, paperCropToPercent(artifact.crop, rotation.value))
    source = artifact
    chosen.value = false
  } catch (failure) { if (alive && run === operation) error.value = `${failure.message}；已恢复选区仍在核对区，可重新选择原图。` }
  finally { if (alive && run === operation) busy.value = false }
}, { immediate: true })
function revise() {
  operation += 1
  busy.value = false
  chosen.value = false
  source = revisePaperSource(props.problemId)
}
async function selectFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const run = ++operation
  busy.value = true; error.value = ''
  // A late decode must not reinstall a photo after an account change or unmount.
  const ownerSource = revisePaperSource(props.problemId, false)
  try {
    const loaded = await loadPaperImage(file)
    if (!alive || run !== operation || !isHandwritingCurrent(ownerSource)) { URL.revokeObjectURL(loaded.url); return }
    if (photo.value) URL.revokeObjectURL(photo.value.url)
    photo.value = loaded
    rotation.value = 0; previewUrl.value = loaded.url
    Object.assign(crop, { x: 10, y: 10, width: 80, height: 80 })
    revise()
  } catch (failure) { if (alive && run === operation) error.value = failure.message }
  finally { if (alive && run === operation) busy.value = false }
}
function rotatePhoto(delta) {
  if (!photo.value || props.disabled || busy.value) return
  revise(); dragStart = null; error.value = ''
  const next = (rotation.value + delta + 360) % 360
  try {
    const preview = paperPreviewUrl(photo.value, next)
    rotation.value = next; previewUrl.value = preview
    Object.assign(crop, { x: 10, y: 10, width: 80, height: 80 })
  } catch (failure) { error.value = `${failure.message}；原图仍保留，可重试。` }
}
function pointerDown(event) {
  if (!photo.value || props.disabled || busy.value || event.button !== 0) return
  const box = event.currentTarget.getBoundingClientRect()
  dragStart = { box, x: Math.max(0, Math.min(100, (event.clientX - box.left) / box.width * 100)),
    y: Math.max(0, Math.min(100, (event.clientY - box.top) / box.height * 100)) }
  event.currentTarget.setPointerCapture(event.pointerId)
  revise()
}
function pointerMove(event) {
  if (!dragStart) return
  const { box, x, y } = dragStart
  const endX = Math.max(0, Math.min(100, (event.clientX - box.left) / box.width * 100))
  const endY = Math.max(0, Math.min(100, (event.clientY - box.top) / box.height * 100))
  Object.assign(crop, { x: Math.min(x, endX), y: Math.min(y, endY), width: Math.abs(endX - x), height: Math.abs(endY - y) })
}
function pointerUp(event) { pointerMove(event); dragStart = null }
function clearPhoto() {
  revise()
  if (photo.value) URL.revokeObjectURL(photo.value.url)
  photo.value = null; previewUrl.value = ''; rotation.value = 0; error.value = ''
  emit('cleared')
}
async function submitCrop() {
  if (!photo.value || !chosen.value || !cropValid.value || props.disabled || busy.value) return
  const run = ++operation, currentPhoto = photo.value, currentCrop = { ...crop }, currentSource = source, currentRotation = rotation.value
  busy.value = true; error.value = ''
  try {
    const artifact = await createPaperArtifact(currentPhoto, currentCrop, currentSource, currentRotation)
    if (!alive || run !== operation) return
    installPaperImage(artifact)
  } catch (failure) { if (alive && run === operation) error.value = `${failure.message}；照片仍保留，可重新选区。` }
  finally { if (alive && run === operation) busy.value = false }
}
onBeforeUnmount(() => { alive = false; operation += 1; if (photo.value) URL.revokeObjectURL(photo.value.url) })
</script>

<template>
  <section class="ai-paper-input" aria-label="纸面草稿照片">
    <strong>纸面草稿 · 选择一个区域</strong>
    <p>照片默认只保留在本页，不会自动上传或保存。拖动框选，或填写百分比坐标；仅确认的选区可送去识别。在核对区主动保存备份后，可从下方恢复原图和选区。清除当前照片会删除其关联的本题照片备份。</p>
    <label>选择草稿照片（JPG / PNG / WebP，最多 12 MB）
      <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择草稿照片" :disabled="disabled || busy" @change="selectFile">
    </label>
    <template v-if="photo">
      <div>
        <button type="button" :disabled="disabled || busy" @click="rotatePhoto(-90)">向左旋转 90°</button>
        <button type="button" :disabled="disabled || busy" @click="rotatePhoto(90)">向右旋转 90°</button>
      </div>
      <p role="status">当前方向：顺时针 {{ rotation }}°（相对上传时显示的方向）。旋转后请重新框选并确认；原图保留，旧识别与批改失效。</p>
      <div class="ai-paper-preview" @pointerdown.prevent="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="dragStart = null">
        <img :src="previewUrl" alt="草稿照片方向预览" draggable="false">
        <div class="ai-paper-crop" :style="cropStyle"></div>
      </div>
      <button type="button" :disabled="disabled || busy" @click="enlarged.showModal()">放大照片并框选</button>
      <dialog ref="enlarged" class="ai-paper-enlarged" aria-label="放大照片选区" @close="dragStart = null" @cancel="dragStart = null">
        <p>拖动选择需要识别的区域；框选后返回并确认。</p>
        <div class="ai-paper-preview" :style="enlargedStyle" @pointerdown.prevent="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="dragStart = null">
          <img :src="previewUrl" alt="放大的草稿照片方向预览" draggable="false">
          <div class="ai-paper-crop" :style="cropStyle"></div>
        </div>
        <button type="button" @click="enlarged.close()">返回照片设置</button>
      </dialog>
      <div class="ai-paper-coordinates">
        <label v-for="[key, label] in [['x','选区左侧'],['y','选区顶部'],['width','选区宽度'],['height','选区高度']]" :key="key">{{ label }} %
          <input v-model.number="crop[key]" type="number" min="0" max="100" step="0.1" :aria-label="label" :disabled="disabled || busy" @input="revise">
        </label>
      </div>
      <p v-if="!cropValid" role="status">选区须在照片内，且至少为 8 × 8 像素。</p>
      <label><input v-model="chosen" type="checkbox" :disabled="disabled || busy || !cropValid">我已选择需要识别的区域</label>
      <button type="button" :disabled="disabled || busy || !chosen || !cropValid" @click="submitCrop">{{ busy ? '正在裁剪…' : '提交照片选区' }}</button>
      <button type="button" :disabled="disabled" @click="clearPhoto">清除此照片与选区来源</button>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.ai-paper-input { display: grid; gap: 8px; padding: 12px; border: 1px solid #bcd2e4; border-radius: 8px; }
.ai-paper-input p, .ai-paper-input label { margin: 0; font-size: 12px; line-height: 1.6; }
.ai-paper-preview { position: relative; width: 100%; touch-action: none; cursor: crosshair; }
.ai-paper-preview img { display: block; width: 100%; user-select: none; }
.ai-paper-enlarged { margin: auto; max-width: 90vw; max-height: 95dvh; padding: 12px; border: 1px solid #bcd2e4; border-radius: 8px; }
.ai-paper-enlarged::backdrop { background: #152e48aa; }
.ai-paper-enlarged .ai-paper-preview { margin: 8px auto; }
.ai-paper-crop { position: absolute; box-sizing: border-box; border: 2px solid #175b8d; background: #175b8d22; pointer-events: none; }
.ai-paper-coordinates { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ai-paper-coordinates input { width: 65px; }
.ai-paper-input button { padding: 5px 8px; border: 1px solid #bcd2e4; border-radius: 6px; color: #175b8d; background: white; cursor: pointer; }
.ai-paper-input button:disabled { opacity: .5; cursor: default; }
</style>
