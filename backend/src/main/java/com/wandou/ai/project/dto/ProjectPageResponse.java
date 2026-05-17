package com.wandou.ai.project.dto;

import java.util.List;

public record ProjectPageResponse(
        List<ProjectResponse> content,
        long totalElements,
        int totalPages,
        int page,
        int size
) {
}
