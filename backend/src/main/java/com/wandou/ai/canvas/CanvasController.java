package com.wandou.ai.canvas;

import com.wandou.ai.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/canvas")
public class CanvasController {

    @GetMapping("/{canvasId}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String canvasId) {
        return ApiResponse.ok(Map.of(
                "id", canvasId,
                "nodes", List.of(
                        Map.of(
                                "id", "script-1",
                                "type", "script",
                                "position", Map.of("x", 100, "y", 100),
                                "data", Map.of("title", "智能剧本生成", "status", "idle")
                        ),
                        Map.of(
                                "id", "char-1",
                                "type", "character",
                                "position", Map.of("x", -50, "y", 400),
                                "data", Map.of("title", "角色一致性生成", "status", "idle")
                        ),
                        Map.of(
                                "id", "img-1",
                                "type", "images",
                                "position", Map.of("x", 950, "y", 100),
                                "data", Map.of("title", "场景概念图生成", "status", "idle")
                        ),
                        Map.of(
                                "id", "audio-1",
                                "type", "audio",
                                "position", Map.of("x", 950, "y", 550),
                                "data", Map.of("title", "生成音效配乐", "status", "idle")
                        )
                ),
                "edges", List.of(
                        Map.of("id", "e-script-char", "source", "script-1", "target", "char-1"),
                        Map.of("id", "e-char-img", "source", "char-1", "target", "img-1"),
                        Map.of("id", "e-script-audio", "source", "script-1", "target", "audio-1")
                )
        ));
    }
}
