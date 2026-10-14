# Math Agent Architecture Decisions

## ADR-001 — Repository documents are the source of truth

- Date: 2026-09-22
- Status: accepted

Active specifications in `docs/math-agent/` are authoritative. Chat history is not an implementation dependency.

## ADR-002 — Open runtime, custom pedagogical core

- Date: 2026-09-22
- Status: accepted

Do not build the generic Agent runtime from scratch, and do not reshape the product around a single open-source Agent project. Reuse infrastructure for tool loops, persistence, streaming, retries, tracing and interruption while owning the mathematics-learning domain model, pedagogy, schemas and UI.

## ADR-003 — Provider independence

- Date: 2026-09-22
- Status: accepted

GPT, Claude, DeepSeek and Qwen are replaceable reasoning providers. Product capabilities belong to the platform.

## ADR-004 — Structured responses and controlled tools

- Date: 2026-09-22
- Status: accepted

The target UI consumes structured blocks. Mathematical and visualization operations use validated schemas and controlled execution; arbitrary model-generated JavaScript is prohibited.

## ADR-005 — Learning before answer revelation

- Date: 2026-09-22
- Status: accepted

Default behavior uses minimum useful help and preserves the learner's viable route. Explicit user requests for a full answer remain authoritative.

## ADR-006 — Relevant context follows mathematical attention

- Date: 2026-09-23
- Status: accepted

Context selection follows the user's explicit mathematical attention. Explicit selections and references outrank inferred relevance. Context expands progressively from local to problem scope and only then to relevant global state. What the Agent may know remains separate from what reveal policy permits the learner to see.

## ADR-007 — Learner state is evidence, not identity

- Date: 2026-09-23
- Status: accepted

Preference, mastery, learning mode and session state remain separate. Providers emit typed learning evidence rather than directly writing mastery scores; a provider-independent Learner Model Service performs uncertainty-aware state updates. Long-term learning stores structured learning evidence and review state, not unlimited chat history or personality judgments.

## ADR-008 — Application-owned resumable state machine

- Date: 2026-09-23
- Status: accepted

LLMs participate in planning and reasoning but do not own runtime state or transitions. Agent state belongs to the application, teaching turns have explicit stop conditions, tool execution is bounded and guarded, and every important learning interaction can checkpoint, wait, resume, or safely recover without depending on provider-internal state.

## ADR-009 — Evaluate independent learning behavior

- Date: 2026-09-23
- Status: accepted

Answer correctness is necessary but insufficient. Evaluation covers mathematical validity, pedagogical fit, runtime behavior, learning outcomes, and provider reliability. Independent Learning Progress is the primary north-star metric, while severe mathematical errors, premature solution disclosure, false verification, data leakage, and stale-state corruption are release-blocking failures that cannot be offset by aggregate scores.

## ADR-010 — Stable model capabilities, replaceable providers

- Date: 2026-09-23
- Status: accepted

Math Agent expresses model needs through provider-independent capabilities and reasoning levels. Capabilities bind to provider, model and endpoint rather than brand names; the application owns Agent state and tool permissions. Cross-provider fallback requires explicit authorization when it changes the user's privacy boundary, and volatile API facts live in registries, tests and provider notes rather than Domain logic.

## ADR-011 — User-visible experience derives from domain state

- Date: 2026-09-23
- Status: accepted

The learning experience exposes the current goal, focus, help boundary, next action and recovery path using a view derived from application-owned Session, Hint, Attempt and Run state. It does not create a competing source of truth. User corrections and one-turn mode overrides flow through typed Agent events and guarded plans. Already revealed mathematical information cannot be undone by hiding a block or cancelling a run.

## ADR-012 — Typed draft diagnosis is an incremental, provenance-aware slice

- Date: 2026-09-23
- Status: accepted

The first `UserAttempt` slice accepts typed text/LaTeX drafts on a problem page, preserves their raw content and in-page versions, and checks only the first significant obstacle. Deterministic arithmetic findings are distinguished from unverified provider analysis in structured response blocks. Drafts remain memory-only at this stage; persistence, step dependencies/frontier, handwriting, and general mathematical verification require separate implementation and must not be implied by this slice.

## ADR-013 — Context integrity protects existing UI flows

- Date: 2026-09-23
- Status: accepted

The active drawer builds a validated, immutable context snapshot for each request, preserving mathematical source text and typed-step authorship. Changes invalidate the run immediately, even if the user returns to the same selection or draft; late transport results cannot restore cancelled content or recent-call metadata. Disabling page context also excludes its history and prior hints. These checks support the existing UI flows during the UI-first delivery phase. They do not introduce persisted checkpoints, retrieval services, a full Agent Runtime, mathematical verification, or semantic reveal guards.

## ADR-014 — Learner-selected generation ceilings are separate from reasoning depth

- Date: 2026-09-24
- Status: accepted

The learner may explicitly raise or set the per-request generated-token ceiling for difficult mathematics without changing the help/reveal level or requiring a new implementation per model. Explicit ceilings take precedence over provider-specific automatic floors; the adapter validates limits and reports unsupported values rather than silently changing the request. Truncation is a recoverable failure, not a complete answer. Actual provider capability and cost remain model-dependent.

## ADR-015 — Handwriting recognition precedes shared draft diagnosis

- Date: 2026-09-27
- Status: accepted

The incremental handwriting entry reuses the existing Excalidraw infrastructure through an immutable selected-artifact boundary. Native scene data and image snapshots remain raw artifacts; recognized/learner-corrected text is derived input to the existing versioned attempt checker. Recognition confidence never establishes mathematical validity. Provider capabilities and image-message formatting live in an infrastructure adapter, while recognition schema/confirmation and attempt provenance stay portable. Image sending requires an explicit recipient-scoped action; there is no silent provider fallback. Semantic scene revisions expire captures and dependent math feedback even after undo, while mount-time metadata normalization and a transient pre-restoration empty scene are not learner edits. Until raw artifact checkpointing exists, image-linked attempts are memory-only and omitted from typed checkpoints rather than restored with false provenance. ADR-012 describes the initial typed-only stage; this is its next source-ingestion increment.

## ADR-016 — Handwriting recovery is explicit and retains original sources

- Date: 2026-09-27
- Status: accepted

Handwriting checkpointing is an opt-in local action with one latest snapshot per owner/problem and explicit deletion. Raw selected native ink, original image and preview remain separate from recognition, user corrections, unsent editor text and submitted attempt identity/version. An allowlisted schema excludes credentials, sending consent, mathematical feedback, tool results and running calls. Durable source tokens and source/image hashes reject changed or corrupted input before restoration; hashes do not verify mathematics. Recovery requires a fresh reading confirmation and never resumes a paid request or presents old diagnoses as current evidence. Incomplete image-derived text cannot be restored through typed-only checkpoints. Native canvas and selected-attempt backups have distinct visible deletion scopes. This extends ADR-015's initial memory-only stage; server sessions, complete history and cross-device storage remain separate work.

## ADR-017 — Paper-photo recovery owns immutable originals and explicit source rebinding

- Date: 2026-09-27
- Status: accepted

Paper-photo backups are opt-in account/problem-scoped local snapshots independent of native canvas and ink checkpoints. The immutable original photo, derived crop, pixel coordinates and preview retain bounded source/hash provenance; recognition, learner corrections, unsent editor text and submission identity/version remain separate. Recovery validates the allowlisted record and decodes dimensions before replacing current input, then binds the explicitly chosen snapshot to a fresh paper-source revision/account epoch. It preserves submitted version continuity, requires fresh reading confirmation, and excludes credentials, sending/replacement consent, old mathematical evidence, caches and paid-call continuation. Async recovery cannot overwrite intervening edits, and an older saved submission cannot reuse a newer submitted version for different text. Dedicated disk deletion retains current in-memory work; clearing its linked current draft/photo also requests its backup deletion. These consistency checks do not prove OCR, mathematics or record authenticity against wholesale rewriting. Server ownership, cross-device sync and a full version archive remain deferred.
