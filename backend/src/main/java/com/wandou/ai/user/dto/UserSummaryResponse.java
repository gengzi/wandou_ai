package com.wandou.ai.user.dto;

public record UserSummaryResponse(
        long totalUsers,
        long adminUsers,
        long activeUsers,
        long permissionCount
) {
}
