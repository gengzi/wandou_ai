package com.wandou.ai.security.dto;

import com.wandou.ai.user.dto.UserResponse;

public record LoginResponse(
        String tokenName,
        String tokenValue,
        String tokenType,
        UserResponse user
) {
}
