# AGENTS.md

You are working on a mathematics learning platform with an embedded Math Agent.

Before modifying Math Agent related code, follow this protocol.

## 1. Read the Constitution

Always read `/MATH_AGENT_CONSTITUTION.md` before implementing or modifying Math Agent behavior. It defines architectural and pedagogical principles that should not be casually overridden.

## 2. Read Current State

Read `/docs/math-agent/CURRENT_STATE.md`. Do not assume the repository already implements the target architecture.

## 3. Determine Required Specifications

Read `/docs/math-agent/TASK-ROUTING.md` and load only the minimum relevant specification set.

## 4. Inspect Real Code

Specifications define the target architecture, not the actual repository layout. Before implementation: inspect the repository, locate the current implementation, identify reusable components and conflicts, and prefer incremental migration over unnecessary rewrites.

## 5. Source of Truth

Files with `status: active` under `/docs/math-agent/` are authoritative. If old code or comments contradict an active specification, treat the code as a possible older architecture unless evidence shows the specification is outdated.

## 6. Preserve Domain Independence

Do not tightly couple Math Agent domain models to LangGraph, OpenAI, Anthropic, DeepSeek, Qwen, JSXGraph, SymPy, or another provider. Infrastructure implements domain interfaces; domain models remain portable.

## 7. Do Not Collapse Layers

Maintain separation between UI, Context Engine, Pedagogy Planner, Agent Orchestrator, Math Toolbox, Learner Model, Provider Adapter, and Visualization Engine. Do not move architecture into a single system prompt.

## 8. User Attempt

Never assume the reference solution is the only valid route. Understand the user's route, evaluate it independently, identify the first significant obstacle, and preserve the route when viable.

## 9. Hint Safety

Never expose a full solution merely because it exists in context. Respect Hint Level, Reveal Budget, Hint State, and Solution Reveal Policy.

## 10. Tool Safety

LLM-generated arbitrary executable code is not a Math Tool. Tools require a defined schema, validated input, controlled execution, and structured output.

## 11. Implementation Workflow

```text
Read relevant docs
→ Inspect current code
→ Map current architecture
→ Identify smallest coherent change
→ Implement
→ Validate schemas
→ Run tests
→ Test actual user flow
→ Update CURRENT_STATE if architecture changed
→ Record architectural decisions when necessary
```

## 12. Documentation Changes

If implementation requires changing an architectural principle, do not silently diverge. Update the relevant specification and, when necessary, `DECISIONS.md`.
