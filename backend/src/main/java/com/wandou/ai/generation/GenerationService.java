package com.wandou.ai.generation;

import com.wandou.ai.agent.llm.TextModelCompletion;
import com.wandou.ai.agent.llm.TextModelService;
import com.wandou.ai.agent.video.VideoGenerationProvider;
import com.wandou.ai.agent.video.VideoGenerationRequest;
import com.wandou.ai.agent.video.VideoGenerationStatus;
import com.wandou.ai.asset.AssetService;
import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;
import com.wandou.ai.canvas.dto.PositionResponse;
import com.wandou.ai.conversation.ConversationService;
import com.wandou.ai.generation.dto.GenerationRequest;
import com.wandou.ai.generation.dto.GenerationResponse;
import com.wandou.ai.usage.ModelUsageContext;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GenerationService {

    private static final Pattern PROVIDER_MESSAGE_PATTERN = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]+)\"");

    private final TextModelService textModelService;
    private final ImageGenerationService imageGenerationService;
    private final ConversationService conversationService;
    private final CanvasService canvasService;
    private final AssetService assetService;
    private final VideoGenerationProvider videoGenerationProvider;

    public GenerationService(
            TextModelService textModelService,
            ImageGenerationService imageGenerationService,
            ConversationService conversationService,
            CanvasService canvasService,
            AssetService assetService,
            VideoGenerationProvider videoGenerationProvider
    ) {
        this.textModelService = textModelService;
        this.imageGenerationService = imageGenerationService;
        this.conversationService = conversationService;
        this.canvasService = canvasService;
        this.assetService = assetService;
        this.videoGenerationProvider = videoGenerationProvider;
    }

    public GenerationResponse chat(String userId, GenerationRequest request) {
        addUserMessage(request);
        TextModelCompletion completion = textModelService.generate(
                        userId,
                        "对话助手",
                        "你是 Wandou AI 工作台里的创作助手。自然回答用户，不要启动视频工作流，回答要简洁。",
                        request.prompt(),
                        usageContext(request, null, "direct.chat")
                )
                .orElseThrow(() -> new IllegalStateException("未配置可用的真实文本模型，请先在模型配置里启用 text 模型。"));
        String message = completion.content();
        addAssistantMessage(request, "对话助手", message);
        return new GenerationResponse(
                "chat",
                message,
                null,
                null,
                Map.of(
                        "modelSource", "configured-text-model",
                        "modelProvider", completion.provider(),
                        "modelName", completion.modelName(),
                        "modelDisplayName", completion.displayName()
                )
        );
    }

    public GenerationResponse image(String userId, GenerationRequest request) {
        addUserMessage(request);
        CanvasNodeResponse node = addNode(request, "images", "图片生成", 940, 120);
        try {
            ImageGenerationService.ImageResult image = imageGenerationService.generate(userId, request.prompt(), usageContext(request, node.id(), "direct.image"));
            AssetResponse asset = image.url().isBlank()
                    ? assetService.createStoredAsset(request.projectId(), request.canvasId(), node.id(), "image", "生成图片", image.bytes(), image.contentType(), image.extension())
                    : assetService.create(request.projectId(), request.canvasId(), node.id(), "image", "生成图片", image.url(), image.url());
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("prompt", request.prompt());
            output.put("assetId", asset.id());
            output.put("url", asset.url());
            output.put("thumbnailUrl", asset.thumbnailUrl());
            output.putAll(image.metadata());
            CanvasNodeResponse updatedNode = canvasService.updateNode(request.canvasId(), node.id(), "success", output);
            String message = "图片已生成";
            addAssistantMessage(request, "图片生成", message);
            return new GenerationResponse("image", message, asset, updatedNode, image.metadata());
        } catch (RuntimeException ex) {
            String error = readableError(ex);
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("prompt", request.prompt());
            output.put("imageGenerationStatus", "failed");
            output.put("imageGenerationError", error);
            CanvasNodeResponse failedNode = canvasService.updateNode(request.canvasId(), node.id(), "failed", output);
            String message = "图片生成失败：" + error;
            addAssistantMessage(request, "图片生成", message);
            return new GenerationResponse("image", message, null, failedNode, Map.of(
                    "imageGenerationStatus", "failed",
                    "imageGenerationError", error
            ));
        }
    }

    public GenerationResponse video(String userId, GenerationRequest request) {
        addUserMessage(request);
        CanvasNodeResponse node = addNode(request, "video", "视频生成", 1300, 120);
        try {
            String providerJobId = videoGenerationProvider.submit(new VideoGenerationRequest(
                    userId,
                    "direct",
                    request.projectId(),
                    request.canvasId(),
                    node.id(),
                    request.prompt(),
                    request.prompt(),
                    "8s",
                    "configured-video"
            ));
            VideoGenerationStatus status = waitForVideo(providerJobId);
            if (!"succeeded".equals(status.status())) {
                throw new IllegalStateException(status.error() == null ? status.message() : status.error());
            }
            AssetResponse asset = assetService.createStoredVideo(
                    request.projectId(),
                    request.canvasId(),
                    node.id(),
                    "生成视频",
                    status.videoBytes(),
                    status.videoContentType(),
                    status.thumbnailBytes(),
                    status.thumbnailContentType()
            );
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("prompt", request.prompt());
            output.put("assetId", asset.id());
            output.put("url", asset.url());
            output.put("thumbnailUrl", asset.thumbnailUrl());
            output.put("providerJobId", providerJobId);
            output.put("providerStatus", status.status());
            output.put("modelSource", "video-provider");
            CanvasNodeResponse updatedNode = canvasService.updateNode(request.canvasId(), node.id(), "success", output);
            String message = "视频已生成";
            addAssistantMessage(request, "视频生成", message);
            return new GenerationResponse("video", message, asset, updatedNode, Map.of("providerJobId", providerJobId));
        } catch (RuntimeException ex) {
            String error = readableError(ex);
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("prompt", request.prompt());
            output.put("videoGenerationStatus", "failed");
            output.put("videoGenerationError", error);
            CanvasNodeResponse failedNode = canvasService.updateNode(request.canvasId(), node.id(), "failed", output);
            String message = "视频生成失败：" + error;
            addAssistantMessage(request, "视频生成", message);
            return new GenerationResponse("video", message, null, failedNode, Map.of(
                    "videoGenerationStatus", "failed",
                    "videoGenerationError", error
            ));
        }
    }

    private VideoGenerationStatus waitForVideo(String providerJobId) {
        for (int index = 0; index < 120; index++) {
            VideoGenerationStatus status = videoGenerationProvider.getStatus(providerJobId);
            if (status.terminal()) {
                return status;
            }
            try {
                Thread.sleep(250);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("video generation interrupted");
            }
        }
        throw new IllegalStateException("video generation timed out");
    }

    private String readableError(Throwable ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return ex.getClass().getSimpleName();
        }
        Matcher matcher = PROVIDER_MESSAGE_PATTERN.matcher(message.replace("\\\"", "\""));
        if (matcher.find()) {
            return matcher.group(1);
        }
        return message;
    }

    private CanvasNodeResponse addNode(GenerationRequest request, String type, String title, int x, int y) {
        return canvasService.addNode(request.canvasId(), type, title, "running", new PositionResponse(x, y), Map.of(
                "prompt", request.prompt(),
                "directGeneration", true
        ));
    }

    private ModelUsageContext usageContext(GenerationRequest request, String nodeId, String endpoint) {
        return new ModelUsageContext("direct", request.projectId(), request.canvasId(), nodeId, endpoint);
    }

    private void addUserMessage(GenerationRequest request) {
        if (request.conversationId() != null && !request.conversationId().isBlank()) {
            conversationService.addMessage(request.conversationId(), request.projectId(), "user", "用户", request.prompt());
        }
    }

    private void addAssistantMessage(GenerationRequest request, String sender, String message) {
        if (request.conversationId() != null && !request.conversationId().isBlank()) {
            conversationService.addMessage(request.conversationId(), request.projectId(), "assistant", sender, message);
        }
    }

}
