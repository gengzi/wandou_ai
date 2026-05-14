package com.wandou.ai.conversation.dto;

import java.time.Instant;

public record MessageResponse(
        String id,
        String conversationId,
        String role,
        String sender,
        String content,
        Instant createdAt
) {
}
