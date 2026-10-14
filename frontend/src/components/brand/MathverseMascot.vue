<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import idleImage from '../../assets/brand/mobius-idle.webp'
import blinkImage from '../../assets/brand/mobius-sleeping.webp'
import sleepingImage from '../../assets/brand/mobius-sleeping-v2.webp'
import curiousImage from '../../assets/brand/mobius-curious-v2.webp'
import thinkingImage from '../../assets/brand/mobius-thinking-v2.webp'
import respondingImage from '../../assets/brand/mobius-responding.webp'

const states = ['idle', 'curious', 'thinking', 'responding', 'sleeping']
const props = defineProps({
  state: { type: String, default: 'idle', validator: value => ['idle', 'curious', 'thinking', 'responding', 'sleeping'].includes(value) },
  decorative: { type: Boolean, default: true },
  allowSleep: { type: Boolean, default: false },
})
const asleep = ref(false)
const inViewport = ref(true)
const pageVisible = ref(true)
const blinkLoaded = ref(false)
const reducedMotion = ref(false)
const host = ref(null)
let restTimer
let observer
let motionPreference

const effectiveState = computed(() => {
  const requested = states.includes(props.state) ? props.state : 'idle'
  return requested === 'idle' && asleep.value ? 'sleeping' : requested
})
const pose = computed(() => effectiveState.value)
const description = computed(() => `Mathverse 莫比乌斯小兽 · ${{ idle: '安静陪伴', curious: '好奇探头', thinking: '正在思考', responding: '开心回应', sleeping: '闭眼休息' }[effectiveState.value]}`)
const images = { idle: idleImage, blink: blinkImage, curious: curiousImage, sleeping: sleepingImage, thinking: thinkingImage, responding: respondingImage }

function scheduleRest() {
  window.clearTimeout(restTimer)
  asleep.value = false
  if (props.allowSleep && props.state === 'idle' && inViewport.value && pageVisible.value) {
    restTimer = window.setTimeout(() => { asleep.value = true }, 60_000)
  }
}
function updateVisibility() { pageVisible.value = !document.hidden }
function updateMotionPreference(event) { reducedMotion.value = event.matches }
watch([() => props.state, () => props.allowSleep, inViewport, pageVisible], scheduleRest)

onMounted(() => {
  updateVisibility()
  document.addEventListener('visibilitychange', updateVisibility)
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionPreference.matches
  motionPreference.addEventListener('change', updateMotionPreference)
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => { inViewport.value = entry.isIntersecting })
    observer.observe(host.value)
  }
  scheduleRest()
})
onBeforeUnmount(() => {
  window.clearTimeout(restTimer)
  observer?.disconnect()
  document.removeEventListener('visibilitychange', updateVisibility)
  motionPreference?.removeEventListener('change', updateMotionPreference)
})
</script>

<template>
  <span
    ref="host"
    :class="['mathverse-mascot', `is-${effectiveState}`, {
      'has-blink': blinkLoaded && !reducedMotion,
      'is-paused': !inViewport || !pageVisible,
    }]"
    :data-state="effectiveState"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : description"
  >
    <span class="mobius-rig">
      <img
        v-for="(src, name) in images"
        :key="name"
        :src="src"
        :class="['mobius-pose', `pose-${name}`, { 'is-active': pose === name }]"
        width="1536"
        height="1024"
        alt=""
        draggable="false"
        decoding="async"
        @load="name === 'blink' && (blinkLoaded = true)"
      />
    </span>
  </span>
</template>

<style scoped>
.mathverse-mascot {
  position: relative;
  display: block;
  width: var(--mascot-width, 80px);
  aspect-ratio: 3 / 2;
  flex: 0 0 auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
.mobius-rig { display: block; width: 100%; height: 100%; transform-origin: 50% 82%; }
.mobius-pose { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity 260ms ease; }
.mobius-pose.is-active { opacity: 1; }
.is-idle .mobius-rig { animation: mobius-breathe 4.8s ease-in-out infinite; }
.is-idle.has-blink .pose-idle { animation: mobius-eyes-open 7.4s steps(1, end) infinite; }
.is-idle.has-blink .pose-blink { animation: mobius-eyes-closed 7.4s steps(1, end) infinite; }
.is-curious .mobius-rig { animation: mobius-peek 3.2s ease-in-out infinite; }
.is-thinking .mobius-rig { animation: mobius-twist 2.8s ease-in-out infinite; }
.is-responding .mobius-rig { animation: mobius-respond 1.8s ease-out both; }
.is-sleeping .mobius-rig { animation: mobius-rest 6s ease-in-out infinite; }
.is-paused .mobius-rig, .is-paused .mobius-pose { animation-play-state: paused; }

@keyframes mobius-breathe {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  50% { transform: translateY(-1px) scale(1.009, 1.025); }
}
@keyframes mobius-eyes-open {
  0%, 92%, 95%, 100% { opacity: 1; }
  93% { opacity: 0; }
}
@keyframes mobius-eyes-closed {
  0%, 92%, 95%, 100% { opacity: 0; }
  93% { opacity: 1; }
}
@keyframes mobius-peek {
  0%, 100% { transform: translateY(-1px) rotate(-2deg) scale(1.015, 1.04); }
  50% { transform: translateY(-3px) rotate(2deg) scale(1.02, 1.08); }
}
@keyframes mobius-twist {
  0%, 100% { transform: rotate(-4deg) skewX(-2deg) scale(1.025, .97); }
  50% { transform: translateY(-2px) rotate(4deg) skewX(2deg) scale(.98, 1.035); }
}
@keyframes mobius-respond {
  0% { transform: scale(1.035, .96); }
  22% { transform: translateY(-7px) rotate(-3deg) scale(.99, 1.04); }
  43% { transform: scale(1.04, .97); }
  65% { transform: translateY(-3px) rotate(2deg); }
  100% { transform: none; }
}
@keyframes mobius-rest {
  0%, 100% { transform: translateY(3px) rotate(-1deg) scale(1, .98); }
  50% { transform: translateY(2px) rotate(-1deg) scale(1.015, 1.015); }
}
@media (prefers-reduced-motion: reduce) {
  .mathverse-mascot .mobius-rig, .mathverse-mascot .mobius-pose { animation: none; transition: none; transform: none; }
}
</style>
