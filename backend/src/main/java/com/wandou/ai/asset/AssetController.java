package com.wandou.ai.asset;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.wandou.ai.asset.dto.AssetCreateRequest;
import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    @SaCheckPermission("asset:read")
    public ApiResponse<List<AssetResponse>> list(@RequestParam(required = false) String projectId) {
        return ApiResponse.ok(assetService.list(projectId));
    }

    @PostMapping
    @SaCheckPermission("asset:write")
    public ApiResponse<AssetResponse> create(@Valid @RequestBody AssetCreateRequest request) {
        return ApiResponse.ok(assetService.create(request));
    }

    @GetMapping("/{assetId}")
    @SaCheckPermission("asset:read")
    public ApiResponse<AssetResponse> detail(@PathVariable String assetId) {
        return assetService.get(assetId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("asset not found"));
    }

    @GetMapping("/{assetId}/content")
    @SaCheckPermission("asset:read")
    public ResponseEntity<byte[]> content(@PathVariable String assetId) {
        return assetService.loadContent(assetId, false)
                .map(this::toResponse)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{assetId}/thumbnail")
    @SaCheckPermission("asset:read")
    public ResponseEntity<byte[]> thumbnail(@PathVariable String assetId) {
        return assetService.loadContent(assetId, true)
                .map(this::toResponse)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private ResponseEntity<byte[]> toResponse(AssetService.StoredAssetContent content) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(content.filename())
                        .build()
                        .toString())
                .body(content.bytes());
    }
}
