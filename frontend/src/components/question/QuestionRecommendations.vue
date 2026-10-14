<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAiProviderSettings } from '../../features/ai-assistant/aiProviderStore.js'
import { buildQuestionRecommendations } from '../../features/similar-problems/questionRecommendations.js'
import { listProblems } from '../../services/problemService.js'
import QuestionSidebarSection from './QuestionSidebarSection.vue'

const props = defineProps({
  problem: {
    type: Object,
    required: true,
  },
})

const candidates = ref([])
const loadingLibrary = ref(false)
const usingDemoCorpus = ref(true)
const { apiConfig } = useAiProviderSettings()
let requestController = null

const recommendations = computed(() => buildQuestionRecommendations(props.problem, candidates.value, 3))
const apiReady = computed(() => Boolean(apiConfig.key.trim() && apiConfig.endpoint.trim() && apiConfig.model.trim()))
const collapsedText = computed(() => recommendations.value.length
  ? `查看 ${recommendations.value.length} 道离线推荐`
  : '查看推荐状态')
const aiRoute = computed(() => ({
  name: 'similar-problems',
  query: {
    q: props.problem.content || props.problem.title || '',
    engine: 'api',
    from: props.problem.id,
  },
}))

function recommendationRoute(item) {
  if (!item.isDemo && item.id) {
    return { name: 'question', params: { problemNumber: item.id } }
  }
  return { name: 'problems', query: { keyword: item.knowledge?.[0] || item.title } }
}

function scorePercent(score) {
  return Math.round((Number(score) || 0) * 100)
}

async function loadLibraryCandidates() {
  requestController?.abort()
  const controller = new AbortController()
  requestController = controller
  loadingLibrary.value = true
  candidates.value = []
  usingDemoCorpus.value = true
  try {
    const data = await listProblems({ page: 1, pageSize: 60 }, { signal: controller.signal })
    if (!controller.signal.aborted && data.items.length > 1) {
      candidates.value = data.items
      usingDemoCorpus.value = false
    }
  } catch (error) {
    if (error?.name !== 'AbortError') usingDemoCorpus.value = true
  } finally {
    if (!controller.signal.aborted) loadingLibrary.value = false
  }
}

watch(() => props.problem.id, loadLibraryCandidates, { immediate: true })

onBeforeUnmount(() => requestController?.abort())
</script>

<template>
  <QuestionSidebarSection
    section-id="question-recommendations"
    title="推荐题目"
    :collapsed-text="collapsedText"
    expanded-text="收起推荐题目"
  >
    <div class="question-recommendation-toolbar">
      <div>
        <strong>离线即时匹配</strong>
        <span>{{ loadingLibrary ? '正在同步题库…' : usingDemoCorpus ? '演示候选库' : '站内题库优先' }} · 未调用 API</span>
      </div>
      <RouterLink class="question-recommendation-ai" :to="aiRoute">
        <span aria-hidden="true">AI</span>
        {{ apiReady ? 'AI 精准匹配' : 'AI 辅助推荐' }}
      </RouterLink>
    </div>

    <ol v-if="recommendations.length" class="question-recommendation-list">
      <li v-for="(item, index) in recommendations" :key="item.id" class="question-recommendation-card">
        <div class="question-recommendation-rank">{{ String(index + 1).padStart(2, '0') }}</div>
        <div class="question-recommendation-body">
          <div class="question-recommendation-meta">
            <span>{{ item.isDemo ? '离线候选' : item.id }}</span>
            <span>{{ item.typeLabel }}</span>
            <strong>{{ scorePercent(item.score) }}%</strong>
          </div>
          <RouterLink class="question-recommendation-title" :to="recommendationRoute(item)">
            {{ item.title }}
          </RouterLink>
          <p>{{ item.reason }}</p>
          <div class="question-recommendation-tags">
            <span v-for="tag in item.knowledge.slice(0, 2)" :key="tag">{{ tag }}</span>
            <span v-for="method in item.methods.slice(0, 1)" :key="method">{{ method }}</span>
          </div>
        </div>
      </li>
    </ol>

    <div v-else class="question-recommendation-empty">
      <strong>暂无达到质量门槛的离线推荐</strong>
      <p>当前题库候选不足，没有用无关题目凑数。可以使用 AI 分析解题方法和题型结构。</p>
    </div>

    <p class="question-recommendation-note">
      AI 模式会携带当前题干进入完整推荐页；{{ apiReady ? '已检测到本次会话中的 API 设置。' : '首次使用时需要选择模型并填写 API Key。' }}
    </p>
  </QuestionSidebarSection>
</template>
