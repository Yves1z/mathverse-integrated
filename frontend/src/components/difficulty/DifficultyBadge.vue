<script setup>
import { computed } from 'vue'
import { getDifficultyDisplay } from '../../config/difficulty.js'
import { useDifficultyScheme } from '../../composables/useDifficultyScheme.js'

const props = defineProps({
  level: {
    type: String,
    default: '',
  },
  schemeId: {
    type: String,
    default: '',
  },
})

const { activeSchemeId } = useDifficultyScheme()
const display = computed(() =>
  getDifficultyDisplay(props.level, props.schemeId || activeSchemeId.value),
)
</script>

<template>
  <span
    class="difficulty-badge"
    :data-level-color="display.value === 'unknown' ? undefined : display.value"
    :aria-label="display.label"
    :title="display.label"
  >
    <span class="difficulty-badge-name">{{ display.name }}</span>
    <span v-if="display.stars" class="difficulty-badge-stars" aria-hidden="true">
      {{ '★'.repeat(display.stars) }}
    </span>
    <span v-else-if="display.reserved" class="difficulty-badge-reserved">
      {{ display.value.toUpperCase() }}
    </span>
  </span>
</template>

<style scoped>
.difficulty-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35em;
  color: var(--training-value-color, var(--color-ink-muted, #657c90));
  font: inherit;
  font-weight: inherit;
  line-height: inherit;
  text-shadow: var(--training-value-text-shadow, none);
  white-space: nowrap;
}

.difficulty-badge-stars {
  letter-spacing: 0.06em;
}

.difficulty-badge-reserved {
  font-size: 0.86em;
  letter-spacing: 0.04em;
}
</style>
