<script setup>
import { computed } from 'vue'
import QuestionActions from './QuestionActions.vue'
import DifficultyBadge from '../difficulty/DifficultyBadge.vue'

const props = defineProps({
  completed: {
    type: Boolean,
    default: false,
  },
  favorite: {
    type: Boolean,
    default: false,
  },
  problem: {
    type: Object,
    required: true,
  },
  showDifficulty: { type: Boolean, default: true },
  showProblemNumber: { type: Boolean, default: true },
  showSource: { type: Boolean, default: true },
  showUploader: { type: Boolean, default: true },
})

const emit = defineEmits(['toggle-completed', 'toggle-favorite'])

const informationItems = computed(() =>
  [
    props.showProblemNumber ? { label: '题目编号', value: props.problem.id } : null,
    props.showSource
      ? {
          label: '来源',
          value: [props.problem.year, props.problem.sourceLabel].filter(Boolean).join('') || '未知',
        }
      : null,
    props.showUploader ? { label: '上传者', value: props.problem.uploader || '待接入' } : null,
  ].filter(Boolean),
)
</script>

<template>
  <section class="question-info-panel" aria-label="题目信息">
    <dl v-if="informationItems.length || showDifficulty" class="question-info-list">
      <div v-for="item in informationItems" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd>{{ item.value }}</dd>
      </div>

      <div v-if="showDifficulty">
        <dt>题目难度</dt>
        <dd><DifficultyBadge class="question-info-level" :level="problem.level" /></dd>
      </div>
    </dl>

    <QuestionActions
      :problem-number="problem.id"
      :completed="completed"
      :favorite="favorite"
      @toggle-completed="emit('toggle-completed')"
      @toggle-favorite="emit('toggle-favorite')"
    />
  </section>
</template>
