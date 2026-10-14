---
title: User Attempt and Handwriting Protocol
version: 0.1
status: active
last_updated: 2026-09-22
depends_on:
  - 00-architecture
related:
  - 01-hint-system
  - 02-math-toolbox
  - 03-response-blocks
---

# User Attempt & Handwriting Protocol

## 1. Purpose

用户真实解题过程必须成为 Agent 可理解、定位、诊断和继续辅导的结构化对象。目标不只是把手写识别成 LaTeX，而是保留来源、版本、空间结构、不确定性、推理关系与用户所有权。

## 2. UserAttempt

```ts
interface UserAttempt {
  id: string;
  problemId: string;
  source: AttemptSource;
  version: number;
  rawArtifacts: RawArtifactRef[];
  steps: AttemptStep[];
  edges: AttemptEdge[];
  currentFocus?: AttemptFocus;
  currentFrontier?: string[];
  status: "in_progress" | "stuck" | "submitted" | "completed" | "abandoned";
  createdAt: string;
  updatedAt: string;
}

type AttemptSource = "latex" | "plain_text" | "ink" | "image" | "diagram" | "mixed";
```

Raw input is immutable. Recognition, normalization and interpretation are derived layers and must never overwrite the original artifact.

## 3. Attempt Steps and Relations

```ts
interface AttemptStep {
  id: string;
  type: "expression" | "equation" | "claim" | "definition" | "case" | "diagram" | "note";
  rawContentRef?: string;
  normalizedContent?: string;
  interpretation?: StepInterpretation;
  verification?: StepVerification;
  recognitionConfidence?: number;
  interpretationConfidence?: number;
  mathConfidence?: number;
  author: "user" | "accepted_ai_suggestion";
}

type StepRelation =
  | "follows_from" | "equivalent_to" | "implies"
  | "case_of" | "depends_on" | "contradicts"
  | "annotates" | "spatially_related";
```

Confidence dimensions are separate. High OCR confidence does not imply mathematical correctness; low OCR confidence does not imply an error.

## 4. Parsing Typed Attempts

### LaTeX

Parse expressions and environments while retaining source ranges. Do not split steps mechanically at every newline: aligned equations, explanatory text and multi-line cases require semantic grouping.

### Plain Text

Preserve claims, connectives, references and embedded formulas. Normalize only into a derived representation.

## 5. Ink Capture

The in-site handwriting canvas stores stroke data in addition to snapshots:

```ts
interface InkStroke {
  id: string;
  points: Array<{ x: number; y: number; t: number; pressure?: number }>;
  tool: string;
  color?: string;
  width?: number;
}
```

Stroke order can help distinguish superscripts, corrections and reading order, but must not be overinterpreted as hesitation, ability or personality.

## 6. Recognition Pipeline

```text
raw ink/image
→ preprocessing and region detection
→ reading-order hypotheses
→ symbol/expression recognition
→ alternatives with confidence
→ structural parsing
→ user confirmation when material
→ AttemptStep graph
```

Recognition Layer and Mathematical Reasoning Layer remain separate.

```ts
interface RecognizedBlock {
  id: string;
  region: unknown;
  primary: string;
  alternatives: Array<{ value: string; confidence: number }>;
  confidence: number;
  readingOrder?: number;
}
```

Ask for confirmation when uncertainty changes mathematical meaning. Do not interrupt for every low-impact ambiguity. Thresholds depend on semantic risk, not only raw confidence.

## 7. Reading Order and Attempt Graph

Math scratch work may branch, circle back, annotate or place alternatives side by side. Model it as a graph with explicit reading/spatial edges. MVP may produce a linearized view, but must retain enough provenance to revise the order later.

## 8. Paper Draft Images

Keep original image and derived crops/regions. Allow the user to select a region and choose: recognize, explain, check, continue, or ask AI. Use progressive context expansion: start from the selected region, add neighboring regions only when needed, then request the full page if required.

Image/vision calls should be cached by content hash and region/version. Apply data minimization and clear retention controls.

## 9. Current Focus and Frontier

The newest stroke or line is not necessarily the user's question. `AttemptFocus` records selected steps/regions and explicit intent. `currentFrontier` records the unresolved leaf or leaves from which a next step can legitimately proceed.

“下一步” may advance the current frontier only; it should not silently jump to a different solution route.

## 10. Diagnosis Pipeline

```text
understand source and uncertainty
→ reconstruct route
→ identify method and goal
→ verify dependencies in order
→ locate first significant issue
→ classify route status
→ decide minimum useful feedback
```

Route status:

```text
valid
valid_but_incomplete
valid_but_inefficient
blocked_by_missing_tool
contains_execution_error
contains_logical_gap
invalid_route
uncertain_due_to_recognition
```

“检查我的思路” does not mean line-edit everything. Report the first issue that invalidates or blocks downstream work. Keep cosmetic issues separate from structural ones.

## 11. Route Preservation

Official solutions are references, not the sole valid route. Independently evaluate the user's method. Preserve any viable route and explain method switching only when necessary or requested. Multiple correct routes remain distinct in the attempt graph.

## 12. Revision and Invalidation

Every edit creates or updates an Attempt version. When a step changes, invalidate cached verification and downstream conclusions that depend on it. Ink erasures, moved regions and paper-image replacements are tracked as revisions.

Never reuse a mathematical verification result when its source or assumptions changed.

## 13. Authorship and AI Feedback

AI feedback does not become part of the user's attempt automatically. The user may explicitly accept a suggestion, which records `accepted_ai_suggestion`. Agent must not silently rewrite the draft.

Independent user progress and progress after a revealed suggestion are different mastery evidence strengths.

## 14. Interaction Modes

Support explicit scoped intents:

```text
只检查计算
只检查严谨性
这个思路可行吗
检查到这里
为什么做不下去
只告诉我下一步
```

The scope constrains tools and response blocks.

## 15. Diagram Attempts

Geometry diagrams are observations and constraints, not mathematical facts by default. Extract points, lines, relations and labels with confidence. Distinguish drawn appearance from stated/proven relations; a segment that looks perpendicular is not automatically perpendicular.

## 16. Vision Providers

Vision/OCR providers sit behind adapters. Store provider-independent region, alternative and confidence schemas. A fallback may try another recognizer or ask the user, but must not convert uncertainty into a confident correction.

## 17. Attempt Analysis Output

```ts
interface AttemptAnalysis {
  detectedMethod?: string;
  routeStatus: string;
  currentFrontier: string[];
  firstSignificantIssue?: {
    stepId: string;
    kind: string;
    impact: string;
  };
  recognitionQuestions?: unknown[];
  nextPedagogicalAction: string;
  toolEvidence?: unknown[];
}
```

This output maps to ErrorLocation, Warning, Verification, Hint, Question and NextStep blocks.

## 18. Completion

Attempt completion distinguishes correct conclusion with valid process, correct conclusion with invalid/unknown process, partial valid progress, and unresolved recognition. A correct final answer alone does not erase a flawed derivation.

## 19. Privacy

- Store only artifacts needed for the learning feature.
- Give users visibility and deletion controls for images and strokes.
- Do not use drafts for unrelated personality inference.
- Do not send an entire page to a vision provider when a selected crop suffices.
