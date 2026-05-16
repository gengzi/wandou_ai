package com.wandou.ai.generation;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.generation.dto.GenerationRequest;
import com.wandou.ai.generation.dto.GenerationResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/generation")
public class GenerationController {

    private final GenerationService generationService;

    public GenerationController(GenerationService generationService) {
        this.generationService = generationService;
    }

    @PostMapping("/chat")
    @SaCheckPermission("agent:run")
    public ApiResponse<GenerationResponse> chat(@Valid @RequestBody GenerationRequest request) {
        return ApiResponse.ok(generationService.chat(StpUtil.getLoginIdAsString(), request));
    }

    @PostMapping("/image")
    @SaCheckPermission("agent:run")
    public ApiResponse<GenerationResponse> image(@Valid @RequestBody GenerationRequest request) {
        return ApiResponse.ok(generationService.image(StpUtil.getLoginIdAsString(), request));
    }

    @PostMapping("/video")
    @SaCheckPermission("agent:run")
    public ApiResponse<GenerationResponse> video(@Valid @RequestBody GenerationRequest request) {
        return ApiResponse.ok(generationService.video(StpUtil.getLoginIdAsString(), request));
    }
}
