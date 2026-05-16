package com.wandou.ai.user.dto;

import java.util.List;

public record UserPageResponse(
        List<UserResponse> content,
        long totalElements,
        int totalPages,
        int page,
        int size
) {
}
