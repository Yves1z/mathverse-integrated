<script setup>
import { computed, onMounted, ref } from 'vue'
import { practiceDisplayService } from '../../services/practiceDisplayService.js'
import {
  buildPracticeListChartRows,
  normalizePracticeListDisplay,
} from '../../utils/practiceListChart.js'
import '../../assets/styles/official-chart.css'

const PREVIEW_LISTS = Object.freeze([
  { id: 'preview-1', title: '集合', problemCount: 10, completedCount: 5 },
  { id: 'preview-2', title: '函数与导数', problemCount: 18, completedCount: 18 },
  { id: 'preview-3', title: '立体几何', problemCount: 26, completedCount: 0 },
])

const form = ref(normalizePracticeListDisplay(null))
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const savedMessage = ref('')

const previewRows = computed(() => buildPracticeListChartRows(PREVIEW_LISTS, form.value))

async function load() {
  loading.value = true
  error.value = ''
  try {
    form.value = await practiceDisplayService.getAdminDisplay()
  } catch (cause) {
    error.value = cause?.message || '题单展示配置读取失败'
  } finally {
    loading.value = false
  }
}

function restoreDefaults() {
  form.value = normalizePracticeListDisplay(null)
  savedMessage.value = ''
}

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  savedMessage.value = ''
  try {
    form.value = await practiceDisplayService.saveAdminDisplay(form.value)
    savedMessage.value = '题单展示配置已保存，题库页立即生效。'
  } catch (cause) {
    error.value = cause?.message || '题单展示配置保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section
    id="admin-panel-display"
    class="admin-display-panel"
    role="tabpanel"
    aria-labelledby="admin-tab-display"
    tabindex="0"
  >
    <header class="admin-display-heading">
      <div>
        <h2>官方题单展示</h2>
        <p>
          题单页“官方题单”区域按图示展示：每份题单一条，宽度按题目数量换算，颜色按完成比例渲染。
          这里修改的颜色和文字会立即对所有人生效。
        </p>
      </div>
      <div class="admin-display-actions">
        <button type="button" class="admin-inline-action" :disabled="loading" @click="load">
          重新读取
        </button>
        <button type="button" class="admin-inline-action" :disabled="saving" @click="restoreDefaults">
          恢复默认
        </button>
      </div>
    </header>

    <p v-if="error" class="admin-data-message is-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="admin-data-message" role="status">正在读取题单展示配置……</p>

    <form class="admin-display-form" @submit.prevent="save">
      <fieldset class="admin-display-fieldset">
        <legend>显示</legend>
        <label class="admin-display-check">
          <input v-model="form.showProblemCount" type="checkbox" />
          <span>在题单条右侧显示“已完成 / 总题数”</span>
        </label>
      </fieldset>

      <fieldset class="admin-display-fieldset">
        <legend>颜色</legend>
        <label class="admin-display-field admin-display-color">
          <span>未完成颜色</span>
          <input v-model="form.baseColor" type="color" />
          <input v-model.trim="form.baseColor" type="text" class="admin-display-color-code" />
        </label>
        <label class="admin-display-field admin-display-color">
          <span>已完成颜色</span>
          <input v-model="form.progressColor" type="color" />
          <input v-model.trim="form.progressColor" type="text" class="admin-display-color-code" />
        </label>
        <label class="admin-display-field admin-display-color">
          <span>题单文字颜色</span>
          <input v-model="form.textColor" type="color" />
          <input v-model.trim="form.textColor" type="text" class="admin-display-color-code" />
        </label>
      </fieldset>

      <fieldset class="admin-display-fieldset">
        <legend>形状与排序</legend>
        <label class="admin-display-field">
          <span>条高（20–120 像素）</span>
          <input v-model.number="form.barHeight" type="number" min="20" max="120" step="1" />
        </label>
        <label class="admin-display-field">
          <span>颜色过渡宽度（0–30，0 为硬边）</span>
          <input v-model.number="form.blendPercent" type="number" min="0" max="30" step="1" />
        </label>
        <label class="admin-display-field">
          <span>题目数量排序</span>
          <select v-model="form.sortDirection">
            <option value="asc">由少到多（最长的在最下面）</option>
            <option value="desc">由多到少（最长的在最上面）</option>
          </select>
        </label>
      </fieldset>

      <div class="admin-display-preview" aria-label="题单展示预览">
        <p class="admin-display-preview-title">预览（示例数据）</p>
        <p class="admin-display-preview-heading">{{ form.heading }}</p>
        <p class="admin-display-preview-description">{{ form.description }}</p>
        <ol class="official-chart">
          <li v-for="row in previewRows" :key="row.id" class="official-chart-row">
            <span class="official-chart-link">
              <span
                class="official-chart-bar"
                :style="{
                  '--chart-width': `${row.widthPercent}%`,
                  '--chart-height': `${form.barHeight}px`,
                  '--chart-text': form.textColor,
                  '--chart-fill': row.gradient,
                }"
              >
                <span class="official-chart-title">{{ row.title }}</span>
              </span>
              <span v-if="form.showProblemCount" class="official-chart-count">
                {{ row.completedCount }} / {{ row.problemCount }}
              </span>
            </span>
          </li>
        </ol>
      </div>

      <div class="admin-display-submit">
        <button type="submit" class="admin-primary-action" :disabled="saving || loading">
          {{ saving ? '正在保存……' : '保存题单展示配置' }}
        </button>
        <span v-if="savedMessage" role="status">{{ savedMessage }}</span>
      </div>
    </form>
  </section>
</template>
