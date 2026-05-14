package com.wandou.ai.conversation.dto;

import java.time.Instant;
import java.util.List;

public record ConversationResponse(
        String id,
        String projectId,
        List<MessageResponse> messages,
        Instant updatedAt
) {
}
