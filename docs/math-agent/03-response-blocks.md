---
title: Agent Response Block Protocol
version: 0.2
status: active
last_updated: 2026-09-22
depends_on:
  - 00-architecture
related:
  - 01-hint-system
  - 02-math-toolbox
  - 04-user-attempt
  - 10-experience-orchestration
---

# Agent Response Block Protocol

## 1. Purpose

Agent 输出从纯 Markdown 升级为可组合、可交互、可追踪学习状态的界面。自由文本仍可作为 block 内容，但不能承担整个产品协议。

## 2. Top-Level Schema

```ts
interface AgentResponse {
  responseId: string;
  intent: AgentIntent;
  blocks: PresentationBlock[];
  suggestedActions?: SuggestedAction[];
  statePatch?: AgentStatePatch;
  metadata: ResponseMetadata;
}

type AgentIntent =
  | "answer" | "hint" | "next_step" | "diagnose"
  | "explain" | "explain_motivation" | "verify"
  | "visualize" | "compare" | "practice";
```

## 3. Base Block

```ts
interface PresentationBlock {
  id: string;
  type: PresentationBlockType;
  source: BlockSource;
  pedagogicalRole: PedagogicalRole;
  visibility: "visible" | "collapsed" | "locked" | "hidden";
  contextRef?: BlockContextRef;
  interactions?: BlockInteraction[];
  metadata?: Record<string, unknown>;
}
```

`source` identifies agent, deterministic tool, retrieval, official solution or user attempt. `pedagogicalRole` identifies orient, prompt, explain, verify, warn, reveal or practice.

## 4. Block Types

```text
text
intuition
formula
derivation
hint
next_step
question
warning
error_location
verification
concept
comparison
visualization
strategy_map
practice
progress
solution
reference
```

### Text and Intuition

TextBlock holds concise prose. IntuitionBlock explains motivation or mental model and must not masquerade as proof.

### Formula and Derivation

FormulaBlock stores LaTeX plus semantic labels and optional highlights. DerivationBlock contains ordered, addressable steps; each step records expression, justification and dependencies. Do not encode a derivation as one opaque string.

### Hint and Next Step

HintBlock exposes the user-facing hint level and content, not internal solution graph or scoring. NextStepBlock proposes exactly the next action and may include an input affordance.

### Question

QuestionBlock asks a purposeful diagnostic or Socratic question, with response mode and optional choices. It should advance diagnosis or learning, not merely defer work.

### Warning and Error Location

WarningBlock flags conditions, ambiguity or risk. ErrorLocationBlock links the first significant issue to an exact `UserAttempt` step/region, explains impact, and may offer a minimum repair hint.

### Verification

VerificationBlock renders `valid / invalid / conditional / unknown`, assumptions, checked claim and tool provenance. A verification result is not automatically a full explanation.

### Concept and Comparison

ConceptBlock links a definition, intuition, prerequisites and examples. ComparisonBlock contrasts methods by applicability, cost, rigor and learning value; it need not always declare one winner.

### Visualization

VisualizationBlock references a validated Math Scene and its renderer state. It must render as a real interactive component rather than an ASCII or Markdown imitation when the engine is available. Nearby text explains what to observe.

### Strategy Map

```ts
interface StrategyNode {
  id: string;
  label: string;
  kind: "problem" | "method" | "condition" | "step" | "dead_end" | "verification";
  status?: "candidate" | "selected" | "rejected" | "completed";
}
```

StrategyMapBlock stores nodes, edges and a selected path. Users may inspect why a route applies or fails without exposing hidden model reasoning.

### Practice and Progress

PracticeBlock contains targeted problems with reason, concept and difficulty. ProgressBlock displays learning progress or current hint/attempt state without turning uncertain mastery estimates into facts.

### Solution

SolutionBlock is a controlled reveal. It records reveal reason and must update Hint State. It is locked/collapsed until allowed by policy or explicit user intent.

## 5. Suggested Actions

```ts
interface SuggestedAction {
  id: string;
  label: string;
  intent: string;
  payload?: Record<string, unknown>;
  availability?: "enabled" | "disabled" | "hidden";
}
```

Actions are state-dependent, not a permanently fixed button set. Examples: 再提示一点、只告诉我下一步、解释为什么、检查这一行、换一种思路、画出来、显示完整解答。

普通教学回合最多突出一个 primary action；其余保留为 secondary actions。Direct 回合可以没有主操作。每个 action 都应携带明确 target 与必要的 session/attempt version，并映射到同一个 `AgentEvent` 协议；文案不能成为唯一执行参数。

## 6. Block Context and Interaction

Every relevant block can point to a problem, solution step, attempt version, attempt step or image region. Selection/copy/action events preserve these references so follow-up questions remain grounded.

Blocks can be expanded, pinned, copied, selected, acknowledged or used as the next prompt. Interaction events are separate from learning-state evidence.

## 7. Visibility and Reveal Tracking

`viewed` is not the same as `revealed`. A collapsed solution that was never opened should not count as learned information. Opening Hint/Solution blocks creates explicit reveal events, and state changes occur through a typed `statePatch`.

## 8. State Patch

```ts
interface AgentStatePatch {
  hintState?: unknown;
  sessionState?: unknown;
  attemptState?: unknown;
  learnerEvidence?: unknown[];
}
```

StatePatch must be explicit and validated. Rendering text must never silently mutate mastery or hint state.

## 9. Metadata and Response Guard

Metadata includes schema version, timestamps, provider/tool provenance, latency and locale. Before rendering, deterministic guards validate schema, forbidden executable content, reference integrity and solution-leak risk. Guarding is not left to the same LLM's self-evaluation.

## 10. Rendering and Streaming

- Math uses a safe LaTeX renderer.
- Blocks stream as valid units or typed partial states; never expose malformed JSON.
- Long-running tools show a loading state attached to the future block.
- Tool failure renders a clear fallback with retry/alternate action.
- Mobile layouts preserve selection, formulas and action accessibility.
- Main-page and AI-panel renderers share the protocol.

## 11. Composition Rules

- Prefer the fewest blocks that produce a coherent teaching action.
- Put orientation before detail and observation before formal derivation when appropriate.
- Do not repeat identical content in text, formula and hint blocks.
- Keep the learner's attempt visible when diagnosing it.
- Pin high-value visual/strategy components near the referenced material.

## 12. Standard Templates

```text
Simple: Text/Formula + optional actions
Hint: Hint + optional Question + actions
Diagnose: ErrorLocation/Warning + Hint + actions
Explain motivation: Intuition + Formula/Comparison + actions
Visualization: Intuition + Visualization + observation prompt
Strategy: StrategyMap + Comparison + selected next step
Full solution: controlled Solution + Derivation + Verification
```

## 13. Accessibility and Localization

Every visual block requires a textual description and keyboard access. Color cannot be the only status channel. Labels, mathematical prose and screen-reader text are localizable; LaTeX and semantic references remain stable.

## 14. Interaction Envelope 与恢复

`AgentResponse` 是内容与状态补丁协议；子规范 10 的 `InteractionEnvelope` 在呈现时将它与当前 `LearningEpisodeView`、主操作、次要操作、下一步和恢复操作组合。Envelope 不直接修改 Domain State。

QuestionBlock 应说明问题的诊断或教学目的。错误和失败响应必须提供至少一个实际可执行的继续路径。VerificationBlock 的“已验证”状态必须有相应工具证据及适用假设；仅由 LLM 推断时标为未验证或不确定。复杂来源信息可展开查看，不应默认占据主要阅读空间。
