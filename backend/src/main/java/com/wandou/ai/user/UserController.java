package com.wandou.ai.user;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.user.dto.InviteUserRequest;
import com.wandou.ai.user.dto.UserPageResponse;
import com.wandou.ai.user.dto.UserResponse;
import com.wandou.ai.user.dto.UserSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @SaCheckPermission("user:read")
    public ApiResponse<List<UserResponse>> list() {
        return ApiResponse.ok(userService.list());
    }

    @GetMapping("/summary")
    @SaCheckPermission("user:read")
    public ApiResponse<UserSummaryResponse> summary() {
        return ApiResponse.ok(userService.summary());
    }

    @GetMapping("/page")
    @SaCheckPermission("user:read")
    public ApiResponse<UserPageResponse> page(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ApiResponse.ok(userService.page(keyword, role, status, page, size));
    }

    @PostMapping
    @SaCheckPermission("user:write")
    public ApiResponse<UserResponse> invite(@Valid @RequestBody InviteUserRequest request) {
        return ApiResponse.ok(userService.invite(request));
    }
}
