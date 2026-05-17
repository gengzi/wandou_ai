package com.wandou.ai.derivative;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.derivative.dto.DerivativeCreateRequest;
import com.wandou.ai.derivative.dto.DerivativeResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/derivatives")
public class DerivativeController {

    private final DerivativeService derivativeService;

    public DerivativeController(DerivativeService derivativeService) {
        this.derivativeService = derivativeService;
    }

    @PostMapping
    @SaCheckPermission("asset:write")
    public ApiResponse<DerivativeResponse> create(@Valid @RequestBody DerivativeCreateRequest request) {
        return ApiResponse.ok(derivativeService.create(StpUtil.getLoginIdAsString(), request));
    }
}
