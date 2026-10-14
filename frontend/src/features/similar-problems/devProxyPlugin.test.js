import assert from 'node:assert/strict'
import test from 'node:test'
import { applyProviderReasoning, requireFinalContent, resolveUpstreamMaxTokens } from './devProxyPlugin.mjs'

test('DeepSeek assistant standard mode budgets for hidden reasoning without changing quick mode', () => {
  const endpoint = new URL('https://api.deepseek.com/chat/completions')
  assert.equal(resolveUpstreamMaxTokens({ endpoint, taskType: 'assistant-diagnose', lowLatency: false, maxTokens: 1400 }), 6000)
  assert.equal(resolveUpstreamMaxTokens({ endpoint, taskType: 'assistant-hint', reasoningLevel: 'deep', maxTokens: 500 }), 12000)
  assert.equal(resolveUpstreamMaxTokens({ endpoint, taskType: 'assistant-hint', lowLatency: true, maxTokens: 500 }), 500)
  assert.equal(resolveUpstreamMaxTokens({ endpoint, taskType: 'similarity', lowLatency: false, maxTokens: 900 }), 900)
  assert.equal(resolveUpstreamMaxTokens({ endpoint: new URL('https://api.openai.com/v1/chat/completions'), taskType: 'assistant-diagnose', lowLatency: false, maxTokens: 1400 }), 1400)
  assert.equal(resolveUpstreamMaxTokens({ endpoint: new URL('https://api.moonshot.ai/v1/chat/completions'), taskType: 'connection-test', lowLatency: true, maxTokens: 12 }), 1024)
})

test('manual assistant generation budgets are provider-neutral and are never replaced by automatic floors', () => {
  for (const url of ['https://api.deepseek.com/chat/completions', 'https://api.openai.com/v1/chat/completions']) {
    const endpoint = new URL(url)
    assert.equal(resolveUpstreamMaxTokens({ endpoint, taskType: 'assistant-hint', reasoningLevel: 'deep',
      maxTokens: 32_768, generationBudgetMode: 'manual' }), 32_768)
    assert.equal(resolveUpstreamMaxTokens({ endpoint, taskType: 'assistant-hint', reasoningLevel: 'deep',
      maxTokens: 8_192, generationBudgetMode: 'manual' }), 8_192)
  }
  assert.throws(() => resolveUpstreamMaxTokens({ endpoint: new URL('https://api.deepseek.com/chat/completions'),
    taskType: 'assistant-hint', maxTokens: 65_537, generationBudgetMode: 'manual' }), /256–65,536/)
  assert.throws(() => resolveUpstreamMaxTokens({ endpoint: new URL('https://api.deepseek.com/chat/completions'),
    taskType: 'assistant-hint', maxTokens: 8_192, generationBudgetMode: 'unknown' }), /额度模式不正确/)
})

test('flagship reasoning modes map by model and preserve quick Kimi thinking', () => {
  const cases = [
    ['https://api.deepseek.com/chat/completions', 'deepseek-v4-pro', 'quick', { thinking: { type: 'disabled' } }],
    ['https://api.deepseek.com/chat/completions', 'deepseek-v4-pro', 'deep', { reasoning_effort: 'max' }],
    ['https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen3.8-max', 'standard', { reasoning_effort: 'medium' }],
    ['https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen3.8-max', 'deep', { reasoning_effort: 'xhigh' }],
    ['https://api.moonshot.ai/v1/chat/completions', 'kimi-k3', 'quick', { reasoning_effort: 'low' }],
    ['https://api.moonshot.ai/v1/chat/completions', 'kimi-k3', 'deep', { reasoning_effort: 'max' }],
  ]
  for (const [url, model, reasoningLevel, expected] of cases) {
    const body = {}
    applyProviderReasoning(body, { endpoint: new URL(url), model, reasoningLevel })
    assert.deepEqual(body, expected)
  }
})

test('proxy accepts final text but never exposes reasoning-only or truncated output as an answer', () => {
  assert.equal(requireFinalContent({ choices: [{ finish_reason: 'stop', message: { content: '最终答案', reasoning_content: 'private' } }] }), '最终答案')
  assert.throws(() => requireFinalContent({ choices: [{ finish_reason: 'length', message: { content: '未完成', reasoning_content: 'private' } }] }), /调高生成额度/)
  assert.throws(() => requireFinalContent({ choices: [{ finish_reason: 'stop', message: { content: '', reasoning_content: 'private' } }] }), /只生成了思考过程/)
  assert.throws(() => requireFinalContent({ choices: [{ finish_reason: 'content_filter', message: { content: null } }] }), /过滤/)
  assert.throws(() => requireFinalContent({ choices: [{ finish_reason: 'stop', message: { content: null } }] }), /未返回可展示/)
})
