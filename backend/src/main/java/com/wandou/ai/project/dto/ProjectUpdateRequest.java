package com.wandou.ai.project.dto;

import jakarta.validation.constraints.NotBlank;

public record ProjectUpdateRequest(
        @NotBlank(message = "name is required")
        String name
) {
}
