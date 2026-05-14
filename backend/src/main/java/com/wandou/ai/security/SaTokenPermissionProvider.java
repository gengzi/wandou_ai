package com.wandou.ai.security;

import cn.dev33.satoken.stp.StpInterface;
import com.wandou.ai.user.UserService;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SaTokenPermissionProvider implements StpInterface {

    private final UserService userService;

    public SaTokenPermissionProvider(UserService userService) {
        this.userService = userService;
    }

    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        return userService.permissionsOf(String.valueOf(loginId));
    }

    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        return userService.rolesOf(String.valueOf(loginId));
    }
}
