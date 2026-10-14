package cn.mathverse.backend.ai.similarity;

import cn.mathverse.backend.common.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SimilarityChatServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void deepSeekStandardAssistantHasReasoningRoomButQuickModeKeepsItsLimit() {
        URI endpoint = URI.create("https://api.deepseek.com/chat/completions");
        assertEquals(6000, SimilarityChatService.resolveUpstreamMaxTokens(endpoint, "assistant-diagnose", false, 1400));
        assertEquals(12000, SimilarityChatService.resolveUpstreamMaxTokens(endpoint, "assistant-hint", false, "deep", 500));
        assertEquals(500, SimilarityChatService.resolveUpstreamMaxTokens(endpoint, "assistant-hint", true, 500));
        assertEquals(900, SimilarityChatService.resolveUpstreamMaxTokens(endpoint, "similarity", false, 900));
        assertEquals(1024, SimilarityChatService.resolveUpstreamMaxTokens(
                URI.create("https://api.moonshot.ai/v1/chat/completions"), "connection-test", true, 12));
    }

    @Test
    void manualAssistantGenerationBudgetIsNotCappedOrRaisedByProviderDefaults() {
        for (URI endpoint : new URI[] {
                URI.create("https://api.deepseek.com/chat/completions"),
                URI.create("https://api.openai.com/v1/chat/completions")
        }) {
            assertEquals(32768, SimilarityChatService.resolveUpstreamMaxTokens(
                    endpoint, "assistant-hint", false, "deep", 32768, "manual"));
            assertEquals(8192, SimilarityChatService.resolveUpstreamMaxTokens(
                    endpoint, "assistant-hint", false, "deep", 8192, "manual"));
        }
        BusinessException invalid = assertThrows(BusinessException.class, () ->
                SimilarityChatService.resolveUpstreamMaxTokens(
                        URI.create("https://api.deepseek.com/chat/completions"),
                        "assistant-hint", false, "deep", 65537, "manual"));
        assertEquals("AI_BUDGET_INVALID", invalid.getCode());
    }

    @Test
    void providerReasoningIsModelSpecific() {
        var deepSeek = mapper.createObjectNode();
        SimilarityChatService.applyProviderReasoning(deepSeek, URI.create("https://api.deepseek.com/chat/completions"),
                "deepseek-v4-pro", "deep", false);
        assertEquals("max", deepSeek.path("reasoning_effort").asText());

        var qwen = mapper.createObjectNode();
        SimilarityChatService.applyProviderReasoning(qwen, URI.create("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
                "qwen3.8-max", "standard", false);
        assertEquals("medium", qwen.path("reasoning_effort").asText());

        var kimi = mapper.createObjectNode();
        SimilarityChatService.applyProviderReasoning(kimi, URI.create("https://api.moonshot.ai/v1/chat/completions"),
                "kimi-k3", "quick", true);
        assertEquals("low", kimi.path("reasoning_effort").asText());
    }

    @Test
    void neverDisplaysReasoningOnlyOrTruncatedContent() throws Exception {
        assertEquals("最终答案", SimilarityChatService.requireFinalContent(mapper.readTree(
                "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"最终答案\",\"reasoning_content\":\"private\"}}]}")));
        BusinessException truncated = assertThrows(BusinessException.class, () ->
                SimilarityChatService.requireFinalContent(mapper.readTree(
                        "{\"choices\":[{\"finish_reason\":\"length\",\"message\":{\"content\":\"未完成\"}}]}")));
        assertEquals("AI_RESPONSE_TRUNCATED", truncated.getCode());
        assertTrue(truncated.getMessage().contains("调高生成额度"));
        BusinessException reasoningOnly = assertThrows(BusinessException.class, () ->
                SimilarityChatService.requireFinalContent(mapper.readTree(
                        "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":null,\"reasoning_content\":\"private\"}}]}")));
        assertTrue(reasoningOnly.getMessage().contains("思考过程"));
    }
}
