package cn.mathverse.backend.ai.similarity;

import cn.mathverse.backend.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class SimilarityChatService {
    private static final int MAX_TEXT_CONTENT_LENGTH = 30_000;
    private static final int MAX_IMAGE_DATA_URL_LENGTH = 3_000_000;
    private final ObjectMapper objectMapper;

    public SimilarityChatResponse relay(SimilarityChatRequest request) {
        long startedAt = System.nanoTime();
        URI endpoint = SimilarityEndpointPolicy.requireAllowed(request.endpoint());
        validateMessages(request);
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", request.model().trim());
        int maxTokens = resolveUpstreamMaxTokens(endpoint, request.taskType(), request.lowLatency(), request.reasoningLevel(),
                request.maxTokens(), request.generationBudgetMode());
        if (isKimiK3(endpoint, request.model())) {
            body.put("max_completion_tokens", maxTokens);
        } else {
            body.put("temperature", 0);
            body.put("max_tokens", maxTokens);
        }
        body.set("messages", objectMapper.valueToTree(request.messages()));
        if (request.jsonMode()) {
            body.set("response_format", objectMapper.createObjectNode().put("type", "json_object"));
        }
        applyProviderReasoning(body, endpoint, request.model(), request.reasoningLevel(), request.lowLatency());

        HttpRequest upstream = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(request.timeoutSeconds()))
                .header("Authorization", "Bearer " + request.apiKey().trim())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();

        try {
            HttpResponse<String> response = HttpClientHolder.CLIENT.send(upstream, HttpResponse.BodyHandlers.ofString());
            JsonNode responseBody = parseResponseBody(response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String message = responseBody.path("error").path("message").asText();
                if (message.isBlank()) message = "模型服务请求失败（HTTP " + response.statusCode() + "）";
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_UPSTREAM_ERROR", limit(message, 300));
            }

            String content = requireFinalContent(responseBody);
            JsonNode usageNode = responseBody.path("usage");
            long promptTokens = usageNode.path("prompt_tokens").asLong(usageNode.path("input_tokens").asLong(0));
            long completionTokens = usageNode.path("completion_tokens").asLong(usageNode.path("output_tokens").asLong(0));
            long totalTokens = usageNode.path("total_tokens").asLong(promptTokens + completionTokens);
            SimilarityChatResponse.Usage usage = usageNode.isMissingNode() || usageNode.isNull()
                    ? null
                    : new SimilarityChatResponse.Usage(promptTokens, completionTokens, totalTokens);
            String providerRequestId = response.headers().firstValue("x-request-id")
                    .or(() -> response.headers().firstValue("x-dashscope-request-id"))
                    .or(() -> response.headers().firstValue("request-id"))
                    .orElse("");
            long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
            return new SimilarityChatResponse(
                    content,
                    responseBody.path("model").asText(request.model()),
                    usage,
                    providerRequestId,
                    elapsedMs
            );
        } catch (java.net.http.HttpTimeoutException ex) {
            throw new BusinessException(HttpStatus.GATEWAY_TIMEOUT, "AI_UPSTREAM_TIMEOUT", "模型服务响应超时");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROXY_INTERRUPTED", "模型代理请求已中断");
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_UPSTREAM_UNREACHABLE", "Mathverse 后端无法连接模型服务");
        }
    }

    private JsonNode parseResponseBody(String rawBody) {
        try {
            return objectMapper.readTree(rawBody);
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_RESPONSE_INVALID", "模型服务返回了无法解析的内容");
        }
    }

    static int resolveUpstreamMaxTokens(URI endpoint, String taskType, boolean lowLatency, int maxTokens) {
        return resolveUpstreamMaxTokens(endpoint, taskType, lowLatency, null, maxTokens);
    }

    static int resolveUpstreamMaxTokens(URI endpoint, String taskType, boolean lowLatency, String reasoningLevel, int maxTokens) {
        return resolveUpstreamMaxTokens(endpoint, taskType, lowLatency, reasoningLevel, maxTokens, "auto");
    }

    static int resolveUpstreamMaxTokens(URI endpoint, String taskType, boolean lowLatency, String reasoningLevel,
                                        int maxTokens, String generationBudgetMode) {
        if ("manual".equals(generationBudgetMode) && taskType != null && taskType.startsWith("assistant-")) {
            if (maxTokens < 256 || maxTokens > 65536) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "AI_BUDGET_INVALID",
                        "手动生成额度必须是 256–65,536 Token");
            }
            return maxTokens;
        }
        if ("connection-test".equals(taskType)
                && (endpoint.getHost().startsWith("api.moonshot.") || endpoint.getHost().startsWith("dashscope."))) {
            return Math.max(maxTokens, 1024);
        }
        if (taskType == null || !taskType.startsWith("assistant-")) return maxTokens;
        String level = reasoningLevel == null ? (lowLatency ? "quick" : "standard") : reasoningLevel;
        String host = endpoint.getHost().toLowerCase();
        boolean thinkingModel = host.equals("api.deepseek.com") || host.startsWith("api.moonshot.")
                || host.equals("dashscope.aliyuncs.com") || host.equals("dashscope-intl.aliyuncs.com");
        if (!thinkingModel) return maxTokens;
        if (level.equals("deep")) return Math.max(maxTokens, 12000);
        if (level.equals("standard")) return Math.max(maxTokens, host.equals("api.deepseek.com") ? 6000 : 4000);
        if (host.startsWith("api.moonshot.")) return Math.max(maxTokens, 3000);
        return maxTokens;
    }

    static void applyProviderReasoning(ObjectNode body, URI endpoint, String model, String reasoningLevel, boolean lowLatency) {
        String level = reasoningLevel == null ? (lowLatency ? "quick" : "standard") : reasoningLevel;
        String host = endpoint.getHost().toLowerCase();
        if (host.equals("api.deepseek.com")) {
            if (level.equals("quick")) body.set("thinking", body.objectNode().put("type", "disabled"));
            else body.put("reasoning_effort", level.equals("deep") ? "max" : "high");
        } else if ((host.equals("dashscope.aliyuncs.com") || host.equals("dashscope-intl.aliyuncs.com"))
                && model.matches("qwen3\\.8-(max|flash)(-.+)?")) {
            body.put("reasoning_effort", switch (level) {
                case "quick" -> "low";
                case "deep" -> "xhigh";
                default -> "medium";
            });
        } else if (isKimiK3(endpoint, model)) {
            body.put("reasoning_effort", switch (level) {
                case "quick" -> "low";
                case "deep" -> "max";
                default -> "high";
            });
        }
    }

    private static boolean isKimiK3(URI endpoint, String model) {
        return endpoint.getHost().toLowerCase().startsWith("api.moonshot.") && "kimi-k3".equals(model);
    }

    static String requireFinalContent(JsonNode responseBody) {
        JsonNode choice = responseBody.path("choices").path(0);
        String finishReason = choice.path("finish_reason").asText();
        if ("length".equals(finishReason)) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_RESPONSE_TRUNCATED",
                    "模型达到本次生成额度上限，未能完成答案。请调高生成额度后重试");
        }
        if ("content_filter".equals(finishReason)) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_RESPONSE_FILTERED",
                    "模型服务过滤了本次输出，请调整问题后重试");
        }
        JsonNode message = choice.path("message");
        JsonNode content = message.path("content");
        if (content.isTextual() && !content.asText().isBlank()) return content.asText();
        JsonNode reasoning = message.path("reasoning_content");
        if (reasoning.isTextual() && !reasoning.asText().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_RESPONSE_NO_FINAL",
                    "模型只生成了思考过程，尚未生成可展示的答案。可调高生成额度后重试；若仍发生，请检查模型响应格式");
        }
        throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_RESPONSE_INVALID",
                "模型服务未返回可展示的答案，请检查模型设置后重试");
    }

    private String limit(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private void validateMessages(SimilarityChatRequest request) {
        for (SimilarityChatRequest.ChatMessage message : request.messages()) {
            JsonNode content = message.content();
            if (content.isTextual()) {
                requireValidText(content.asText());
                continue;
            }
            if (!"user".equals(message.role()) || !content.isArray() || content.isEmpty() || content.size() > 4) {
                throw invalidMultimodalContent();
            }
            for (JsonNode part : content) {
                String type = part.path("type").asText();
                if ("text".equals(type)) {
                    requireValidText(part.path("text").asText());
                } else if ("image_url".equals(type)) {
                    requireValidImage(part.path("image_url").path("url").asText());
                } else {
                    throw invalidMultimodalContent();
                }
            }
        }
    }

    private void requireValidText(String text) {
        if (text.isBlank() || text.length() > MAX_TEXT_CONTENT_LENGTH) {
            throw invalidMultimodalContent();
        }
    }

    private void requireValidImage(String dataUrl) {
        boolean supportedType = dataUrl.startsWith("data:image/jpeg;base64,")
                || dataUrl.startsWith("data:image/png;base64,")
                || dataUrl.startsWith("data:image/webp;base64,");
        if (!supportedType || dataUrl.length() > MAX_IMAGE_DATA_URL_LENGTH) {
            throw invalidMultimodalContent();
        }
    }

    private BusinessException invalidMultimodalContent() {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "AI_MESSAGE_INVALID",
                "模型消息格式不正确；图片仅支持受限大小的 JPG、PNG 或 WebP 上传数据"
        );
    }

    private static final class HttpClientHolder {
        private static final HttpClient CLIENT = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        private HttpClientHolder() {
        }
    }
}
