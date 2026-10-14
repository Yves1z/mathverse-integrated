<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { founders } from '@/data/history'

const router = useRouter()

/*
 * 默认显示排在第一位的成员。
 * founders 为空时使用空字符串，避免报错。
 */
const activeId = ref(founders[0]?.id ?? '')

/*
 * 根据当前选择的 ID 找到对应成员。
 */
const activeFounder = computed(() => founders.find((founder) => founder.id === activeId.value))

const sortedLogs = computed(() => {
  if (!activeFounder.value) {
    return []
  }

  return [...activeFounder.value.logs].sort((a, b) => b.date.localeCompare(a.date))
})

const formatDate = (date) => {
  return date.replaceAll('-', '.')
}

const goBack = () => {
  if (window.history.state?.back) {
    router.back()
    return
  }

  router.replace({ name: 'home' })
}
</script>

<template>
  <main class="history-page app-page">
    <!-- 返回 -->
    <button class="back-button" type="button" aria-label="返回上一页" @click="goBack">←</button>

    <div class="history-container app-page-container app-page-container--narrow">
      <header class="history-header">
        <h1>HISTORY</h1>
        <p>Notes from the people building Mathverse.</p>
      </header>

      <!-- 成员切换 -->
      <nav v-if="founders.length" class="founder-tabs" aria-label="Mathverse members">
        <button
          v-for="founder in founders"
          :key="founder.id"
          class="founder-tab"
          :class="{ active: activeId === founder.id }"
          type="button"
          @click="activeId = founder.id"
        >
          {{ founder.id }}
        </button>
      </nav>

      <!-- 当前成员日志 -->
      <section v-if="activeFounder" class="logs">
        <div
          v-for="(log, index) in sortedLogs"
          :key="`${activeFounder.id}-${log.date}-${index}`"
          class="log-item"
        >
          <time class="log-date">
            {{ formatDate(log.date) }}
          </time>

          <span class="dot" aria-hidden="true">·</span>

          <p>{{ log.text }}</p>
        </div>
      </section>

      <footer class="history-footer">mathverse.com.cn</footer>
    </div>
  </main>
</template>

<style scoped>
.history-page {
  position: relative;

  width: 100%;
  min-height: 100vh;
  min-height: 100svh;

  box-sizing: border-box;
  padding: 0 24px clamp(36px, 5.5vh, 64px);

  background: #f7f9fb;
  color: #334452;
}

/* --------------------
   返回按钮
-------------------- */

.back-button {
  position: absolute;
  top: 28px;
  left: 30px;
  z-index: 10;

  padding: 0;

  border: none;
  background: transparent;

  color: #344b5d;

  font-size: 26px;
  font-weight: 300;
  line-height: 1;

  cursor: pointer;

  transition:
    color 0.15s ease,
    transform 0.15s ease;
}

.back-button:hover {
  color: #174f7c;
  transform: translateX(-2px);
}

/* --------------------
   页面主体
-------------------- */

.history-container {
  position: relative;

  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0;
}

/* --------------------
   页面标题
-------------------- */

.history-header {
  padding-top: clamp(120px, 16vh, 172px);
  text-align: center;
}

.history-header h1 {
  margin: 0;

  color: #175486;

  font-family: 'Times New Roman', Times, Georgia, serif;
  font-size: clamp(54px, 3.55vw, 66px);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.12em;

  /* 补偿末尾字距，让标题在视觉上保持居中。 */
  text-indent: 0.12em;
}

.history-header p {
  margin: clamp(26px, 4.8vh, 50px) 0 0;

  color: #8996a4;

  font-size: 20px;
  line-height: 1.5;
}

/* --------------------
   成员导航
-------------------- */

.founder-tabs {
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  overflow-x: auto;

  margin-top: clamp(48px, 9.8vh, 102px);
  padding: 0 32px;

  border-bottom: 1px solid #dbe2e7;

  scrollbar-width: none;
}

.founder-tabs::-webkit-scrollbar {
  display: none;
}

.founder-tab {
  position: relative;

  flex: 0 0 auto;

  padding: 22px 0 7px;

  border: none;
  background: transparent;

  color: #748695;

  font-family: inherit;
  font-size: 20px;
  font-weight: 400;

  white-space: nowrap;

  cursor: pointer;

  transition: color 0.15s ease;
}

.founder-tab:hover {
  color: #174f7c;
}

.founder-tab.active {
  color: #174f7c;
  font-weight: 500;
}

.founder-tab.active::after {
  content: '';

  position: absolute;

  left: 0;
  right: 0;
  bottom: -1px;

  height: 2px;

  background: #174f7c;
}

/* --------------------
   日志
-------------------- */

.logs {
  width: min(100%, 1000px);
  margin: clamp(46px, 8.6vh, 90px) auto 0;
}

.log-item {
  display: grid;
  grid-template-columns: 82px 32px 1fr;
  column-gap: 22px;
  align-items: baseline;

  padding: 10px 0;
}

.log-date {
  color: #9aa6af;

  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.dot {
  color: #174f7c;

  font-family: Georgia, 'Times New Roman', serif;
  font-size: 22px;
  justify-self: end;
}

.log-item p {
  margin: 0;

  color: #4f5f6b;

  font-size: 20px;
  line-height: 1.7;
}

/* --------------------
   页脚
-------------------- */

.history-footer {
  margin-top: clamp(52px, 10.5vh, 110px);

  color: #a1abb2;

  font-size: 16px;
  text-align: center;
}

/* --------------------
   手机端
-------------------- */

@media (max-width: 600px) {
  .history-page {
    padding: 0 20px 48px;
  }

  .back-button {
    top: 22px;
    left: 20px;
  }

  .history-header {
    padding-top: 100px;
  }

  .history-header h1 {
    font-size: 44px;
    letter-spacing: 0.1em;
    text-indent: 0.1em;
  }

  .history-header p {
    margin-top: 20px;
    font-size: 15px;
  }

  .founder-tabs {
    justify-content: flex-start;
    gap: 28px;

    margin-top: 56px;
    padding: 0;
  }

  .founder-tab {
    padding: 16px 0 14px;

    font-size: 14px;
  }

  .logs {
    margin-top: 48px;
  }

  .log-item {
    grid-template-columns: 70px 16px 1fr;
  }

  .log-item p,
  .log-date {
    font-size: 14px;
  }

  .history-footer {
    margin-top: 80px;

    font-size: 13px;
  }
}
</style>
