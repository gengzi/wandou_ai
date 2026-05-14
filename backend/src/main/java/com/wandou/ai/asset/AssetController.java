package com.wandou.ai.asset;

import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    @GetMapping
    public ApiResponse<List<AssetResponse>> list(@RequestParam(required = false) String projectId) {
        return ApiResponse.ok(assetService.list(projectId));
    }

    @GetMapping("/{assetId}")
    public ApiResponse<AssetResponse> detail(@PathVariable String assetId) {
        return assetService.get(assetId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("asset not found"));
    }
}
