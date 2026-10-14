# DeepSeek Flash — local provider note

- Verified: 2026-09-24
- Model: `deepseek-flash`
- Endpoint: `https://api.deepseek.com/chat/completions`
- Official references: [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/), [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)

The current API documentation says thinking is enabled by default, returns reasoning in `message.reasoning_content` and the final answer in `message.content`, and may return `finish_reason: "length"` when generation reaches the token limit. A successful HTTP response therefore does not guarantee a usable final answer. We infer that the previous 1400-token ceiling on a standard Math Agent draft diagnosis could be exhausted before final text; the specific user response was not logged, so its exact finish reason is unconfirmed.

Current local and backend adapters reserve at least 6000 generated tokens for standard `assistant-*` calls to this endpoint and 12000 for user-selected deep mode. Quick mode still disables thinking and keeps the smaller request limit. Both adapters reject truncated or reasoning-only replies, never display raw reasoning as an answer, and return a specific recovery message. This is a transport/recovery correction, not proof that the model's mathematical diagnosis is correct. Live validation with the user's own Key remains a separate manual step.
