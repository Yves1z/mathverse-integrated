# Flagship model candidates — provider facts

- Checked: 2026-09-24
- Status: configured and contract-tested locally; **not yet live-tested or ranked for MathSea mathematics**.

| Candidate | Preset endpoint | Reasoning mapping (quick / standard / deep) | Official reference |
|---|---|---|---|
| `deepseek-v4-pro` | `https://api.deepseek.com/chat/completions` | thinking disabled / high / max | [Models](https://api-docs.deepseek.com/quick_start/pricing/), [thinking](https://api-docs.deepseek.com/guides/thinking_mode/) |
| `qwen3.8-max` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | low / medium / xhigh | [Model](https://help.aliyun.com/zh/model-studio/qwen3-8-max), [Chat API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions) |
| `kimi-k3` | `https://api.moonshot.ai/v1/chat/completions` | low / high / max; K3 always thinks | [Model selection](https://www.kimi.ai/help/kimi-api/api-model-selection), [endpoint and key regions](https://www.kimi.ai/help/kimi-api/api-troubleshooting) |

The Kimi preset targets the international open platform (`platform.kimi.ai`). The separate mainland API host `api.moonshot.cn` is also allowed if a user deliberately configures its matching endpoint and key; keys from different regions are not interchangeable. The preset must not silently switch regions.

For Kimi K3 the relay uses `max_completion_tokens` and omits `temperature`. JSON-mode requests continue using `response_format: {"type":"json_object"}`; the model's structured content is still validated by the application. Both relays keep private `reasoning_content` out of learner-facing replies. The generation ceilings are 3000 for Kimi quick, 4000–6000 for standard known thinking models, and 12000 for deep assistant turns. These are initial operational limits, not a claim that every hard problem can be completed within them. A truncated response fails visibly rather than displaying an unfinished solution.

No cross-provider fallback, model voting, automatic math ranking, or hidden change to the learner's selected provider is implemented. Only the user's own key entered in the assistant can trigger a paid live request. Use the same manual scenarios and grading criteria for all candidate models before changing the product default.
