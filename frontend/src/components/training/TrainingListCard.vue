<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  completedCount: {
    type: Number,
    default: 0,
  },
  // 保留可删除开关，方便以后恢复官方题单的保护。
  deletable: {
    type: Boolean,
    default: true,
  },
  defaultList: {
    type: Boolean,
    default: false,
  },
  practiceList: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  selectionMode: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['delete-request', 'edit-request', 'toggle-select'])

const problemCount = computed(
  () => props.practiceList.problemCount ?? props.practiceList.items?.length ?? 0,
)
const detailTarget = computed(() => ({
  name: 'training-detail',
  params: { practiceListId: props.practiceList.id },
}))
const selectable = computed(() => props.selectionMode && props.deletable)
const listKindLabel = computed(() => {
  if (props.practiceList.isOfficial) return '官方题单'
  if (props.practiceList.id?.startsWith('local-')) return '本地题单'
  return props.practiceList.isPublic === false ? '私密题单' : '公开题单'
})
const progressPercent = computed(() => {
  if (problemCount.value === 0) {
    return 0
  }

  return Math.round((props.completedCount / problemCount.value) * 100)
})
const updatedAt = computed(() => {
  const date = new Date(props.practiceList.updatedAt)

  if (Number.isNaN(date.getTime())) {
    return '更新时间未知'
  }

  return `${new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)} 更新`
})

function toggleSelection() {
  if (!selectable.value) {
    return
  }
  emit('toggle-select')
}

function handleKeydown(event) {
  if (!props.selectionMode) {
    return
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    toggleSelection()
  }
}
</script>

<template>
  <article
    class="training-card"
    :class="{
      'is-locked': selectionMode && !deletable,
      'is-selected': selectionMode && selected,
      'is-selecting': selectionMode,
    }"
    :role="selectionMode ? 'checkbox' : undefined"
    :aria-checked="selectionMode ? String(selected) : undefined"
    :aria-disabled="selectionMode && !deletable ? 'true' : undefined"
    :tabindex="selectable ? 0 : undefined"
    @click="toggleSelection"
    @keydown="handleKeydown"
  >
    <span v-if="selectionMode" class="training-card-check" aria-hidden="true"></span>

    <div v-if="!selectionMode" class="training-card-actions">
      <button
        type="button"
        class="training-card-icon-button"
        :aria-label="`编辑题单：${practiceList.title}`"
        title="编辑题单"
        @click.stop="emit('edit-request')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 20h4L18.5 9.5 14.5 5.5 4 16v4z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
      </button>
      <button
        v-if="deletable"
        type="button"
        class="training-card-icon-button is-danger"
        :aria-label="`删除题单：${practiceList.title}`"
        title="删除题单"
        @click.stop="emit('delete-request')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 13h10l1-13" />
          <path d="M9 7V4h6v3" />
        </svg>
      </button>
    </div>

    <div class="training-card-copy">
      <div class="training-card-labels">
        <span class="training-card-code">{{ listKindLabel }}</span>
        <span v-if="defaultList" class="training-card-default">默认</span>
        <span v-if="selectionMode && !deletable" class="training-card-locked">不可删除</span>
      </div>
      <h3>
        <RouterLink v-if="!selectionMode" class="training-card-link" :to="detailTarget">
          {{ practiceList.title }}
        </RouterLink>
        <template v-else>{{ practiceList.title }}</template>
      </h3>
      <p class="training-card-description">
        {{ practiceList.description || '还没有填写题单说明。' }}
      </p>
      <p class="training-card-meta">
        <span>{{ problemCount }} 题</span>
        <span v-if="practiceList.owner">作者：{{ practiceList.owner.username }}</span>
        <span>{{ updatedAt }}</span>
      </p>
    </div>

    <span
      class="training-card-progress"
      :class="{ 'is-complete': problemCount > 0 && completedCount >= problemCount }"
      :style="{ '--progress': progressPercent }"
      :aria-label="`已完成 ${completedCount} 题，共 ${problemCount} 题`"
    >
      <span>{{ completedCount }} / {{ problemCount }}</span>
    </span>
  </article>
</template>
