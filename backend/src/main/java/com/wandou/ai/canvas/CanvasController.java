package com.wandou.ai.canvas;

import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/canvas")
public class CanvasController {

    private final CanvasService canvasService;

    public CanvasController(CanvasService canvasService) {
        this.canvasService = canvasService;
    }

    @GetMapping("/{canvasId}")
    public ApiResponse<CanvasResponse> detail(@PathVariable String canvasId) {
        return canvasService.get(canvasId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("canvas not found"));
    }
}
