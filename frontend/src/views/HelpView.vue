<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import '../assets/styles/help.css'

const navigationGroups = [
  {
    label: '开始使用',
    items: [
      { id: 'welcome', label: '欢迎使用' },
      { id: 'find-problems', label: '查找题目' },
      { id: 'difficulty', label: '理解难度标识' },
    ],
  },
  {
    label: '学习工具',
    items: [
      { id: 'practice-lists', label: '题单与训练' },
      { id: 'paper-builder', label: '自主组卷' },
      { id: 'print-export', label: '打印与导出' },
    ],
  },
  {
    label: '账户与设置',
    items: [
      { id: 'account', label: '账户与个人主页' },
      { id: 'personalization', label: '个性化设置' },
      { id: 'faq', label: '常见问题' },
    ],
  },
]

const allNavigationItems = navigationGroups.flatMap((group) => group.items)
const searchQuery = ref('')
const searchInput = ref(null)
const activeSection = ref('welcome')
const menuOpen = ref(false)
let sectionObserver

const searchResults = computed(() => {
  const keyword = searchQuery.value.trim().toLocaleLowerCase('zh-CN')
  if (!keyword) return []
  return allNavigationItems.filter((item) =>
    item.label.toLocaleLowerCase('zh-CN').includes(keyword),
  )
})

function scrollToSection(id) {
  activeSection.value = id
  menuOpen.value = false
  searchQuery.value = ''
  nextTick(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
  })
}

function handleKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
    return
  }
  if (event.key !== 'Escape') return
  menuOpen.value = false
  searchQuery.value = ''
}

onMounted(() => {
  const sections = document.querySelectorAll('[data-help-section]')
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visibleEntry?.target?.id) activeSection.value = visibleEntry.target.id
    },
    { rootMargin: '-96px 0px -62% 0px', threshold: [0, 0.2, 0.7] },
  )
  sections.forEach((section) => sectionObserver.observe(section))
  const initialSection = window.location.hash.slice(1)
  if (allNavigationItems.some((item) => item.id === initialSection)) {
    requestAnimationFrame(() => scrollToSection(initialSection))
  }
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  sectionObserver?.disconnect()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="help-page">
    <header class="help-header">
      <RouterLink class="help-brand" :to="{ name: 'home' }" aria-label="返回 Mathverse 首页">
        <span class="help-brand-mark" aria-hidden="true">M</span>
        <span class="help-brand-name">Mathverse</span>
        <span class="help-brand-divider" aria-hidden="true"></span>
        <span class="help-brand-docs">帮助中心</span>
      </RouterLink>

      <div class="help-search-wrap">
        <svg class="help-search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          ref="searchInput"
          v-model="searchQuery"
          class="help-search"
          type="search"
          placeholder="搜索帮助文档"
          aria-label="搜索帮助文档"
        />
        <span class="help-search-shortcut" aria-hidden="true">⌘ K</span>
        <div v-if="searchQuery" class="help-search-results">
          <button
            v-for="result in searchResults"
            :key="result.id"
            type="button"
            @click="scrollToSection(result.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            {{ result.label }}
          </button>
          <p v-if="!searchResults.length">没有找到相关内容</p>
        </div>
      </div>

      <nav class="help-header-links" aria-label="快捷导航">
        <RouterLink :to="{ name: 'problems' }">题库</RouterLink>
        <RouterLink :to="{ name: 'training' }">题单</RouterLink>
        <RouterLink :to="{ name: 'paper-library' }">组卷</RouterLink>
        <RouterLink class="help-home-link" :to="{ name: 'home' }">返回首页</RouterLink>
      </nav>

      <button
        class="help-menu-button"
        type="button"
        :aria-expanded="menuOpen"
        aria-controls="help-sidebar"
        aria-label="打开帮助目录"
        @click="menuOpen = !menuOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </header>

    <button
      v-if="menuOpen"
      class="help-sidebar-backdrop"
      type="button"
      aria-label="关闭帮助目录"
      @click="menuOpen = false"
    ></button>

    <div class="help-layout">
      <aside id="help-sidebar" class="help-sidebar" :class="{ 'is-open': menuOpen }">
        <div class="help-sidebar-inner">
          <p class="help-sidebar-title">使用指南</p>
          <nav aria-label="帮助文档目录">
            <section v-for="group in navigationGroups" :key="group.label" class="help-nav-group">
              <h2>{{ group.label }}</h2>
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                :class="{ 'is-active': activeSection === item.id }"
                :aria-current="activeSection === item.id ? 'location' : undefined"
                @click="scrollToSection(item.id)"
              >
                {{ item.label }}
              </button>
            </section>
          </nav>
          <div class="help-sidebar-footer">
            <span>没有解决问题？</span><RouterLink :to="{ name: 'feedback' }">提交反馈</RouterLink>
          </div>
        </div>
      </aside>

      <main class="help-content">
        <article>
          <section id="welcome" class="help-section help-hero" data-help-section>
            <p class="help-eyebrow">MATHVERSE DOCUMENTATION</p>
            <h1>使用帮助</h1>
            <p class="help-lead">
              从查找一道题，到建立自己的题单和试卷。这里汇总了 Mathverse 常用功能的简明说明。
            </p>
            <div class="help-callout">
              <span class="help-callout-icon" aria-hidden="true">i</span>
              <div>
                <strong>第一次使用？</strong>
                <p>建议先从题库开始。你可以按知识点、年份、题型和难度逐步缩小范围。</p>
              </div>
            </div>
            <div class="help-quick-grid">
              <RouterLink :to="{ name: 'problems' }" class="help-quick-card">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4.5 4.5h5.25A2.25 2.25 0 0 1 12 6.75V21a3 3 0 0 0-3-3H4.5z" />
                  <path d="M19.5 4.5h-5.25A2.25 2.25 0 0 0 12 6.75V21a3 3 0 0 1 3-3h4.5z" />
                </svg>
                <span><strong>浏览题库</strong><small>筛选并查看题目</small></span
                ><b aria-hidden="true">→</b>
              </RouterLink>
              <RouterLink :to="{ name: 'training' }" class="help-quick-card">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 4h12v17H6zM9 9h6M9 13h6M9 17h4" />
                </svg>
                <span><strong>进入题单</strong><small>整理与集中训练</small></span
                ><b aria-hidden="true">→</b>
              </RouterLink>
            </div>
          </section>

          <section id="find-problems" class="help-section" data-help-section>
            <p class="help-section-index">01</p>
            <h2>查找题目</h2>
            <p>
              首页搜索适合直接输入题号、关键词或知识点；当你需要更精确的范围时，可以进入题库使用组合筛选。
            </p>
            <ol class="help-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>输入目标</strong>
                  <p>在首页搜索框输入题号或关键词，快速定位相关题目。</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>组合筛选</strong>
                  <p>在题库中叠加年份、来源、题型、知识点与难度条件。</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>查看与收集</strong>
                  <p>打开题目查看解析，或将它加入题单，留待集中训练。</p>
                </div>
              </li>
            </ol>
            <RouterLink class="help-text-link" :to="{ name: 'problems' }"
              >打开题库 <span>→</span></RouterLink
            >
          </section>

          <section id="difficulty" class="help-section" data-help-section>
            <p class="help-section-index">02</p>
            <h2>理解难度标识</h2>
            <p>
              题目难度使用文字与五角星共同表达，并沿用对应的等级颜色。这样既能快速扫读，也不必仅凭颜色判断。
            </p>
            <div class="help-example-panel">
              <div>
                <span class="help-level help-level--green">基础 ★★★</span
                ><span class="help-level help-level--blue">进阶 ★★★★★</span
                ><span class="help-level help-level--purple">挑战 ★★★★★★★</span>
              </div>
              <p>文字说明等级，星数体现顺序，颜色用于辅助识别。</p>
            </div>
            <p class="help-note">
              <strong>提示：</strong
              >难度是相对参考。你可以结合题型、知识点和自己的完成情况来安排训练顺序。
            </p>
          </section>

          <section id="practice-lists" class="help-section" data-help-section>
            <p class="help-section-index">03</p>
            <h2>题单与训练</h2>
            <p>
              题单可以把分散的题目组织成一次有目标的练习。适合整理错题、专题复习，或为一段时间的学习建立任务清单。
            </p>
            <div class="help-feature-grid">
              <div>
                <strong>随手收集</strong>
                <p>从题目详情或题库列表将题目加入指定题单。</p>
              </div>
              <div>
                <strong>专题整理</strong>
                <p>按章节、薄弱点或复习阶段创建不同题单。</p>
              </div>
              <div>
                <strong>集中训练</strong>
                <p>进入题单详情，按自己的节奏连续完成题目。</p>
              </div>
            </div>
            <RouterLink class="help-text-link" :to="{ name: 'training' }"
              >管理我的题单 <span>→</span></RouterLink
            >
          </section>

          <section id="paper-builder" class="help-section" data-help-section>
            <p class="help-section-index">04</p>
            <h2>自主组卷</h2>
            <p>
              组卷功能适合生成结构化练习或模拟试卷。你可以添加题目、调整顺序，并在预览中检查最终版式。
            </p>
            <div class="help-code-block">
              <div class="help-code-title"><span>推荐流程</span><span>WORKFLOW</span></div>
              <code
                >选择题目&nbsp; → &nbsp;调整结构&nbsp; → &nbsp;预览试卷&nbsp; →
                &nbsp;打印或保存</code
              >
            </div>
            <RouterLink class="help-text-link" :to="{ name: 'paper-library' }"
              >进入我的试卷 <span>→</span></RouterLink
            >
          </section>

          <section id="print-export" class="help-section" data-help-section>
            <p class="help-section-index">05</p>
            <h2>打印与导出</h2>
            <p>
              在题目或试卷的预览页面使用打印功能。正式打印前，建议先确认纸张方向、页边距以及是否需要显示答案与解析。
            </p>
            <div class="help-callout help-callout--plain">
              <span class="help-callout-icon" aria-hidden="true">✓</span>
              <div>
                <strong>获得更稳定的版式</strong>
                <p>优先使用浏览器的打印预览，并将缩放保持在默认值附近。</p>
              </div>
            </div>
          </section>

          <section id="account" class="help-section" data-help-section>
            <p class="help-section-index">06</p>
            <h2>账户与个人主页</h2>
            <p>
              登录后，题单、学习记录与个人设置会关联到你的账户。个人主页用于集中查看学习概况和已保存内容。
            </p>
            <div class="help-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>功能</th>
                    <th>未登录</th>
                    <th>登录后</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>浏览和搜索题目</td>
                    <td>可以</td>
                    <td>可以</td>
                  </tr>
                  <tr>
                    <td>保存个人题单</td>
                    <td>不可</td>
                    <td>可以</td>
                  </tr>
                  <tr>
                    <td>同步学习数据</td>
                    <td>不可</td>
                    <td>可以</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <RouterLink class="help-text-link" :to="{ name: 'login' }"
              >登录或创建账户 <span>→</span></RouterLink
            >
          </section>

          <section id="personalization" class="help-section" data-help-section>
            <p class="help-section-index">07</p>
            <h2>个性化设置</h2>
            <p>
              首页底部的 Settings
              菜单提供背景更换与使用帮助入口。背景既可以从预设图片中选择，也可以使用本地图片。
            </p>
            <ul class="help-check-list">
              <li><span>✓</span>选择预设背景，快速切换首页氛围</li>
              <li><span>✓</span>上传本地背景，仅在当前浏览器中使用</li>
              <li><span>✓</span>随时恢复默认背景</li>
            </ul>
          </section>

          <section id="faq" class="help-section" data-help-section>
            <p class="help-section-index">08</p>
            <h2>常见问题</h2>
            <details open>
              <summary>为什么筛选后没有题目？</summary>
              <p>可能是同时使用了较多筛选条件。尝试先清除一个条件，或扩大年份与难度范围。</p>
            </details>
            <details>
              <summary>首页背景会同步到其他设备吗？</summary>
              <p>目前背景偏好保存在当前浏览器中；更换设备或清除浏览器数据后需要重新设置。</p>
            </details>
            <details>
              <summary>发现题目或解析有问题怎么办？</summary>
              <p>请通过反馈页面提交问题，并尽量附上题号和具体说明，方便定位。</p>
            </details>
            <div class="help-ending">
              <div>
                <span>仍然需要帮助？</span>
                <h3>把问题告诉我们</h3>
                <p>你的反馈会帮助 Mathverse 持续完善。</p>
              </div>
              <RouterLink :to="{ name: 'feedback' }">提交反馈</RouterLink>
            </div>
          </section>
        </article>
      </main>

      <aside class="help-toc" aria-label="本页目录">
        <div>
          <p>本页目录</p>
          <button
            v-for="item in allNavigationItems"
            :key="item.id"
            type="button"
            :class="{ 'is-active': activeSection === item.id }"
            @click="scrollToSection(item.id)"
          >
            {{ item.label }}
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
