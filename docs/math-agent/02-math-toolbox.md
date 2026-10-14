---
title: Math Toolbox Schema
version: 0.2
status: active
last_updated: 2026-09-24
depends_on:
  - 00-architecture
related:
  - 03-response-blocks
  - 04-user-attempt
  - 08-provider-adapter
---

# Math Toolbox Schema

## 1. Principle

Tool 是平台提供的受控能力，不是 prompt 片段。每个 Tool 必须具有稳定名称、输入/输出 schema、执行类型、权限、成本、超时、置信度和失败语义。

## 2. Categories

```text
problem_analysis
symbolic_math
numerical_math
verification
proof_analysis
visualization
learning_and_tutoring
problem_retrieval
user_attempt_analysis
```

## 3. Tool Definition

```ts
interface MathToolDefinition<I, O> {
  name: string;
  version: string;
  description: string;
  category: string;
  executionType: "deterministic" | "llm" | "hybrid" | "frontend";
  inputSchema: unknown;
  outputSchema: unknown;
  permissions: string[];
  timeoutMs: number;
  costClass: "low" | "medium" | "high";
  execute(input: I, context: ToolContext): Promise<ToolResult<O>>;
}

interface ToolResult<T> {
  status: "success" | "partial" | "failed" | "unsupported";
  data?: T;
  confidence?: number;
  assumptions?: string[];
  warnings?: string[];
  error?: { code: string; message: string; retryable: boolean };
  provenance?: unknown;
}
```

## 4. Problem Analysis

- `analyze_problem`: identify givens, goal, constraints and structure.
- `identify_concepts`: map concepts and prerequisites.
- `identify_candidate_methods`: produce defensible candidate routes.
- `compare_methods`: compare applicability, cost and pedagogical value.
- `find_prerequisites`: find missing prerequisite concepts.

These tools are semantic and may use an LLM, but outputs remain structured and may require downstream verification.

方法比较至少应说明：适用前提、题目中支持这些前提的证据、预计主要工作量或关键难点、继续尝试的观察点、应放弃或换路的信号，以及可切换到哪条路线和理由。成本是相对于当前题目与学生已完成的步骤的估计，不宣称存在对所有人都最快的万能方法。若前提未经证实，应标为待检查；不能因官方解答选择另一条路线就否定学生可行的方法。

## 5. Symbolic Mathematics

Use a unified `symbolic_math` interface with operations such as simplify, expand, factor, solve, differentiate, integrate, limit and matrix operations. Inputs include expression, variables, assumptions, domain and requested operation.

Never execute arbitrary user/model code. Parse against an allowlist, validate symbols and complexity, impose time/memory limits, and return assumptions plus unevaluated/conditional results when necessary.

## 6. Numerical Mathematics

`numerical_math` supports evaluation, root finding, optimization, approximation and sampling. Results must include precision, tolerance, convergence status, domain warnings and method when relevant. A numerical approximation must not silently replace a requested proof.

## 7. Verification

- `verify_expression`
- `verify_equivalence`
- `verify_step`
- `verify_solution`

Verification returns status such as valid, invalid, conditional or unknown, together with assumptions and a counterexample or mismatch when available. Mathematical verification and pedagogical explanation are separate stages.

## 8. Proof Analysis

- `analyze_proof`
- `check_proof_step`
- `find_first_gap`
- `identify_used_theorem`
- `check_assumptions`
- `find_counterexample`

Proof tools must distinguish missing justification from false statements and prioritize the first significant gap rather than reporting every downstream consequence.

## 9. Visualization

`render_math_scene` produces a validated Math Scene DSL, never executable JavaScript.

```ts
interface MathScene {
  type: string;
  coordinateSystem?: string;
  objects: VisualObject[];
  parameters?: VisualParameter[];
  interactions?: InteractionConfig[];
  annotations?: string[];
}
```

Supported objects can include functions, points, lines, conics, vectors, areas, fields and labels. Parameters declare range, step and initial value; interactions declare drag, slider, animation and focus behavior. Rendering belongs to the frontend engine.

`render_strategy_map` returns a teaching-oriented graph of methods, conditions, decisions, dead ends and verification—not hidden chain-of-thought.

## 10. Learning and Tutoring

- `generate_hint`
- `generate_next_step`
- `diagnose_attempt`
- `explain_motivation`
- `generate_variant`
- `explain_concept`

These are orchestration/domain tools. They consume context and policy, may invoke other tools, and must honor Hint State and Reveal Budget.

## 11. Problem Retrieval

- `find_similar_problems`: structural similarity.
- `find_repair_problem`: target a prerequisite gap.
- `find_transfer_problem`: test transfer to a different surface form.
- `find_prerequisite_problem`: practice a dependency.

Retrieval results include reasons and targeted concepts, not just IDs.

跨题关联必须给出可检查的关系类型，例如“同一核心不变量”“同一换元触发条件”“表面相似但关键前提不同”“此题是该方法的反例/边界情形”。结果同时指向具体题目、相关步骤或概念、共享结构、重要差异和对当前学习目标的用途。仅靠关键词或向量相似度命中不能表述为数学上的同构；若题库缺少可信候选，应明确没有找到，而不是编造题目。用于教学的关联应先受 Hint Reveal Policy 约束，不直接展示另一题的完整解答。

## 12. User Attempt Analysis

- `parse_user_attempt`
- `analyze_handwriting`
- `handwriting_to_attempt`
- `compare_user_solution`

Recognition output retains alternatives and confidence. Attempt analysis remains independent of the official solution and preserves viable user routes.

## 13. Tool Composition

Examples:

```text
“这一步对吗？” → parse attempt → verify step → compose VerificationBlock
“为什么想到这里？” → analyze problem → identify methods → explain motivation
“我不会” → diagnose blocker → generate minimum hint
upload draft → recognize → confirm uncertain regions → parse → find first gap
“画出来” → analyze visual need → build MathScene → frontend render
```

Tool Graph execution must be bounded and observable.

## 14. Selection Policy

- **Deterministic first** for reliable computation and validation.
- **Semantic first** for intent, method and conceptual analysis.
- **Hybrid validation** when semantic output contains checkable mathematics.
- Respect tool budget, latency, permissions and data sensitivity.
- Prefer a smaller sufficient tool set over exposing every tool.

## 15. Confidence and Failure

Confidence is scoped to a claim, not a global truth score. Recognition, semantic interpretation, numerical convergence and mathematical verification use distinct confidence fields.

Failures are explicit. Fallback may simplify the request, ask for confirmation, switch executor, or return `unknown`; it must not fabricate success.

## 16. Registry and Provider Independence

The Tool Registry owns discovery, versioning, schemas, permissions and executors. Model providers only receive the subset of tool schemas selected for the turn. Provider-specific function-call syntax stays inside the Provider Adapter.
