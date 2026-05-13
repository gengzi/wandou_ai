package com.wandou.ai.project.dto;

import jakarta.validation.constraints.NotBlank;

public record ProjectCreateRequest(
        @NotBlank(message = "name is required")
        String name,
        String description,
        String aspectRatio
) {
}
