package com.wandou.ai.project.dto;

public record ProjectCreateRequest(
        String name,
        String description,
        String aspectRatio,
        String prompt
) {
}
