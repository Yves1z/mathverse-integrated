---
title: Provider Adapter Protocol
version: 0.1
status: active
last_updated: 2026-09-23
depends_on:
  - 00-architecture
  - 02-math-toolbox
  - 03-response-blocks
  - 05-context-engine
  - 07-agent-state-machine
related:
  - 04-user-attempt
  - 06-learner-model
  - 09-evaluation
---

# Math Agent 子规范 08
# Provider Adapter Protocol v0.1

## 0. 文档目标

Provider Adapter 负责隔离不同模型供应商、模型与 API endpoint 的差异。Math Agent Domain 只表达所需的 reasoning、tool calling、vision、structured output、streaming 和 context 能力，不感知 `reasoning_effort`、`thinking_budget`、`enable_thinking`、`tool_choice`、`response_format` 等供应商字段。

```text
Math Agent
    ↓
Unified Model Interface
    ↓
Provider Adapter
    ↓
Provider API
```

Provider-specific logic 不得污染 Hint System、Pedagogy Planner、Context Engine、Learner Model、Math Toolbox 或 Response Blocks。

## 1. 核心原则

1. `Provider ≠ Capability`。能力绑定 `Provider + Model + Endpoint`，不能由品牌名推断。
2. Reasoning depth 是领域意图，不是供应商参数。
3. 高推理强度与长答案、更多提示或答案揭露严格分离。
4. 应用拥有 Agent 状态；供应商的 conversation、response 或 reasoning state 只能用于优化。
5. Tool permission、Tool Budget、Reveal Policy 与状态变更属于 Runtime。
6. 跨 Provider fallback 不得静默改变用户的数据与隐私边界。
7. Adapter 应可替换；增加 Provider 不应要求重写教学领域模型。
8. 模型名、能力、上下文窗口、价格与 API 参数是易变基础设施知识，不是永久 Domain Rule。

## 2. 总体架构

```text
TeachingPlan
    ↓
ModelRequirements
    ↓
ModelRouter
    ↓
CapabilityRegistry
    ↓
ProviderAdapter
    ↓
Provider API
    ↓
UnifiedModelResponse
    ↓
Agent Runtime
    ↓
Response Blocks
```

具体实现可以使用组合而非继承；硬性要求是 Domain Interface 统一。

## 3. 模型身份与统一请求

```ts
type ProviderId =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "qwen"
  | "openai_compatible"
  | "custom";

interface ModelIdentity {
  providerId: ProviderId;
  modelId: string;
  endpointType: "responses" | "chat_completions" | "messages" | "custom";
  baseUrl?: string;
  deploymentRegion?: string;
  version?: string;
}

interface UnifiedModelRequest {
  model: ModelIdentity;
  messages: UnifiedMessage[];
  reasoning: ReasoningConfig;
  response: ResponseConfig;
  tools?: UnifiedToolDefinition[];
  toolChoice?: UnifiedToolChoice;
  visionInputs?: UnifiedVisionInput[];
  streaming?: boolean;
  timeoutMs?: number;
  metadata?: RequestMetadata;
}

interface UnifiedMessage {
  role: "system" | "developer" | "user" | "assistant" | "tool";
  content: UnifiedContent[];
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

type UnifiedContent = TextContent | ImageContent | ToolResultContent | StructuredDataContent;
```

## 4. Provider Adapter Contract

```ts
interface ModelProviderAdapter {
  readonly providerId: ProviderId;
  normalizeModelId(modelId: string): string;
  getCapabilities(model: ModelIdentity): Promise<ModelCapabilities>;
  translateRequest(
    request: UnifiedModelRequest,
    capabilities: ModelCapabilities
  ): ProviderRequest;
  execute(
    request: ProviderRequest,
    credentials: ProviderCredentials
  ): Promise<ProviderResponse>;
  stream?(
    request: ProviderRequest,
    credentials: ProviderCredentials
  ): AsyncIterable<ProviderStreamEvent>;
  normalizeResponse(response: ProviderResponse): UnifiedModelResponse;
  normalizeError(error: unknown): UnifiedProviderError;
}
```

Adapter 负责格式、API 参数、能力、流、响应和错误适配。Prompt Builder 负责把 `AgentContext` 与 `TeachingPlan` 表达为统一消息；Pedagogy Planner 不得承载 Provider quirks。

## 5. Capability Model 与 Registry

```ts
interface ModelCapabilities {
  model: ModelIdentity;
  inputModalities: { text: boolean; image: boolean; video?: boolean; audio?: boolean };
  outputModalities: { text: boolean; image?: boolean; audio?: boolean };
  toolCalling: ToolCallingCapabilities;
  structuredOutput: StructuredOutputCapabilities;
  reasoning: ReasoningCapabilities;
  streaming: StreamingCapabilities;
  context: ContextCapabilities;
  caching?: CacheCapabilities;
  status: "verified" | "declared" | "inferred" | "unknown";
  lastVerifiedAt?: string;
}

interface ToolCallingCapabilities {
  supported: boolean;
  parallelCalls?: boolean;
  toolChoice?: boolean;
  streamingToolCalls?: boolean;
  multiRound?: boolean;
  maxTools?: number;
  limitations?: string[];
}

interface StructuredOutputCapabilities {
  supported: boolean;
  mode?: "native_schema" | "json_mode" | "prompt_only";
  strictSchema?: boolean;
  limitations?: string[];
}

interface ReasoningCapabilities {
  supported: boolean;
  canDisable?: boolean;
  supportedLevels: ProviderReasoningLevel[];
  defaultLevel?: ProviderReasoningLevel;
  nativeParameter?:
    | "reasoning_effort"
    | "reasoning.effort"
    | "output_config.effort"
    | "thinking_budget"
    | "enable_thinking"
    | "adaptive_thinking"
    | "custom";
  supportsAdaptiveThinking?: boolean;
  supportsThinkingBudget?: boolean;
  thinkingVisible?: boolean;
  reasoningSummary?: boolean;
  limitations?: string[];
}

interface ContextCapabilities {
  maxContextTokens?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  recommendedOutputTokens?: number;
  supportsLongContext?: boolean;
}
```

能力数据来源优先级：

```text
verified project registry
→ Provider metadata API
→ documentation snapshot
→ runtime capability probe
→ user-declared custom config
→ conservative fallback
```

未知能力不得默认开启 tools、vision 或 structured output。自定义 endpoint 可做低成本 probe，但只在 model、endpoint、capability hash 变化、registry 过期或用户主动刷新时重新探测。能力置信度区分 `verified / declared / probed / inferred / unknown`。

一次网络错误不能导致能力降级；连续的明确 `unsupported_capability` 可以临时标为 suspect/unavailable，等待 registry refresh。

## 6. Reasoning Abstraction

```ts
type ReasoningLevel = "auto" | "fast" | "standard" | "deep" | "max";

interface ReasoningConfig {
  level: ReasoningLevel;
  allowThinking?: boolean;
}

interface ResponseConfig {
  detail: "minimal" | "concise" | "normal" | "detailed";
  structuredOutput?: StructuredOutputRequest;
  maxOutputTokens?: number;
}

interface ResolvedReasoningConfig {
  requestedLevel: ReasoningLevel;
  effectiveLevel: ReasoningLevel;
  providerValue?: string | number;
  thinkingEnabled?: boolean;
  degraded: boolean;
  reason?: string;
}
```

`auto` 先由 Planner 根据任务复杂度、Intent、Learning Mode 与工具需求解析为领域级别，再由 Adapter 映射。Provider adaptive reasoning 只能作为第二层调节。模型能力不足时向下 clamp，并记录 degradation；不因缺少完全相同的原生档位而失败。

`reasoning = max` 与 `response.detail = concise` 完全合法。Provider raw chain of thought 不是产品接口，不能写入 Learner Model、Teaching Plan 或 Strategy Map；Strategy Map 必须由结构化教学综合重新生成。

用户可在单次请求中显式选择生成 Token 上限，并与 Reasoning Level、可见回答长度分别控制。显式上限优先于 Adapter 为自动模式设定的输出补额或保守默认值，不得静默提高或降低；实际值仍受该模型已知的最大输出、上下文和服务端安全边界约束，无法满足时应明确报错或在发送前告知用户。未知模型不得仅凭厂商品牌推断其原生推理参数。达到生成上限时应标记为 `truncated`，保留学习输入并提供提高额度后重试的恢复路径，不得把截断内容当作完整答案。

## 7. Tool Calling

```ts
interface UnifiedToolDefinition {
  id: string;
  description: string;
  inputSchema: JSONSchema;
}

type UnifiedToolChoice =
  | "auto"
  | "none"
  | { type: "required"; toolId?: string };

interface UnifiedToolCall {
  callId: string;
  toolId: string;
  arguments: unknown;
  rawProviderCallId?: string;
}
```

Domain Tool ID 在所有 Provider 上保持稳定。Provider 返回的 arguments 即使来自 strict schema 也必须再次校验。Adapter 将 Provider-native call 归一化，并把 Math Toolbox 的 `UnifiedToolResult` 翻译回 Provider-native tool result message。

工具循环与最终状态权威属于 Agent Runtime。Adapter 只接收 Tool Selector 已裁剪的工具集，不得重新加入工具。Provider-native multi-tool loop 只有在 Tool Policy、Tool Budget、Reveal Policy 允许时才能使用。

Explicit UI Action 优先直接调用确定性工具。例如用户点击“验证这一步”时，Runtime 可直接调用 `verify_step`，无需模型 function calling。模型不支持 Tool Calling 不等于 Math Toolbox 不可用。

## 8. Structured Output

```ts
interface StructuredOutputRequest {
  schemaId: string;
  schema: JSONSchema;
  strictPreferred: boolean;
}
```

```text
Native strict schema
→ Native JSON mode
→ Prompt-constrained JSON
→ Parse
→ Schema Validate
→ Repair once
→ Fail safely
```

未经 parse 与 schema validation 的 JSON 不能进入 Domain。默认最多修复一次。Presentation schema 失败可降级为 `TextBlock`；tool arguments schema 失败必须拒绝调用，不能猜参数。被截断的结构化输出不能交给 UI 或 Agent State。

## 9. Vision 与模型角色

```ts
interface UnifiedVisionInput {
  id: string;
  source: "url" | "base64" | "file_ref";
  mimeType: string;
  purpose: "handwriting" | "diagram" | "problem_image" | "general";
  crop?: BoundingBox;
}

type ModelRole =
  | "primary_reasoner"
  | "fast_router"
  | "vision_recognizer"
  | "schema_repair"
  | "fallback_reasoner";
```

Vision 只是底层能力，不等于 04 User Attempt Recognition。图像仍须经历 Recognition → Attempt Parsing → Math Analysis，不能由通用视觉模型直接认定学生错误。主模型不支持 vision 时，可由经授权的同 Provider、本地或专用 recognition service 生成结构化 attempt，再交给主模型。

MVP 不要求用户配置多个角色模型；一个 Primary Model 可以承担多数任务，仅在能力缺失时提示或采用明确授权的 fallback。

## 10. Routing 与跨 Provider 边界

```ts
interface ModelRequirements {
  reasoningLevel: ReasoningLevel;
  toolsRequired: boolean;
  visionRequired: boolean;
  structuredOutputRequired: boolean;
  streamingPreferred: boolean;
  minimumContextTokens?: number;
}

interface ModelSelectionPreferences {
  allowedProviders: ProviderId[];
  preferredProvider?: ProviderId;
  allowCrossProviderFallback: boolean;
  optimizeFor: "quality" | "cost" | "latency" | "balanced";
}
```

默认尊重用户选择的 Provider。跨 Provider fallback 仅用于技术不可用或能力缺失，且必须获得授权；不得用于规避安全拒绝，也不得静默发送用户草稿、图片或上下文到另一家 Provider。未开启 auto routing 时，不得偷偷换模型。

OpenAI-compatible 不代表能力完全等同 OpenAI。Responses、reasoning、vision、structured output 与 tool streaming 仍须由 Capability Registry 确认。

## 11. Streaming 与响应归一化

```ts
type UnifiedModelStreamEvent =
  | ModelStartedEvent
  | TextDeltaEvent
  | ToolCallStartedEvent
  | ToolCallDeltaEvent
  | ToolCallCompletedEvent
  | ReasoningSummaryEvent
  | UsageEvent
  | ModelCompletedEvent
  | ModelErrorEvent;

interface UnifiedModelResponse {
  content: UnifiedModelContent[];
  toolCalls: UnifiedToolCall[];
  usage?: UnifiedUsage;
  refusal?: UnifiedRefusal;
  completionStatus: "complete" | "truncated" | "filtered" | "refused";
  providerMetadata?: Record<string, unknown>;
}
```

Provider stream 必须先归一化为 Runtime events，再映射为 Response Block stream；SSE 不直接进入 UI。Reasoning summary 可用于受控诊断，但不能视为完整内部推理。Provider metadata 属于 operational data，不进入 Learner Model。每次请求保留 `runId / providerRequestId / toolRound` 供 tracing 使用。

## 12. Usage、Cost 与 Cache

```ts
interface UnifiedUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  currency?: string;
}
```

Provider 未提供的字段保持 `undefined`，不能写成 0。价格由独立 Pricing Registry 管理，不硬编码在 UI。Prompt caching 是基础设施优化，不能要求 Context Engine 为缓存命中塞入无关历史。Timeout 可按 fast routing、深度数学推理与 vision recognition 分别配置。

## 13. Credentials、BYOK 与隐私

```ts
interface SecretRef { id: string }

interface ProviderCredentials {
  providerId: ProviderId;
  secretRef: SecretRef;
  organizationId?: string;
  projectId?: string;
  additionalHeaders?: Record<string, SecretRef | string>;
}
```

Domain 永远不接触明文 API key。Secret 只能由 Provider Execution Layer 解析，且禁止进入 Prompt、AgentContext、trace text、error report、analytics、Learning Memory 与 conversation export。

BYOK 可提供“仅本次会话 / 保存到此设备 / 安全保存到服务器”等明确选项。浏览器直连必须告知 key 会在浏览器使用并验证 CORS；长期推荐经后端代理以统一 Adapter、Tool Loop、Tracing、Rate Limit 与 Secret Handling。

日志写入前必须执行 secret redaction，默认不记录完整草稿原图或完整私密输入。Adapter 只接收 Context Engine 已准备的 request，不得自行读取更多数据库或追加长期历史。

## 14. Error、Retry、Refusal 与 Fallback

```ts
interface UnifiedProviderError {
  type:
    | "authentication"
    | "permission"
    | "rate_limit"
    | "quota"
    | "invalid_request"
    | "unsupported_capability"
    | "context_overflow"
    | "content_filter"
    | "timeout"
    | "network"
    | "provider_unavailable"
    | "model_not_found"
    | "schema_failure"
    | "unknown";
  providerId: ProviderId;
  modelId?: string;
  retryable: boolean;
  userMessage: string;
  technicalMessage?: string;
  retryAfterMs?: number;
}
```

普通用户不应看到原始 Provider 错误。authentication、invalid request、unsupported capability 与 model not found 默认不重试。rate limit、network、provider unavailable 与 timeout 可有限重试，遵守 retry-after，严禁无限循环。

Context overflow 交回 Context Engine 重新压缩，并最多有限重试。Refusal 与 Provider failure 语义不同；Runtime 不得因为拒绝而自动切换 Provider 绕过安全限制。

## 15. Provider Configuration 与 Custom Endpoint

```ts
interface ProviderConfiguration {
  providerId: ProviderId;
  enabled: boolean;
  credentialRef?: SecretRef;
  baseUrl?: string;
  preferredModel?: string;
  defaultReasoning?: ReasoningLevel;
  capabilityOverrides?: Partial<ModelCapabilities>;
  fallbackPolicy?: ProviderFallbackPolicy;
}

interface OpenAICompatibleProviderConfig {
  baseUrl: string;
  apiKey: SecretRef;
  modelId: string;
  endpointType: "chat_completions" | "responses";
  capabilityOverrides?: Partial<ModelCapabilities>;
}
```

普通配置界面只需 Provider、Model、API Key；Reasoning、Response Detail、Base URL 与 capability override 放入高级设置。系统应自动识别能力，仅在 custom endpoint 或识别失败时允许 override，并提示错误配置风险。连接测试使用短输入、小输出与 fast reasoning；高级能力测试必须可选。

用户的 Provider preference 与当前题目的 TeachingPlan 必须分离，由 Adapter/Router 在明确策略下结合。

## 16. Session、Provider State 与 Raw Data

切换模型后，Hint State、User Attempt、Learning Mode、Context 与 Learner Model 必须保留。Provider conversation ID、previous response ID、prompt cache 与 reasoning state 可用于优化，但 `AgentSession` 始终是唯一权威状态，Runtime 必须能在没有 Provider-side state 时重建请求。

生产环境优先保留 normalized response、usage 与 error metadata，而不是长期保存 raw response 或 raw reasoning。Provider analytics 以成功率、schema/tool failure、latency 与 token usage 等结构化 operational metrics 为主；没有隐私政策与用户授权，不得用用户数学内容训练 Provider benchmark。

## 17. Evaluation 与 Contract Tests

每个 Adapter 必须通过统一 contract tests：

```text
simple text
reasoning resolution
structured output
one tool call
multi-round tool
streaming
vision when supported
timeout
rate limit
invalid key
context overflow
```

测试必须细化到具体 ModelIdentity，而不只测试品牌 Adapter。核心指标包括 Request Success Rate、Tool Call Parse Success、Structured Output Validity、Stream Integrity、Capability Accuracy、Error Normalization Accuracy、Latency 与 Cost Reporting Accuracy。

Reasoning 测试比较 fast/deep 的质量、延迟与成本，不检查或依赖内部 CoT 长度。Router 可参考 09 Evaluation 产生的 Model Evaluation Profile，但模型 benchmark 不得硬编码进业务逻辑。

## 18. Volatile Provider Facts

Provider 当前支持哪些模型、reasoning level、context window、endpoint 与 capability 必须保存在 Registry、测试及 `docs/math-agent/provider-notes/` 中，而不是本稳定协议内。Provider notes 应记录官方来源、验证日期与 operational status，并与 Domain Spec 分离。

新增 Provider 时，主要工作应限于：

```text
new adapter
new registry entries
new capability tests
new provider notes
```

## 19. MVP 范围

第一阶段可正式支持 OpenAI、Anthropic、DeepSeek、Qwen 与 Generic OpenAI-compatible。MVP 必须统一 text、streaming、tool calling、structured output fallback、reasoning abstraction、基础 vision capability flag、error normalization、usage normalization 与 BYOK。

复杂跨 Provider auto routing、自动成本最优、多模型 voting、ensemble reasoning、自动 Provider benchmark 与全部 Provider-native tools 不属于首版硬性范围。

## 20. 最终约束

Provider Adapter 解决的不是“如何同时调用多家 API”，而是：

> 让整个 Math Agent 只面对一套稳定的能力语言，同时把模型世界不断变化的参数、限制和能力差异隔离在基础设施层。
