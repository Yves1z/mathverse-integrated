<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  buildPracticeListChartRows,
  normalizePracticeListDisplay,
} from '../../utils/practiceListChart.js'
import '../../assets/styles/official-chart.css'

const props = defineProps({
  lists: {
    type: Array,
    default: () => [],
  },
  settings: {
    type: Object,
    default: () => ({}),
  },
  sort: {
    type: Object,
    default: null,
  },
})

const config = computed(() => normalizePracticeListDisplay(props.settings))
const rows = computed(() => buildPracticeListChartRows(props.lists, config.value, props.sort))
</script>

<template>
  <ol class="official-chart" aria-label="官方题单进度图">
    <li v-for="row in rows" :key="row.id" class="official-chart-row">
      <RouterLink
        class="official-chart-link"
        :to="{ name: 'training-detail', params: { practiceListId: row.id } }"
        :aria-label="`${row.title}，已完成 ${row.completedCount} 题，共 ${row.problemCount} 题`"
      >
        <span
          class="official-chart-bar"
          :style="{
            '--chart-width': `${row.widthPercent}%`,
            '--chart-height': `${config.barHeight}px`,
            '--chart-text': config.textColor,
            '--chart-fill': row.gradient,
          }"
        >
          <span class="official-chart-title">{{ row.title }}</span>
        </span>
        <span v-if="config.showProblemCount" class="official-chart-count" aria-hidden="true">
          {{ row.completedCount }} / {{ row.problemCount }}
        </span>
      </RouterLink>
    </li>
  </ol>
</template>
