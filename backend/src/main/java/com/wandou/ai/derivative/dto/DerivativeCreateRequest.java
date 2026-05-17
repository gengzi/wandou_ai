package com.wandou.ai.derivative.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record DerivativeCreateRequest(
        @NotBlank String sourceAssetId,
        @NotBlank String kind,
        String prompt,
        Map<String, Object> settings
) {
}
