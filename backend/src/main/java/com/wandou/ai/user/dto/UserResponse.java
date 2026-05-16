package com.wandou.ai.user.dto;

import java.time.Instant;
import java.util.List;

public record UserResponse(
        String id,
        String name,
        String email,
        List<String> roles,
        List<String> permissions,
        String status,
        long usedCredits,
        long remainingCredits,
        Instant createdAt,
        Instant lastLoginAt
) {
}
