package com.wandou.ai.security;

import cn.dev33.satoken.stp.StpUtil;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.security.dto.LoginRequest;
import com.wandou.ai.security.dto.LoginResponse;
import com.wandou.ai.user.UserService;
import com.wandou.ai.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return userService.authenticate(request.email(), request.password())
                .map(user -> {
                    StpUtil.login(user.id());
                    return ApiResponse.ok(new LoginResponse(
                            StpUtil.getTokenName(),
                            StpUtil.getTokenValue(),
                            "Bearer",
                            userService.toResponse(user)
                    ));
                })
                .orElseGet(() -> ApiResponse.fail("invalid email or password"));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        StpUtil.logout();
        return ApiResponse.ok(null);
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me() {
        String userId = StpUtil.getLoginIdAsString();
        return userService.findById(userId)
                .map(userService::toResponse)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("user not found"));
    }
}
