<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import '../../assets/styles/official-chart.css'

const SORT_MODE_OPTIONS = Object.freeze([
  { value: 'name', label: '按名称' },
  { value: 'count', label: '按数量' },
  { value: 'progress', label: '按完成程度' },
  { value: 'level', label: '按难度' },
])

const MENU_GAP = 6
const MENU_MARGIN = 8

const props = defineProps({
  sort: {
    type: Object,
    default: () => ({ mode: 'count', direction: 'asc' }),
  },
})

const emit = defineEmits(['change'])

const activeModeLabel = computed(
  () => SORT_MODE_OPTIONS.find((option) => option.value === props.sort.mode)?.label ?? '按数量',
)
const directionLabel = computed(() => (props.sort.direction === 'desc' ? '倒序' : '顺序'))
const accessibleLabel = computed(() => `题单排序：${activeModeLabel.value}，${directionLabel.value}`)

const sortMenuOpen = ref(false)
const sortRoot = ref(null)
const sortToggle = ref(null)
const sortMenu = ref(null)
const sortMenuStyle = ref({})

/**
 * 菜单渲染到 body 上并固定定位：题单面板所在的 .training-shell 有 overflow: hidden，
 * 菜单留在原地会被裁掉，底部的选项点不到。
 */
function positionSortMenu() {
  const toggle = sortToggle.value
  const menu = sortMenu.value

  if (!toggle || !menu) {
    return
  }

  const anchor = toggle.getBoundingClientRect()
  const menuBox = menu.getBoundingClientRect()
  const left = Math.max(
    MENU_MARGIN,
    Math.min(anchor.right - menuBox.width, window.innerWidth - menuBox.width - MENU_MARGIN),
  )
  const opensUpward = window.innerHeight - anchor.bottom < menuBox.height + MENU_GAP + MENU_MARGIN

  sortMenuStyle.value = opensUpward
    ? {
        left: `${Math.round(left)}px`,
        top: 'auto',
        bottom: `${Math.round(window.innerHeight - anchor.top + MENU_GAP)}px`,
      }
    : {
        left: `${Math.round(left)}px`,
        top: `${Math.round(anchor.bottom + MENU_GAP)}px`,
        bottom: 'auto',
      }
}

function closeSortMenu(restoreFocus = false) {
  sortMenuOpen.value = false

  if (restoreFocus) {
    sortToggle.value?.focus()
  }
}

async function toggleSortMenu() {
  if (sortMenuOpen.value) {
    closeSortMenu()
    return
  }

  sortMenuOpen.value = true
  await nextTick()
  positionSortMenu()
}

function chooseSort(changes) {
  emit('change', changes)
  closeSortMenu(true)
}

function handlePointerDown(event) {
  if (!sortMenuOpen.value) {
    return
  }
  if (sortRoot.value?.contains(event.target) || sortMenu.value?.contains(event.target)) {
    return
  }
  closeSortMenu()
}

function handleKeydown(event) {
  if (event.key === 'Escape' && sortMenuOpen.value) {
    event.preventDefault()
    closeSortMenu(true)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', positionSortMenu)
  window.addEventListener('scroll', positionSortMenu, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', positionSortMenu)
  window.removeEventListener('scroll', positionSortMenu)
})
</script>

<template>
  <div ref="sortRoot" class="official-chart-sort">
    <button
      ref="sortToggle"
      type="button"
      class="official-chart-sort-toggle"
      aria-haspopup="true"
      :aria-expanded="sortMenuOpen"
      :aria-label="accessibleLabel"
      :title="accessibleLabel"
      @click="toggleSortMenu"
    >
      <svg class="official-chart-sort-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-show="sortMenuOpen"
        ref="sortMenu"
        class="official-chart-sort-menu"
        role="menu"
        aria-label="题单排序"
        :style="sortMenuStyle"
      >
        <p class="official-chart-sort-group">排序方式</p>
        <button
          v-for="option in SORT_MODE_OPTIONS"
          :key="option.value"
          type="button"
          role="menuitemradio"
          class="official-chart-sort-option"
          :aria-checked="sort.mode === option.value"
          @click="chooseSort({ mode: option.value })"
        >
          {{ option.label }}
        </button>

        <p class="official-chart-sort-group">排序顺序</p>
        <button
          type="button"
          role="menuitemradio"
          class="official-chart-sort-option"
          :aria-checked="sort.direction === 'asc'"
          @click="chooseSort({ direction: 'asc' })"
        >
          顺序
        </button>
        <button
          type="button"
          role="menuitemradio"
          class="official-chart-sort-option"
          :aria-checked="sort.direction === 'desc'"
          @click="chooseSort({ direction: 'desc' })"
        >
          倒序
        </button>
      </div>
    </Teleport>
  </div>
</template>
