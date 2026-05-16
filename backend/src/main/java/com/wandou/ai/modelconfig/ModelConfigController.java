package com.wandou.ai.modelconfig;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.modelconfig.dto.ModelConfigRequest;
import com.wandou.ai.modelconfig.dto.ModelConfigResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/model-configs")
public class ModelConfigController {

    private final ModelConfigService service;

    public ModelConfigController(ModelConfigService service) {
        this.service = service;
    }

    @GetMapping
    @SaCheckPermission("model:read")
    public ApiResponse<List<ModelConfigResponse>> list() {
        return ApiResponse.ok(service.list(currentUserId()));
    }

    @PostMapping
    @SaCheckPermission("model:write")
    public ApiResponse<ModelConfigResponse> create(@Valid @RequestBody ModelConfigRequest request) {
        return ApiResponse.ok(service.create(currentUserId(), request));
    }

    @PutMapping("/{id}")
    @SaCheckPermission("model:write")
    public ApiResponse<ModelConfigResponse> update(@PathVariable String id, @Valid @RequestBody ModelConfigRequest request) {
        return ApiResponse.ok(service.update(currentUserId(), id, request));
    }

    @DeleteMapping("/{id}")
    @SaCheckPermission("model:write")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(currentUserId(), id);
        return ApiResponse.ok(null);
    }

    private String currentUserId() {
        return StpUtil.getLoginIdAsString();
    }
}
