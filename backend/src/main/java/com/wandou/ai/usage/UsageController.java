package com.wandou.ai.usage;

import cn.dev33.satoken.stp.StpUtil;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.usage.dto.ModelUsageRecordResponse;
import com.wandou.ai.usage.dto.UsageSummaryResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/usage")
public class UsageController {
    private final ModelUsageService modelUsageService;

    public UsageController(ModelUsageService modelUsageService) {
        this.modelUsageService = modelUsageService;
    }

    @GetMapping("/me")
    public ApiResponse<UsageSummaryResponse> me() {
        return ApiResponse.ok(modelUsageService.summary(StpUtil.getLoginIdAsString()));
    }

    @GetMapping("/me/records")
    public ApiResponse<List<ModelUsageRecordResponse>> records(@RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.ok(modelUsageService.records(StpUtil.getLoginIdAsString(), limit));
    }
}
