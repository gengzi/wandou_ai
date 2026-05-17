package com.wandou.ai.derivative;

import com.wandou.ai.asset.AssetService;
import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;
import com.wandou.ai.canvas.dto.PositionResponse;
import com.wandou.ai.derivative.dto.DerivativeCreateRequest;
import com.wandou.ai.derivative.dto.DerivativeResponse;
import com.wandou.ai.generation.ImageGenerationService;
import com.wandou.ai.usage.ModelUsageContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class DerivativeService {

    private final AssetService assetService;
    private final CanvasService canvasService;
    private final ImageGenerationService imageGenerationService;

    public DerivativeService(AssetService assetService, CanvasService canvasService, ImageGenerationService imageGenerationService) {
        this.assetService = assetService;
        this.canvasService = canvasService;
        this.imageGenerationService = imageGenerationService;
    }

    @Transactional
    public DerivativeResponse create(String userId, DerivativeCreateRequest request) {
        AssetResponse source = assetService.get(request.sourceAssetId())
                .orElseThrow(() -> new IllegalArgumentException("源角色素材不存在"));
        String kind = normalizeKind(request.kind());
        if ("model_preview".equals(kind)) {
            return createModelPreview(source, request);
        }
        return createPrintDesign(userId, source, kind, request);
    }

    private DerivativeResponse createPrintDesign(String userId, AssetResponse source, String kind, DerivativeCreateRequest request) {
        ProductSpec spec = productSpec(kind, request.settings());
        CanvasNodeResponse node = createNode(source, spec.nodeType(), spec.title(), "running", Map.of(
                "sourceAssetId", source.id(),
                "sourceNodeId", normalize(source.nodeId()),
                "kind", kind,
                "settings", settings(request),
                "startedAt", Instant.now().toString()
        ));
        String nodeId = node == null ? source.nodeId() : node.id();
        String designPrompt = designPrompt(source, spec, request.prompt());
        String mockupPrompt = mockupPrompt(source, spec, request.prompt());
        List<String> referenceUrls = providerReferenceUrls(source);

        ImageGenerationService.ImageResult artwork = imageGenerationService.generate(
                userId,
                designPrompt,
                referenceUrls,
                new ModelUsageContext(null, source.projectId(), source.canvasId(), nodeId, "derivative.artwork")
        );
        ImageGenerationService.ImageResult mockup = imageGenerationService.generate(
                userId,
                mockupPrompt,
                referenceUrls,
                new ModelUsageContext(null, source.projectId(), source.canvasId(), nodeId, "derivative.mockup")
        );

        Map<String, Object> baseMetadata = metadata(source, kind, spec, request.prompt(), request.settings());
        AssetResponse artworkAsset = assetService.createStoredAsset(
                source.projectId(),
                source.canvasId(),
                nodeId,
                "derivative",
                source.name() + " - " + spec.assetName(),
                artwork.bytes(),
                artwork.contentType(),
                artwork.extension(),
                "derivative_design",
                merge(baseMetadata, Map.of(
                        "role", "artwork",
                        "prompt", designPrompt,
                        "model", artwork.metadata()
                ))
        );
        AssetResponse mockupAsset = assetService.createStoredAsset(
                source.projectId(),
                source.canvasId(),
                nodeId,
                "derivative",
                source.name() + " - " + spec.assetName() + "预览",
                mockup.bytes(),
                mockup.contentType(),
                mockup.extension(),
                "derivative_mockup",
                merge(baseMetadata, Map.of(
                        "role", "mockup",
                        "prompt", mockupPrompt,
                        "model", mockup.metadata()
                ))
        );
        byte[] printPackage = printPackage(spec, artwork, mockup, source, request.prompt());
        AssetResponse printAsset = assetService.createStoredAsset(
                source.projectId(),
                source.canvasId(),
                nodeId,
                "print",
                source.name() + " - " + spec.assetName() + "生产包",
                printPackage,
                "application/zip",
                "zip",
                "print_package",
                merge(baseMetadata, Map.of(
                        "role", "print_package",
                        "files", List.of("artwork.png", "mockup.png", "spec.txt"),
                        "artworkAssetId", artworkAsset.id(),
                        "mockupAssetId", mockupAsset.id()
                ))
        );
        Map<String, Object> output = new java.util.LinkedHashMap<>();
        output.put("sourceAssetId", source.id());
        output.put("sourceNodeId", source.nodeId() == null ? "" : source.nodeId());
        output.put("kind", kind);
        output.put("status", "ready");
        output.put("assetId", artworkAsset.id());
        output.put("mockupAssetId", mockupAsset.id());
        output.put("printAssetId", printAsset.id());
        output.put("url", artworkAsset.url());
        output.put("thumbnailUrl", mockupAsset.url());
        output.put("exportFiles", List.of(printAsset.url()));
        output.put("settings", settings(request));
        output.put("completedAt", Instant.now().toString());
        CanvasNodeResponse completedNode = completeNode(source, node, "success", output);
        return new DerivativeResponse(kind, artworkAsset, mockupAsset, printAsset, completedNode);
    }

    private DerivativeResponse createModelPreview(AssetResponse source, DerivativeCreateRequest request) {
        CanvasNodeResponse node = createNode(source, "model", "3D预览资产", "idle", Map.of(
                "sourceAssetId", source.id(),
                "sourceNodeId", normalize(source.nodeId()),
                "kind", "model_preview",
                "status", "waiting_upload",
                "settings", settings(request),
                "prompt", normalize(request.prompt())
        ));
        String nodeId = node == null ? source.nodeId() : node.id();
        AssetResponse modelAsset = assetService.create(
                source.projectId(),
                source.canvasId(),
                nodeId,
                "model",
                source.name() + " - 3D预览模型",
                "",
                normalize(source.thumbnailUrl()).isBlank() ? normalize(source.url()) : normalize(source.thumbnailUrl()),
                "model_preview",
                metadata(source, "model_preview", productSpec("model_preview", request.settings()), request.prompt(), request.settings())
        );
        CanvasNodeResponse completedNode = completeNode(source, node, "idle", Map.of(
                "sourceAssetId", source.id(),
                "sourceNodeId", normalize(source.nodeId()),
                "kind", "model_preview",
                "status", "waiting_upload",
                "assetId", modelAsset.id(),
                "uploadHint", "上传 GLB/GLTF/OBJ/STL 后即可在素材详情中预览。",
                "settings", settings(request)
        ));
        return new DerivativeResponse("model_preview", modelAsset, null, null, completedNode);
    }

    private CanvasNodeResponse createNode(AssetResponse source, String type, String title, String status, Map<String, Object> data) {
        if (source.canvasId() == null || source.canvasId().isBlank()) {
            return null;
        }
        CanvasNodeResponse node = canvasService.addNode(
                source.canvasId(),
                type,
                title,
                status,
                new PositionResponse(760, 360),
                data
        );
        if (source.nodeId() != null && !source.nodeId().isBlank()) {
            canvasService.addEdge(source.canvasId(), source.nodeId(), node.id());
        }
        return node;
    }

    private CanvasNodeResponse completeNode(AssetResponse source, CanvasNodeResponse node, String status, Map<String, Object> output) {
        if (node == null || source.canvasId() == null || source.canvasId().isBlank()) {
            return node;
        }
        return canvasService.updateNode(source.canvasId(), node.id(), status, output);
    }

    private byte[] printPackage(ProductSpec spec, ImageGenerationService.ImageResult artwork, ImageGenerationService.ImageResult mockup, AssetResponse source, String userPrompt) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
                addZipEntry(zip, "artwork.png", artwork.bytes());
                addZipEntry(zip, "mockup.png", mockup.bytes());
                addZipEntry(zip, "spec.txt", specText(spec, source, userPrompt).getBytes(StandardCharsets.UTF_8));
            }
            return bytes.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("生产包生成失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        }
    }

    private static void addZipEntry(ZipOutputStream zip, String filename, byte[] bytes) throws java.io.IOException {
        zip.putNextEntry(new ZipEntry(filename));
        zip.write(bytes == null ? new byte[0] : bytes);
        zip.closeEntry();
    }

    private String specText(ProductSpec spec, AssetResponse source, String userPrompt) {
        return """
                Wandou AI 衍生品生产说明

                源角色：%s
                源素材 ID：%s
                产品类型：%s
                建议尺寸：%s
                建议工艺：%s
                文件内容：artwork.png（透明底印花/贴纸设计）、mockup.png（商品预览）
                用户补充：%s

                注意：第一版生产包不包含真实矢量文件、3D切片、G-code 或打印机直连配置。
                """.formatted(source.name(), source.id(), spec.assetName(), spec.size(), spec.technique(), normalize(userPrompt)).trim();
    }

    private String designPrompt(AssetResponse source, ProductSpec spec, String userPrompt) {
        return """
                基于指定角色素材创作可生产的%s设计图。
                源角色名称：%s
                源素材 ID：%s
                源素材 URL：%s
                生产要求：透明或纯净背景，主体完整，边缘清晰，适合%s；不要生成商品摄影背景，不要生成水印。
                尺寸建议：%s
                工艺建议：%s
                用户补充：%s
                """.formatted(spec.assetName(), source.name(), source.id(), source.url(), spec.technique(), spec.size(), spec.technique(), normalize(userPrompt)).trim();
    }

    private String mockupPrompt(AssetResponse source, ProductSpec spec, String userPrompt) {
        return """
                基于同一个角色与刚才的%s设计，生成真实商品预览 mockup。
                源角色名称：%s
                源素材 ID：%s
                展示要求：干净深色工作室背景，商品主体清晰，能确认图案位置和比例；不要生成无关文字或水印。
                用户补充：%s
                """.formatted(spec.assetName(), source.name(), source.id(), normalize(userPrompt)).trim();
    }

    private ProductSpec productSpec(String kind, Map<String, Object> settings) {
        return switch (kind) {
            case "sticker_set" -> new ProductSpec(
                    "derivative",
                    "贴纸套装",
                    "贴纸套装",
                    valueOr(setting(settings, "size", "A5 贴纸排版"), "A5 贴纸排版"),
                    valueOr(setting(settings, "technique", "高清不干胶/模切"), "高清不干胶/模切")
            );
            case "model_preview" -> new ProductSpec(
                    "model",
                    "3D预览资产",
                    "3D预览模型",
                    valueOr(setting(settings, "size", "按上传模型单位"), "按上传模型单位"),
                    valueOr(setting(settings, "technique", "GLB/OBJ/STL 预览"), "GLB/OBJ/STL 预览")
            );
            default -> new ProductSpec(
                    "derivative",
                    "短袖印花",
                    "短袖印花",
                    valueOr(setting(settings, "size", "30cm x 40cm"), "30cm x 40cm"),
                    valueOr(setting(settings, "technique", "DTF/DTG 印花"), "DTF/DTG 印花")
            );
        };
    }

    private static String normalizeKind(String kind) {
        String normalized = normalize(kind).toLowerCase(Locale.ROOT);
        if ("sticker_set".equals(normalized) || "model_preview".equals(normalized) || "tshirt_print".equals(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("不支持的衍生品类型：" + kind);
    }

    private static List<String> providerReferenceUrls(AssetResponse source) {
        if (source.url() != null && (source.url().startsWith("http://") || source.url().startsWith("https://"))) {
            return List.of(source.url());
        }
        if (source.thumbnailUrl() != null && (source.thumbnailUrl().startsWith("http://") || source.thumbnailUrl().startsWith("https://"))) {
            return List.of(source.thumbnailUrl());
        }
        return List.of();
    }

    private static Map<String, Object> metadata(AssetResponse source, String kind, ProductSpec spec, String prompt, Map<String, Object> settings) {
        return new java.util.LinkedHashMap<>(Map.of(
                "sourceAssetId", source.id(),
                "sourceNodeId", source.nodeId() == null ? "" : source.nodeId(),
                "sourceAssetName", source.name(),
                "kind", kind,
                "product", spec.assetName(),
                "size", spec.size(),
                "technique", spec.technique(),
                "userPrompt", normalize(prompt),
                "settings", settings == null ? Map.of() : settings
        ));
    }

    private static Map<String, Object> merge(Map<String, Object> base, Map<String, Object> extra) {
        Map<String, Object> next = new java.util.LinkedHashMap<>();
        if (base != null) {
            next.putAll(base);
        }
        if (extra != null) {
            next.putAll(extra);
        }
        return next;
    }

    private static Map<String, Object> settings(DerivativeCreateRequest request) {
        return request.settings() == null ? Map.of() : request.settings();
    }

    private static String setting(Map<String, Object> settings, String key, String fallback) {
        Object value = settings == null ? null : settings.get(key);
        return value == null ? fallback : value.toString();
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private record ProductSpec(String nodeType, String title, String assetName, String size, String technique) {
    }
}
