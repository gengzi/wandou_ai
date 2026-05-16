package com.wandou.ai.modelconfig.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ModelConfigRequest(
        @NotBlank @Pattern(regexp = "text|image|video|audio") String capability,
        @NotBlank @Size(max = 64) String provider,
        @NotBlank @Size(max = 120) String displayName,
        @NotBlank @Size(max = 500) String baseUrl,
        @NotBlank @Size(max = 160) String modelName,
        @Pattern(regexp = "openai|qwave-task|qingyun-task") String compatibilityMode,
        @Size(max = 1000) String apiKey,
        Boolean enabled
) {
}
