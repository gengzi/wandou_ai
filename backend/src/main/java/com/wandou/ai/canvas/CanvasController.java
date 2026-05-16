package com.wandou.ai.canvas;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.wandou.ai.canvas.dto.CanvasEdgeCreateRequest;
import com.wandou.ai.canvas.dto.CanvasEdgeResponse;
import com.wandou.ai.canvas.dto.CanvasNodeCreateRequest;
import com.wandou.ai.canvas.dto.CanvasNodeOutputUpdateRequest;
import com.wandou.ai.canvas.dto.CanvasNodePositionUpdateRequest;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;
import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/canvas")
public class CanvasController {

    private final CanvasService canvasService;

    public CanvasController(CanvasService canvasService) {
        this.canvasService = canvasService;
    }

    @GetMapping("/{canvasId}")
    @SaCheckPermission("canvas:read")
    public ApiResponse<CanvasResponse> detail(@PathVariable String canvasId) {
        return canvasService.get(canvasId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("canvas not found"));
    }

    @PatchMapping("/{canvasId}/nodes/{nodeId}/position")
    @SaCheckPermission("canvas:write")
    public ApiResponse<CanvasNodeResponse> updateNodePosition(
            @PathVariable String canvasId,
            @PathVariable String nodeId,
            @Valid @RequestBody CanvasNodePositionUpdateRequest request
    ) {
        return ApiResponse.ok(canvasService.updateNodePosition(canvasId, nodeId, request.position()));
    }

    @PatchMapping("/{canvasId}/nodes/{nodeId}/output")
    @SaCheckPermission("canvas:write")
    public ApiResponse<CanvasNodeResponse> updateNodeOutput(
            @PathVariable String canvasId,
            @PathVariable String nodeId,
            @Valid @RequestBody CanvasNodeOutputUpdateRequest request
    ) {
        return ApiResponse.ok(canvasService.mergeNodeOutput(canvasId, nodeId, request.status(), request.output()));
    }

    @PostMapping("/{canvasId}/nodes")
    @SaCheckPermission("canvas:write")
    public ApiResponse<CanvasNodeResponse> addNode(
            @PathVariable String canvasId,
            @Valid @RequestBody CanvasNodeCreateRequest request
    ) {
        return ApiResponse.ok(canvasService.addNode(
                canvasId,
                request.type(),
                request.title(),
                request.status() == null || request.status().isBlank() ? "idle" : request.status(),
                request.position(),
                request.data()
        ));
    }

    @PostMapping("/{canvasId}/edges")
    @SaCheckPermission("canvas:write")
    public ApiResponse<CanvasEdgeResponse> addEdge(
            @PathVariable String canvasId,
            @Valid @RequestBody CanvasEdgeCreateRequest request
    ) {
        return ApiResponse.ok(canvasService.addEdge(canvasId, request.source(), request.target()));
    }

    @DeleteMapping("/{canvasId}/nodes/{nodeId}")
    @SaCheckPermission("canvas:write")
    public ApiResponse<Void> deleteNode(@PathVariable String canvasId, @PathVariable String nodeId) {
        canvasService.deleteNode(canvasId, nodeId);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{canvasId}/edges/{edgeId}")
    @SaCheckPermission("canvas:write")
    public ApiResponse<Void> deleteEdge(@PathVariable String canvasId, @PathVariable String edgeId) {
        canvasService.deleteEdge(canvasId, edgeId);
        return ApiResponse.ok(null);
    }
}
