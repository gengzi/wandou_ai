package com.wandou.ai.agent.plan;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class VideoExecutionPlanCompiler {

    public Map<String, Object> compile(String prompt) {
        String goal = clean(prompt);
        return Map.of(
                "version", "video-dag-v1",
                "goal", goal,
                "nodes", List.of(
                        node("script", "script", "ScriptAgent", "text", List.of(), true),
                        node("character", "character", "CharacterAgent", "text", List.of("script"), false),
                        node("storyboard", "storyboard", "StoryboardAgent", "text", List.of("script", "character"), true),
                        node("keyframe", "visual", "PromptAgent", "image", List.of("storyboard", "character"), false),
                        node("audio", "audio", "AudioAgent", "audio", List.of("storyboard"), false),
                        node("video", "video", "RenderWorker", "video", List.of("keyframe", "storyboard"), true),
                        node("quality", "review", "QualityAgent", "vlm", List.of("video", "storyboard"), false),
                        node("export", "export", "Assembler", "video", List.of("video", "audio", "quality"), true)
                ),
                "edges", List.of(
                        edge("script", "character"),
                        edge("script", "storyboard"),
                        edge("character", "storyboard"),
                        edge("storyboard", "keyframe"),
                        edge("character", "keyframe"),
                        edge("storyboard", "audio"),
                        edge("keyframe", "video"),
                        edge("storyboard", "video"),
                        edge("video", "quality"),
                        edge("storyboard", "quality"),
                        edge("video", "export"),
                        edge("audio", "export"),
                        edge("quality", "export")
                ),
                "modelRouting", Map.of(
                        "text", "script/storyboard/edit planning",
                        "image", "keyframe and reference asset generation",
                        "video", "shot rendering and final assembly",
                        "audio", "music, sound effect, and voice design",
                        "vlm", "visual continuity and black-frame checks"
                ),
                "retryPolicy", Map.of(
                        "maxAttempts", 2,
                        "fallback", "switch provider when capability is available; otherwise request manual confirmation"
                ),
                "editPolicy", Map.of(
                        "scope", "rerun changed node and downstream dependent nodes only",
                        "requiresConfirmation", true
                )
        );
    }

    private Map<String, Object> node(
            String id,
            String type,
            String owner,
            String capability,
            List<String> dependsOn,
            boolean confirmationPoint
    ) {
        return Map.of(
                "id", id,
                "type", type,
                "owner", owner,
                "capability", capability,
                "dependsOn", dependsOn,
                "confirmationPoint", confirmationPoint
        );
    }

    private Map<String, String> edge(String source, String target) {
        return Map.of("source", source, "target", target);
    }

    private String clean(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            return "一个结构清晰的 AI 视频";
        }
        return prompt.trim().replaceAll("\\s+", " ");
    }
}
