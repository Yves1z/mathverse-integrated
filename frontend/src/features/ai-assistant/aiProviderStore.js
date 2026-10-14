import { computed, reactive, ref } from 'vue'

export const AI_PROVIDER_PRESETS = {
  qwenVision: {
    label: 'Qwen 手写识别',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-vl-plus', timeout: 90,
  },
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-flash',
    timeout: 90,
  },
  deepseekPro: {
    label: 'DeepSeek V4 Pro',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-pro',
    timeout: 120,
  },
  qwen: {
    label: 'Qwen 百炼',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen3.8-flash',
    timeout: 120,
  },
  qwenMax: {
    label: 'Qwen 3.8 Max',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen3.8-max',
    timeout: 120,
  },
  kimi: {
    label: 'Kimi K3',
    endpoint: 'https://api.moonshot.ai/v1/chat/completions',
    model: 'kimi-k3',
    timeout: 120,
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
    timeout: 60,
  },
}

const apiConfig = reactive({ provider: '', endpoint: '', model: '', key: '', timeout: 90 })
const lastCall = ref(null)
const connectionStatus = ref({ tone: '', message: '尚未测试' })

const providerLabel = computed(() => {
  if (AI_PROVIDER_PRESETS[apiConfig.provider]) return AI_PROVIDER_PRESETS[apiConfig.provider].label
  return apiConfig.model || '未配置模型'
})

export function applyAiProviderPreset(provider) {
  const preset = AI_PROVIDER_PRESETS[provider]
  if (!preset) return
  // Keys are region/provider-specific. Never carry one vendor's key to another host.
  const previousHost = safeHost(apiConfig.endpoint)
  const nextHost = safeHost(preset.endpoint)
  Object.assign(apiConfig, { provider, ...preset, key: previousHost === nextHost ? apiConfig.key : '' })
  connectionStatus.value = { tone: '', message: '已填入官方地址，请补充 API Key' }
}

function safeHost(rawUrl) {
  try { return new URL(rawUrl).hostname.toLowerCase() } catch { return '' }
}

export function recordAiCall(call) {
  lastCall.value = { at: new Date().toISOString(), ...call }
}

export function useAiProviderSettings() {
  return {
    apiConfig,
    connectionStatus,
    lastCall,
    providerLabel,
    applyProviderPreset: applyAiProviderPreset,
  }
}
