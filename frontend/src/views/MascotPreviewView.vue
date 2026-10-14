<script setup>
import { onBeforeUnmount, ref } from 'vue'
import MathverseMascot from '../components/brand/MathverseMascot.vue'

const moments = [
  { state: 'idle', label: '安静陪伴', action: '呼吸 · 眨眼', description: '缓慢呼吸，偶尔眨一下眼，安静地陪你想题。' },
  { state: 'curious', label: '好奇探头', action: '竖起 · 探头', description: '你靠近或开始输入时，它竖起细长的环带，抬头看你。' },
  { state: 'thinking', label: '认真思考', action: '盘绕 · 思考', description: '环带盘绕成团，像是想题想到把自己绕了进去。' },
  { state: 'responding', label: '开心回应', action: '微笑 · 小跳', description: '回复到达后，露出笑眼，轻轻弹起一下，再安静下来。' },
  { state: 'sleeping', label: '闭眼休息', action: '摊低 · 蜷起', description: '闭上眼，把环带舒展开来，脸低低地贴着地面休息。' },
]
const selected = ref(0)
const automatic = ref(false)
let cycleTimer

function choose(index) {
  stopCycle()
  selected.value = index
}
function stopCycle() {
  window.clearInterval(cycleTimer)
  automatic.value = false
}
function toggleCycle() {
  if (automatic.value) return stopCycle()
  automatic.value = true
  selected.value = 0
  cycleTimer = window.setInterval(() => { selected.value = (selected.value + 1) % moments.length }, 4200)
}
onBeforeUnmount(stopCycle)
</script>

<template>
  <main class="mascot-preview">
    <div class="mascot-preview-content">
      <header class="mascot-preview-heading">
        <div><p class="mascot-preview-brand">Mathverse</p><h1>莫比乌斯小兽的日常</h1></div>
        <RouterLink to="/">返回首页 <span aria-hidden="true">↗</span></RouterLink>
      </header>

      <section class="mascot-preview-stage" aria-label="动作预览">
        <div class="mascot-preview-orbit" aria-hidden="true"></div>
        <MathverseMascot :key="selected" class="mascot-preview-main" :state="moments[selected].state" :decorative="false" />
        <div class="mascot-preview-caption" aria-live="polite">
          <p>{{ moments[selected].action }}</p>
          <h2>{{ moments[selected].label }}</h2>
          <p>{{ moments[selected].description }}</p>
        </div>
      </section>

      <div class="mascot-preview-controls">
        <p>选一个时刻，看看它的动作。</p>
        <button type="button" :aria-pressed="automatic" @click="toggleCycle">{{ automatic ? '暂停演示' : '依次演示' }} <span aria-hidden="true">{{ automatic ? 'Ⅱ' : '▷' }}</span></button>
      </div>

      <div class="mascot-preview-moments" role="group" aria-label="选择小兽的动作">
        <button v-for="(moment, index) in moments" :key="moment.state" type="button"
          :class="{ 'is-selected': selected === index }" :aria-pressed="selected === index" @click="choose(index)">
          <MathverseMascot :state="moment.state" />
          <strong>{{ moment.label }}</strong>
          <small>{{ moment.action }}</small>
        </button>
      </div>
      <p class="mascot-preview-note">保留铅笔与水彩的质感，让每个动作都轻一点。</p>
    </div>
  </main>
</template>

<style scoped>
.mascot-preview { min-height: 100svh; padding: 40px 28px 60px; color: #2c4164; background: #faf7f0; font-family: var(--font-ui); }
.mascot-preview-content { max-width: 980px; margin: auto; }
.mascot-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.mascot-preview-brand { margin: 0 0 7px; color: #7e8aa0; font-size: 13px; letter-spacing: .08em; }
.mascot-preview-heading h1 { margin: 0; font-family: var(--font-display); font-size: clamp(24px, 3vw, 34px); font-weight: 600; }
.mascot-preview-heading a { color: #6d7d92; font-size: 13px; text-decoration: none; white-space: nowrap; }
.mascot-preview-stage { position: relative; display: grid; justify-items: center; margin: 32px 0 20px; padding: 32px 24px 26px; overflow: hidden; border: 1px solid #e6decf; border-radius: 28px; background: radial-gradient(ellipse at 50% 38%, #fff0da 0, #fffcf5 53%, #f1f3f7 100%); }
.mascot-preview-orbit { position: absolute; top: 18px; width: 340px; height: 230px; border: 1px solid rgb(196 163 119 / 15%); border-radius: 50%; transform: rotate(-16deg); pointer-events: none; }
.mascot-preview-main { --mascot-width: min(380px, 72vw); margin: 0 auto 14px; }
.mascot-preview-caption { position: relative; text-align: center; }
.mascot-preview-caption h2 { margin: 5px 0 10px; font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.mascot-preview-caption p { margin: 0; color: #7a8595; font-size: 13px; line-height: 1.7; }
.mascot-preview-caption p:first-child { color: #b17c4d; font-size: 11px; letter-spacing: .16em; }
.mascot-preview-controls { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 16px; }
.mascot-preview-controls p { margin: 0; color: #778399; font-size: 13px; }
.mascot-preview-controls button { display: flex; min-height: 40px; align-items: center; gap: 12px; padding: 7px 16px; border: 1px solid #d9cfbf; border-radius: 999px; color: #526787; background: #fffcf5; font: inherit; font-size: 12px; cursor: pointer; }
.mascot-preview-moments { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.mascot-preview-moments button { display: grid; justify-items: center; padding: 20px 10px 17px; border: 1px solid #e2dccf; border-radius: 18px; color: #445977; background: #fffcf6; font: inherit; cursor: pointer; }
.mascot-preview-moments button.is-selected { border-color: #7789a4; background: #f0f3f8; box-shadow: inset 0 0 0 1px #7789a4; }
.mascot-preview-moments .mathverse-mascot { --mascot-width: 106px; margin-bottom: 12px; }
.mascot-preview-moments strong { font-size: 13px; font-weight: 600; }
.mascot-preview-moments small { margin-top: 6px; color: #8b96a6; font-size: 10px; }
.mascot-preview button:focus-visible, .mascot-preview a:focus-visible { outline: 3px solid #9eafc7; outline-offset: 4px; }
.mascot-preview-note { margin: 20px 0 0; color: #8d96a4; font-size: 11px; text-align: center; }
@media (max-width: 640px) {
  .mascot-preview { padding: 24px 16px 120px; }
  .mascot-preview-heading { align-items: flex-start; gap: 12px; }
  .mascot-preview-heading a { margin-top: 4px; font-size: 11px; }
  .mascot-preview-stage { margin-top: 24px; padding-right: 18px; padding-left: 18px; }
  .mascot-preview-orbit { width: 250px; height: 170px; }
  .mascot-preview-moments { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mascot-preview-moments button:last-child { grid-column: 1 / -1; }
  .mascot-preview-controls p { font-size: 11px; }
}
</style>
