package com.wandou.ai.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record InviteUserRequest(
        @NotBlank String name,
        @Email @NotBlank String email,
        @NotBlank String role
) {
}
