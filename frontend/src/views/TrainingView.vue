<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppPageHeader from '../components/layout/AppPageHeader.vue'
import AppPageStats from '../components/layout/AppPageStats.vue'
import { pickRandomPageQuote } from '../data/pageQuotes.js'
import TrainingConfirmDialog from '../components/training/TrainingConfirmDialog.vue'
import TrainingCreateDialog from '../components/training/TrainingCreateDialog.vue'
import TrainingEditDialog from '../components/training/TrainingEditDialog.vue'
import TrainingListCard from '../components/training/TrainingListCard.vue'
import TrainingTabs from '../components/training/TrainingTabs.vue'
import OfficialTrainingChart from '../components/training/OfficialTrainingChart.vue'
import OfficialTrainingSort from '../components/training/OfficialTrainingSort.vue'
import { useOfficialListSort } from '../composables/useOfficialListSort.js'
import { useProblemsUserMarks } from '../composables/useProblemsUserMarks.js'
import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'
import { practiceDisplayService } from '../services/practiceDisplayService.js'
import { practiceListService } from '../services/practiceListService.js'
import { usePracticeListsStore } from '../stores/practiceLists.js'
import { normalizePracticeListDisplay } from '../utils/practiceListChart.js'
import {
  describeDeleteOutcome,
  isDeletablePracticeList,
  pruneSelectedIds,
  selectablePracticeListIds,
  toggleSelectedId,
} from '../utils/practiceListSelection.js'
import '../assets/styles/training.css'

const VALID_TABS = ['official', 'square', 'mine']
const pageQuote = pickRandomPageQuote()
const route = useRoute()
const router = useRouter()
const practiceListsStore = usePracticeListsStore()
const { completedProblemIds } = useProblemsUserMarks(PROBLEMS_PROTOTYPE_ITEMS)
const createDialogOpen = ref(false)
const publicListLoading = ref(false)
const publicListError = ref('')
const officialDisplaySettings = ref(normalizePracticeListDisplay(null))
const { sort: officialSort, setSort: setOfficialSort } = useOfficialListSort()
const practiceListStats = ref({
  publicListCount: '—',
  publicContributorCount: '—',
  totalListCount: '—',
})
const practiceListStatItems = computed(() => [
  { label: '已公开题单', value: practiceListStats.value.publicListCount },
  { label: '贡献者', value: practiceListStats.value.publicContributorCount },
  { label: '累计创建', value: practiceListStats.value.totalListCount },
])
const operationFeedbackMessage = ref('')
const selectionMode = ref(false)
const selectedListIds = ref([])
const pendingDeletion = ref(null)
const deletingLists = ref(false)
const editingList = ref(null)
let operationFeedbackTimer = 0

const activeTab = computed(() => {
  const tab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  return VALID_TABS.includes(tab) ? tab : 'mine'
})

const practiceListCards = computed(() =>
  practiceListsStore.lists.map((practiceList) => ({
    practiceList,
    completedCount: practiceList.items.filter((item) =>
      completedProblemIds.value.includes(item.problemId),
    ).length,
  })),
)

const selectableListIds = computed(() => selectablePracticeListIds(practiceListsStore.lists))
const selectedListCount = computed(
  () => pruneSelectedIds(selectedListIds.value, selectableListIds.value).length,
)
const allSelectableSelected = computed(
  () =>
    selectableListIds.value.length > 0 &&
    selectedListCount.value === selectableListIds.value.length,
)

function showOperationFeedback(message) {
  window.clearTimeout(operationFeedbackTimer)
  operationFeedbackMessage.value = message
  operationFeedbackTimer = window.setTimeout(() => {
    operationFeedbackMessage.value = ''
  }, 2200)
}

async function changeTab(tab) {
  const nextQuery = { ...route.query, tab }

  try {
    await router.replace({ name: 'training', query: nextQuery })
  } catch {
    showOperationFeedback('无法切换题单分类，请稍后重试')
  }
}

function openCreateDialog() {
  if (!practiceListsStore.authenticated) {
    void router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  createDialogOpen.value = true
}

function closeCreateDialog() {
  createDialogOpen.value = false
}

async function createPracticeList(formValue) {
  try {
    const practiceList = await practiceListsStore.createPracticeList(formValue)
    closeCreateDialog()
    loadPracticeListStats()
    showOperationFeedback(`题单“${practiceList.title}”已创建`)
  } catch (error) {
    showOperationFeedback(error?.message || '题单创建失败')
  }
}

async function loadPublicTab(tab) {
  // 题单广场本版本未开放，只有官方题单需要拉取数据。
  if (tab !== 'official') return
  publicListLoading.value = true
  publicListError.value = ''
  try {
    if (tab === 'official') {
      await loadOfficialDisplay()
    }
    await practiceListsStore.loadPublicLists(tab)
  } catch (error) {
    publicListError.value = error?.message || '公开题单加载失败'
  } finally {
    publicListLoading.value = false
  }
}

function enterSelectionMode() {
  selectionMode.value = true
  selectedListIds.value = []
}

function exitSelectionMode() {
  selectionMode.value = false
  selectedListIds.value = []
}

function toggleListSelection(listId) {
  selectedListIds.value = toggleSelectedId(selectedListIds.value, listId, selectableListIds.value)
}

function toggleSelectAll() {
  selectedListIds.value = allSelectableSelected.value ? [] : [...selectableListIds.value]
}

function requestDeleteList(practiceList) {
  pendingDeletion.value = {
    ids: [practiceList.id],
    title: `删除题单“${practiceList.title}”？`,
    description: '题单、排序和备注将从数据库删除，原题库中的题目不会受到影响。',
    confirmLabel: '删除题单',
  }
}

function requestEditList(practiceList) {
  editingList.value = practiceList
}

function cancelEditList() {
  editingList.value = null
}

async function saveListChanges(changes) {
  const target = editingList.value

  if (!target) {
    return
  }

  try {
    if (await practiceListsStore.updatePracticeList(target.id, changes)) {
      editingList.value = null
      showOperationFeedback('题单信息已保存')
    }
  } catch (error) {
    showOperationFeedback(error?.message || '题单保存失败')
  }
}

function requestDeleteSelected() {
  const ids = pruneSelectedIds(selectedListIds.value, selectableListIds.value)

  if (!ids.length) {
    return
  }

  pendingDeletion.value = {
    ids,
    title: `删除选中的 ${ids.length} 份题单？`,
    description: '这些题单的排序和备注会一并删除，原题库中的题目不会受到影响。',
    confirmLabel: '删除选中',
  }
}

function cancelDelete() {
  if (!deletingLists.value) {
    pendingDeletion.value = null
  }
}

async function confirmDelete() {
  const target = pendingDeletion.value

  if (!target || deletingLists.value) {
    return
  }

  deletingLists.value = true

  try {
    const result = await practiceListsStore.deletePracticeLists(target.ids)
    selectedListIds.value = pruneSelectedIds(
      selectedListIds.value,
      selectablePracticeListIds(practiceListsStore.lists),
    )

    if (!practiceListsStore.lists.length) {
      exitSelectionMode()
    }

    loadPracticeListStats()
    showOperationFeedback(
      describeDeleteOutcome({
        requested: target.ids.length,
        deleted: result.deleted.length,
        failed: result.failed.length,
      }),
    )
  } catch (error) {
    showOperationFeedback(error?.message || '删除题单失败')
  } finally {
    deletingLists.value = false
    pendingDeletion.value = null
  }
}

async function loadOfficialDisplay() {
  try {
    officialDisplaySettings.value = await practiceDisplayService.getDisplay()
  } catch {
    // Falling back to the built-in defaults keeps the chart usable when the
    // settings endpoint is unreachable.
    officialDisplaySettings.value = normalizePracticeListDisplay(null)
  }
}

async function loadPracticeListStats() {
  try {
    practiceListStats.value = await practiceListService.getStats()
  } catch {
    // 统计接口不可用时保留占位符。
  }
}

watch(activeTab, (tab) => {
  if (tab !== 'mine') {
    exitSelectionMode()
  }
  loadPublicTab(tab)
})
onMounted(async () => {
  await practiceListsStore.initialize()
  loadPracticeListStats()
  loadPublicTab(activeTab.value)
})

onBeforeUnmount(() => {
  window.clearTimeout(operationFeedbackTimer)
})
</script>

<template>
  <div class="training-page app-page">
    <main class="training-main app-page-container">
      <AppPageHeader title="高考数学题单" :quote="pageQuote" heading-id="training-page-title">
        <template #aside>
          <AppPageStats aria-label="题单概况" :items="practiceListStatItems" />
        </template>
      </AppPageHeader>

      <section class="training-shell app-surface" aria-label="题单浏览区">
        <div class="training-shell-bar">
          <TrainingTabs :active-tab="activeTab" @change="changeTab" />
          <OfficialTrainingSort
            v-if="activeTab === 'official' && practiceListsStore.publicLists.official.length"
            :sort="officialSort"
            @change="setOfficialSort"
          />
          <div v-if="activeTab === 'mine' && practiceListCards.length" class="training-bar-actions">
            <template v-if="selectionMode">
              <span>已选 {{ selectedListCount }} / {{ selectableListIds.length }}</span>
              <button
                type="button"
                class="training-secondary-action"
                :disabled="!selectableListIds.length"
                @click="toggleSelectAll"
              >
                {{ allSelectableSelected ? '取消全选' : '全选' }}
              </button>
              <button
                type="button"
                class="training-secondary-action is-danger"
                :disabled="!selectedListCount || deletingLists"
                @click="requestDeleteSelected"
              >
                删除选中
              </button>
              <button type="button" class="training-secondary-action" @click="exitSelectionMode">
                完成
              </button>
            </template>
            <template v-else>
              <span>{{ practiceListsStore.lists.length }} 份题单</span>
              <button
                v-if="selectableListIds.length"
                type="button"
                class="training-secondary-action"
                @click="enterSelectionMode"
              >
                批量管理
              </button>
              <button type="button" class="training-primary-action" @click="openCreateDialog">
                创建题单
              </button>
            </template>
          </div>
        </div>

        <section
          v-if="activeTab === 'official'"
          id="training-panel-official"
          class="training-tab-panel"
          role="tabpanel"
          aria-labelledby="training-tab-official"
          tabindex="0"
        >
          <div v-if="publicListLoading" class="training-integration-state" role="status">
            <h2>正在加载官方题单……</h2>
          </div>
          <div v-else-if="publicListError" class="training-integration-state" role="alert">
            <h2>官方题单加载失败</h2>
            <p>{{ publicListError }}</p>
            <button class="training-secondary-action" @click="loadPublicTab('official')">
              重试
            </button>
          </div>
          <div
            v-else-if="practiceListsStore.publicLists.official.length"
            class="training-panel-content"
          >
            <OfficialTrainingChart
              :lists="practiceListsStore.publicLists.official"
              :settings="officialDisplaySettings"
              :sort="officialSort"
            />
          </div>
          <div v-else class="training-integration-state">
            <h2>暂时没有官方题单</h2>
            <p>首位用户注册后，系统会自动创建官方起步题单。</p>
          </div>
        </section>

        <section
          v-else-if="activeTab === 'square'"
          id="training-panel-square"
          class="training-tab-panel"
          role="tabpanel"
          aria-labelledby="training-tab-square"
          tabindex="0"
        >
          <div class="training-integration-state">
            <h2>该版本未开放，敬请期待</h2>
          </div>
        </section>

        <section
          v-else
          id="training-panel-mine"
          class="training-tab-panel"
          role="tabpanel"
          aria-labelledby="training-tab-mine"
          tabindex="0"
        >
          <div class="training-panel-content">
            <div v-if="practiceListCards.length" class="training-card-grid">
              <TrainingListCard
                v-for="card in practiceListCards"
                :key="card.practiceList.id"
                :completed-count="card.completedCount"
                :deletable="isDeletablePracticeList(card.practiceList)"
                :default-list="practiceListsStore.defaultListId === card.practiceList.id"
                :practice-list="card.practiceList"
                :selected="selectedListIds.includes(card.practiceList.id)"
                :selection-mode="selectionMode"
                @delete-request="requestDeleteList(card.practiceList)"
                @edit-request="requestEditList(card.practiceList)"
                @toggle-select="toggleListSelection(card.practiceList.id)"
              />
            </div>

            <div v-else class="training-empty-state app-empty-state">
              <h2>暂时还没有题单</h2>
              <div class="training-empty-actions">
                <button type="button" class="training-primary-action" @click="openCreateDialog">
                  {{ practiceListsStore.authenticated ? '创建第一份题单' : '登录后创建题单' }}
                </button>
                <RouterLink class="training-secondary-action" to="/problems">浏览题库</RouterLink>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>

    <TrainingCreateDialog
      v-if="practiceListsStore.authenticated"
      :allow-official="practiceListsStore.authUser?.officialListOwner === true"
      :open="createDialogOpen"
      @cancel="closeCreateDialog"
      @create="createPracticeList"
    />

    <TrainingConfirmDialog
      :confirm-label="pendingDeletion?.confirmLabel"
      :description="pendingDeletion?.description"
      :open="Boolean(pendingDeletion)"
      :title="pendingDeletion?.title"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />

    <TrainingEditDialog
      :open="Boolean(editingList)"
      :practice-list="editingList"
      @cancel="cancelEditList"
      @save="saveListChanges"
    />

    <p
      v-show="operationFeedbackMessage"
      class="training-operation-feedback"
      :class="{ 'is-visible': operationFeedbackMessage }"
      role="status"
      aria-live="polite"
    >
      {{ operationFeedbackMessage }}
    </p>
  </div>
</template>
