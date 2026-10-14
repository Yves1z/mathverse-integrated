<script>
// Retain page edits across settings; disk backup is a separate explicit action.
const reviewDrafts = new WeakMap()
</script>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { callAi } from './aiRelay.js'
import { applyHandwritingRecognition, needsTranscriptionReplacement, confirmHandwriting, parseHandwritingRecognition } from './handwritingRecognition.js'
import { handwritingCapability, handwritingMessages } from './handwritingProvider.js'
import { isHandwritingCurrent } from '../draft/draftAgentBridge.js'
import { resolveGenerationBudget } from './generationBudget.js'
import { saveHandwritingCheckpoint } from './handwritingPersistence.js'
import { savePhotoCheckpoint } from './paperPersistence.js'
import { createReadingReview, normalizeReadingReview, readingReviewText } from './readingReview.js'

const props = defineProps({ artifact: { type: Object, required: true }, config: { type: Object, required: true }, disabled: Boolean,
  budgetSelection: { type: String, default: 'auto' }, customGenerationTokens: { type: Number, default: 32768 },
  attempt: { type: Object, default: null }, editorText: { type: String, default: '' } })
const emit = defineEmits(['confirmed', 'removed', 'invalidated', 'busy', 'settings', 'detach', 'editing'])
const consent = ref(false)
const confirmed = ref(false)
const replaceTranscription = ref(false)
const saved = reviewDrafts.get(props.artifact)
const text = ref(saved?.text ?? props.artifact.restoredReview?.text ?? '')
const recognition = ref(saved?.recognition ?? props.artifact.restoredReview?.recognition ?? null)
if (recognition.value?.blocks.length && !recognition.value.readingReview) {
  recognition.value = { ...recognition.value, readingReview: { ...createReadingReview(recognition.value),
    mode: text.value === recognition.value.text ? 'blocks' : 'manual' } }
}
const error = ref(saved?.error || '')
const busy = ref(false)
const cache = saved?.cache || new Map()
const checkpointSaving = ref(false)
const checkpointStatus = ref(props.artifact.restored ? '已恢复图片备份，请重新核对原图；旧批改和授权未恢复。' : '')
let controller = null
let runId = 0
let alive = true
const capability = computed(() => handwritingCapability(props.config))
const current = computed(() => isHandwritingCurrent(props.artifact))
const paper = computed(() => props.artifact.sourceKind === 'paper_image')
const needsReplacement = computed(() => needsTranscriptionReplacement(text.value, recognition.value))
const canRecognize = computed(() => current.value && capability.value.supported && consent.value
  && Boolean(props.config.key) && !busy.value && !props.disabled
  && !checkpointSaving.value
  && (!needsReplacement.value || replaceTranscription.value))
const canConfirm = computed(() => current.value && confirmed.value && text.value.trim()
  && text.value.length <= 6000 && !text.value.includes('[无法辨认]') && !busy.value && !props.disabled && !checkpointSaving.value)
const readingReview = computed(() => recognition.value?.readingReview)
const reviewLocked = computed(() => busy.value || !current.value || props.disabled || checkpointSaving.value)

function stop() {
  runId += 1
  controller?.abort()
  controller = null
  busy.value = false
  emit('busy', false)
}

watch(() => props.artifact.id, () => {
  stop(); consent.value = false; replaceTranscription.value = false; confirmed.value = false; text.value = ''; recognition.value = null; error.value = ''
}, { flush: 'sync' })
watch(() => [props.config.endpoint, props.config.model, props.config.key], () => {
  stop(); consent.value = false; replaceTranscription.value = false; error.value = ''
}, { flush: 'sync' })
watch(current, (value) => {
  if (!value) { stop(); replaceTranscription.value = false; confirmed.value = false; emit('invalidated') }
}, { flush: 'sync' })
watch(text, () => { confirmed.value = false; replaceTranscription.value = false; emit('editing') }, { flush: 'sync' })
watch(() => [text.value, recognition.value, props.editorText], () => {
  if (checkpointStatus.value.startsWith('已保存')) checkpointStatus.value = `内容已修改，点击保存可更新本题${paper.value ? '照片' : '手写'}备份。`
})
onBeforeUnmount(() => {
  alive = false
  reviewDrafts.set(props.artifact, { text: text.value, recognition: recognition.value, error: error.value, cache })
  stop()
})

async function recognize() {
  if (!canRecognize.value) return
  const id = ++runId
  controller = new AbortController()
  const config = { ...props.config }
  const artifact = props.artifact
  const textAtStart = text.value
  const allowReplacement = replaceTranscription.value
  replaceTranscription.value = false
  const cacheKey = JSON.stringify([artifact.contentHash, artifact.sceneSignature, config.endpoint, config.model])
  error.value = ''; busy.value = true; emit('busy', true)
  try {
    let result = cache.get(cacheKey)
    if (!result) {
      const budget = resolveGenerationBudget(props.budgetSelection, props.customGenerationTokens, 2500)
      const response = await callAi({ config, taskType: 'assistant-handwriting-recognition',
        messages: handwritingMessages(artifact), maxTokens: budget.maxTokens, generationBudgetMode: budget.mode, jsonMode: false,
        lowLatency: true, reasoningLevel: 'quick', signal: controller.signal })
      result = { ...parseHandwritingRecognition(response.content),
        provider: { endpoint: config.endpoint, model: response.model || config.model } }
    }
    if (id !== runId || !current.value || artifact.id !== props.artifact.id) return
    cache.set(cacheKey, result)
    const applied = applyHandwritingRecognition({ result, text: text.value, recognition: recognition.value,
      allowReplacement: allowReplacement && text.value === textAtStart })
    recognition.value = { ...applied.recognition, readingReview: createReadingReview(applied.recognition) }
    text.value = applied.text
    confirmed.value = false
    emit('editing')
  } catch (failure) {
    if (id === runId) error.value = failure.message || '识别失败；原图仍保留，可重试或手动转录'
  } finally {
    if (id === runId) { busy.value = false; controller = null; emit('busy', false) }
  }
}

function editBlock(index, patch, direction = 0) {
  if (reviewLocked.value) return
  const items = readingReview.value.items.map((item) => ({ ...item }))
  if (direction) {
    const destination = index + direction
    if (destination < 0 || destination >= items.length) return
    ;[items[index], items[destination]] = [items[destination], items[index]]
  } else Object.assign(items[index], patch)
  try {
    const review = normalizeReadingReview({ ...readingReview.value, pending: true, items }, recognition.value)
    recognition.value = { ...recognition.value, readingReview: review }
    confirmed.value = false; replaceTranscription.value = false; error.value = ''; emit('editing')
    if (checkpointStatus.value.startsWith('已保存')) checkpointStatus.value = '逐块核对已修改，请再次保存备份。'
  } catch (failure) { error.value = failure.message }
}

function applyBlocks() {
  if (reviewLocked.value) return
  const value = readingReviewText(readingReview.value)
  if (!value.trim() || readingReview.value.items.some((i) => i.included && !i.text.trim())) {
    error.value = '请至少保留一个非空片段，并补全保留片段的内容'; return
  }
  recognition.value = { ...recognition.value, readingReview: { ...readingReview.value, mode: 'blocks', pending: false } }
  text.value = value; confirmed.value = false; replaceTranscription.value = false; error.value = ''; emit('editing')
}

function useManualText() {
  if (readingReview.value) recognition.value = { ...recognition.value,
    readingReview: { ...readingReview.value, mode: 'manual', pending: false } }
  confirmed.value = false; replaceTranscription.value = false; emit('editing')
}

function submit() {
  if (!canConfirm.value) return
  try { emit('confirmed', confirmHandwriting(props.artifact, recognition.value, text.value, current.value)) }
  catch (failure) { error.value = failure.message }
}

async function saveCheckpoint() {
  if (checkpointSaving.value || busy.value || props.disabled || !current.value) return
  checkpointSaving.value = true
  emit('busy', true)
  const snapshotText = text.value, snapshotEditor = props.editorText
  try {
    await (paper.value ? savePhotoCheckpoint : saveHandwritingCheckpoint)({ artifact: props.artifact, text: text.value, recognition: recognition.value,
      attempt: props.attempt, editorText: props.attempt?.recognition?.artifactId === props.artifact.id ? props.editorText : text.value })
    checkpointStatus.value = snapshotText === text.value && snapshotEditor === props.editorText
      ? (paper.value ? '已保存本题照片备份；原图、裁剪来源、转录与最近提交版本仅留在本机，保留至主动删除。' : '已保存本题手写备份；原图、笔迹、转录与最近提交版本仅留在本机，保留至主动删除。')
      : `已保存点击时的${paper.value ? '照片' : '手写'}版本；当前修改尚未保存，请再次点击保存。`
  } catch (failure) { checkpointStatus.value = `${failure.message}；当前选区仍保留，可复制文字${paper.value ? '并保留原始照片' : '或导出画板'}。` }
  finally { checkpointSaving.value = false; if (alive) emit('busy', false) }
}
</script>

<template>
  <section class="ai-handwriting-review" aria-label="手写选区核对">
    <strong>{{ paper ? '照片选区' : '手写选区' }} · 先核对读法</strong>
    <img :src="artifact.dataUrl" alt="本次选择的手写区域" />
    <p v-if="paper">照片默认只在本页。点击“保存本题照片备份”才会按账号在本机保存原图、裁剪来源、转录和最近提交版本；每题仅保留最后一次主动保存，保留至主动删除。只有上方裁剪图会发送用于识别。更换照片或选区会使旧结果过期。识别置信度不代表数学正确。</p>
    <p v-else>选区默认只在本页内存。点击“保存本题手写备份”才会按账号保存原图、原生笔迹、转录和最近提交版本；每题仅保留最后一次主动保存，可在下方删除。画板另存本机。识别置信度不代表数学正确。</p>
    <button type="button" :disabled="!current || busy || disabled || checkpointSaving" @click="saveCheckpoint">{{ paper ? (checkpointSaving ? '正在保存照片备份…' : '保存本题照片备份') : (checkpointSaving ? '正在保存手写备份…' : '保存本题手写备份') }}</button>
    <p v-if="checkpointStatus" role="status">{{ checkpointStatus }}</p>
    <p v-if="!current" role="status">{{ paper ? '照片或选区' : '画板' }}已修改，此选区的识别与批改已过期。请重新框选并提交。</p>
    <p v-else-if="!capability.supported" role="status">{{ capability.reason }}</p>
    <template v-else>
      <p>接收方：{{ capability.recipient }}。通过本站同源中转，仅发送上方选区图片；模型可用性以实际服务为准。</p>
      <label><input v-model="consent" type="checkbox" :disabled="busy || !current">我同意将此选区发送给上述模型用于识别</label>
    </template>
    <label v-if="needsReplacement"><input v-model="replaceTranscription" type="checkbox" :disabled="busy || !current">再次识别时，用新读法替换我修改或手动填写的转录</label>
    <p v-if="needsReplacement">当前转录和逐块核对保留了你的修改。继续核对后可直接检查；选择替换才会再次识别，成功后逐块核对会重置，需要重新确认。失败或停止会保留当前转录与逐块修改。</p>
    <div class="ai-handwriting-actions">
      <button type="button" :disabled="!canRecognize" @click="recognize">{{ busy ? '正在识别手写…' : '识别手写选区' }}</button>
      <button v-if="busy" type="button" @click="stop">停止识别</button>
      <button type="button" @click="emit('settings')">选择视觉模型 / 填写 Key</button>
    </div>
    <p v-if="error" role="alert">{{ error }}；选区仍保留，可重试或手动转录。</p>
    <ul v-if="recognition">
      <li v-for="block in recognition.blocks" :key="block.id">
        <span>识别{{ block.confidence === null ? '置信度未知' : `置信度 ${Math.round(block.confidence * 100)}%` }}</span>
        <span v-if="block.uncertainty"> · 待核对：{{ block.uncertainty }}</span>
        <span v-if="block.alternatives.length"> · 候选：{{ block.alternatives.join(' / ') }}</span>
      </li>
    </ul>
    <section v-if="readingReview" class="ai-reading-blocks" aria-label="逐块核对阅读顺序">
      <strong>逐块核对阅读顺序</strong>
      <p>按原图调整片段顺序、纠正符号，或排除已划掉的片段。原识别内容和候选会保留；排除不表示数学错误。最后明确应用到下方转录，再确认读法。</p>
      <div v-for="(item, index) in readingReview.items" :key="item.blockId" class="ai-reading-block" :data-block-id="item.blockId">
        <p>片段 {{ item.blockId.replace('block', '') }} · 原识别：{{ recognition.blocks.find(b => b.id === item.blockId)?.text }}</p>
        <label><input type="checkbox" :checked="item.included" :disabled="reviewLocked" :aria-label="`保留片段 ${item.blockId.replace('block', '')}`" @change="editBlock(index, { included: $event.target.checked })">保留此片段</label>
        <textarea :value="item.text" rows="2" maxlength="6000" :disabled="reviewLocked" :aria-label="`片段 ${item.blockId.replace('block', '')} 核对内容`" @input="editBlock(index, { text: $event.target.value })"></textarea>
        <div class="ai-handwriting-actions">
          <button type="button" :disabled="reviewLocked || index === 0" :aria-label="`上移片段 ${item.blockId.replace('block', '')}`" @click="editBlock(index, null, -1)">上移</button>
          <button type="button" :disabled="reviewLocked || index === readingReview.items.length - 1" :aria-label="`下移片段 ${item.blockId.replace('block', '')}`" @click="editBlock(index, null, 1)">下移</button>
        </div>
      </div>
      <p v-if="readingReview.pending" role="status">逐块修改尚未应用，请选择应用或保留下方手动转录。</p>
      <div class="ai-handwriting-actions">
        <button type="button" :disabled="reviewLocked" @click="applyBlocks">用逐块核对内容替换下方转录</button>
        <button type="button" :disabled="reviewLocked" @click="useManualText">保留下方手动转录</button>
      </div>
    </section>
    <label>核对或手动转录选区内容（空行分隔步骤）
      <textarea v-model="text" rows="4" maxlength="6000" :disabled="busy || !current" aria-label="手写转录内容" @input="useManualText"></textarea>
    </label>
    <button v-if="artifact.restored && attempt && editorText !== text" type="button" :disabled="busy || !current" @click="text = editorText; useManualText()">将恢复的文字编辑稿放入转录区核对</button>
    <label><input v-model="confirmed" type="checkbox" :disabled="busy || !current">我已核对原图，关键符号和步骤顺序准确</label>
    <p>确认后将替换当前文字草稿，并检查第一处关键问题。此操作确认的是读法。</p>
    <div class="ai-handwriting-actions">
      <button type="button" :disabled="!canConfirm || readingReview?.pending" @click="submit">确认读法并检查</button>
      <button type="button" :disabled="busy || disabled" @click="emit('detach', text)">按文字草稿继续</button>
      <button type="button" @click="stop(); emit('removed')">移除此选区与识别</button>
    </div>
  </section>
</template>

<style scoped>
.ai-handwriting-review { display: grid; gap: 8px; padding: 12px; border: 1px solid #bcd2e4; border-radius: 8px; background: #f8fbff; }
.ai-reading-blocks { display: grid; gap: 8px; }
.ai-reading-block { display: grid; gap: 6px; border: 1px solid #bcd2e4; border-radius: 6px; padding: 8px; }
.ai-handwriting-review img { width: 100%; max-height: 190px; object-fit: contain; background: white; }
.ai-handwriting-review p, .ai-handwriting-review li, .ai-handwriting-review label { margin: 0; font-size: 12px; line-height: 1.6; }
.ai-handwriting-review textarea { box-sizing: border-box; display: block; width: 100%; padding: 8px; border: 1px solid #bcd2e4; border-radius: 6px; font: inherit; background: white; }
.ai-handwriting-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.ai-handwriting-actions button { padding: 5px 8px; border: 1px solid #bcd2e4; border-radius: 6px; color: #175b8d; background: white; font: inherit; font-size: 12px; cursor: pointer; }
.ai-handwriting-actions button:disabled { cursor: default; opacity: .5; }
</style>
