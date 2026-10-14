<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { MATH_AGENT_EVAL_PROBLEMS } from '../config/mathAgentEvalProblems.js'
import { MATH_AGENT_EVAL_SCENARIOS } from '../config/mathAgentEvalScenarios.js'

const copied = ref('')

async function copyDraft(scenario) {
  await navigator.clipboard.writeText(scenario.draft)
  copied.value = scenario.id
}
</script>

<template>
  <main class="agent-eval-page">
    <h1>Math Agent 人工测试题库</h1>
    <p>仅在本机开发环境可见；题目为原创测试数据，不属于正式题库。请在题目页打开 AI 助手，按下列用例操作。</p>
    <p>建议先不展开题目的「显示答案」，并记录模型、提供商和每次作答结果。请用题目页的“返回人工测试题库”链接在同一标签页切题；API Key 仅保存在当前页面内存，新标签页或刷新后需要重新输入。</p>
    <section v-for="problem in MATH_AGENT_EVAL_PROBLEMS" :key="problem.id">
      <h2><RouterLink :to="`/problems/${problem.id}`">{{ problem.id }} · {{ problem.title }}</RouterLink></h2>
      <article v-for="scenario in MATH_AGENT_EVAL_SCENARIOS.filter((item) => item.problemId === problem.id)" :key="scenario.id">
        <h3>{{ scenario.id }} · {{ scenario.title }}</h3>
        <p>操作：{{ scenario.action }}　｜　检测：{{ scenario.ability }}</p>
        <template v-if="scenario.draft">
          <pre>{{ scenario.draft }}</pre>
          <button type="button" @click="copyDraft(scenario)">{{ copied === scenario.id ? '已复制' : '复制作答' }}</button>
        </template>
        <p class="agent-eval-expected">人工核验：{{ scenario.expected }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.agent-eval-page { max-width: 980px; margin: 2rem auto; padding: 0 1.25rem 4rem; line-height: 1.7; }
.agent-eval-page section { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ccd6e2; }
.agent-eval-page article { margin: 1rem 0; padding: 1rem; border: 1px solid #dce4ee; border-radius: .6rem; }
.agent-eval-page h3 { margin-top: 0; }
.agent-eval-page pre { white-space: pre-wrap; background: #f6f8fb; padding: .75rem; border-radius: .4rem; }
.agent-eval-page button { cursor: pointer; padding: .35rem .75rem; }
.agent-eval-expected { color: #344b68; }
</style>
