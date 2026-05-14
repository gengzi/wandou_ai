package com.wandou.ai.conversation;

import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.conversation.dto.ConversationResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @GetMapping("/{conversationId}")
    public ApiResponse<ConversationResponse> detail(@PathVariable String conversationId) {
        return conversationService.get(conversationId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("conversation not found"));
    }
}
