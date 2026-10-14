import assert from 'node:assert/strict'
import test from 'node:test'
import { buildQuestionRecommendations } from '../features/similar-problems/questionRecommendations.js'

test('复数题会即时得到同知识与同结构的离线推荐', () => {
  const results = buildQuestionRecommendations({
    id: 'P10001',
    title: '复数的基本运算',
    content: '(1 + 5i)i 的虚部为多少？',
    tags: ['复数'],
    typeLabel: '单选题',
    level: 'green',
  })

  assert.equal(results.length, 3)
  assert.equal(results.every((item) => item.knowledge.includes('复数')), true)
  assert.equal(results[0].score > 0.4, true)
})

test('站内同类题优先于离线演示候选并排除当前题', () => {
  const current = {
    id: 'GS000010',
    title: '椭圆轨迹问题',
    content: '已知椭圆，求动点轨迹。',
    tags: ['解析几何', '椭圆'],
    typeLabel: '解答题',
    level: 'blue',
  }
  const results = buildQuestionRecommendations(current, [
    current,
    {
      id: 'GS000011',
      title: '椭圆弦长问题',
      content: '直线交椭圆于两点，求弦长范围。',
      tags: ['解析几何', '椭圆'],
      typeLabel: '解答题',
      level: 'blue',
    },
  ])

  assert.equal(results[0].id, 'GS000011')
  assert.equal(results.some((item) => item.id === current.id), false)
})

test('题目详情不把只有宽泛结构相同但知识点不同的题目混入推荐', () => {
  const results = buildQuestionRecommendations({
    id: 'P10002',
    title: '函数的单调性与最值',
    detail: '函数的单调性与最值',
    content: '已知函数 f(x)，求单调区间并讨论极值。',
    tags: ['函数', '导数'],
    typeLabel: '解答题',
    level: 'green',
  })

  assert.equal(results.some((item) => item.knowledge.includes('双曲线')), false)
  assert.equal(results.every((item) => item.metrics.knowledge > 0.1
    || (item.metrics.method > 0.12 && item.metrics.strategy > 0.38)), true)
})
