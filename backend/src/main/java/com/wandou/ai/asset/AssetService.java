package com.wandou.ai.asset;

import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.asset.dto.AssetCreateRequest;
import com.wandou.ai.asset.dto.AssetImportResponse;
import com.wandou.ai.asset.dto.AssetPageResponse;
import com.wandou.ai.asset.dto.AssetUpdateRequest;
import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.storage.StoredObject;
import com.wandou.ai.storage.StoredObjectMetadata;
import com.wandou.ai.storage.VideoStorageService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class AssetService {

    private final AssetRepository assetRepository;
    private final VideoStorageService videoStorageService;
    private final RestClient.Builder restClientBuilder;
    private final AssetParseService assetParseService;
    private final ObjectMapper objectMapper;

    public AssetService(
            AssetRepository assetRepository,
            VideoStorageService videoStorageService,
            RestClient.Builder restClientBuilder,
            AssetParseService assetParseService,
            ObjectMapper objectMapper
    ) {
        this.assetRepository = assetRepository;
        this.videoStorageService = videoStorageService;
        this.restClientBuilder = restClientBuilder;
        this.assetParseService = assetParseService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AssetResponse create(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            String url,
            String thumbnailUrl
    ) {
        return create(projectId, canvasId, nodeId, type, name, url, thumbnailUrl, null);
    }

    @Transactional
    public AssetResponse create(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            String url,
            String thumbnailUrl,
            String purpose
    ) {
        return create(projectId, canvasId, nodeId, type, name, url, thumbnailUrl, purpose, Map.of());
    }

    @Transactional
    public AssetResponse create(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            String url,
            String thumbnailUrl,
            String purpose,
            Map<String, Object> metadata
    ) {
        String safeType = safeAssetType(type);
        String safePurpose = resolvePurpose(purpose, safeType, name, null);
        String assetId = IdGenerator.id("asset_" + safeType + "_");
        AssetEntity asset = new AssetEntity(
                assetId,
                normalize(projectId),
                normalize(canvasId),
                normalize(nodeId),
                safeType,
                normalize(name),
                normalize(url),
                normalize(thumbnailUrl),
                null,
                null,
                null,
                null,
                null,
                "ready",
                Instant.now()
        );
        asset.updateAttachmentContext(safePurpose, "script_source".equals(safePurpose) ? "pending" : "not_required", null, null, null, metadataJson(name, null, null, metadata));
        return toResponse(assetRepository.save(asset));
    }

    @Transactional
    public AssetResponse createStoredVideo(
            String projectId,
            String canvasId,
            String nodeId,
            String name,
            byte[] videoBytes,
            String videoContentType,
            byte[] thumbnailBytes,
            String thumbnailContentType
    ) {
        String assetId = IdGenerator.id("asset_video_");
        String prefix = "projects/" + normalize(projectId) + "/assets/" + assetId;
        StoredObjectMetadata video = videoStorageService.save(prefix + "/video.mp4", videoContentType, videoBytes);
        StoredObjectMetadata thumbnail = thumbnailBytes == null || thumbnailBytes.length == 0
                ? null
                : videoStorageService.save(prefix + "/thumbnail.png", thumbnailContentType, thumbnailBytes);
        AssetEntity asset = new AssetEntity(
                assetId,
                normalize(projectId),
                normalize(canvasId),
                normalize(nodeId),
                "video",
                normalize(name),
                contentUrl(assetId),
                thumbnail == null ? "" : thumbnailUrl(assetId),
                video.objectKey(),
                thumbnail == null ? null : thumbnail.objectKey(),
                video.contentType(),
                thumbnail == null ? null : thumbnail.contentType(),
                video.size(),
                "ready",
                Instant.now()
        );
        asset.updateAttachmentContext("library_asset", "not_required", null, null, null, metadataJson(name, videoContentType, (long) videoBytes.length));
        return toResponse(assetRepository.save(asset));
    }

    @Transactional
    public AssetResponse createStoredAsset(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            byte[] bytes,
            String contentType,
            String extension
    ) {
        return createStoredAsset(projectId, canvasId, nodeId, type, name, bytes, contentType, extension, null);
    }

    @Transactional
    public AssetResponse createStoredAsset(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            byte[] bytes,
            String contentType,
            String extension,
            String purpose
    ) {
        return createStoredAsset(projectId, canvasId, nodeId, type, name, bytes, contentType, extension, purpose, Map.of());
    }

    @Transactional
    public AssetResponse createStoredAsset(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            byte[] bytes,
            String contentType,
            String extension,
            String purpose,
            Map<String, Object> metadata
    ) {
        String safeType = safeAssetType(type);
        String safePurpose = resolvePurpose(purpose, safeType, name, contentType);
        String assetId = IdGenerator.id("asset_" + safeType + "_");
        String safeExtension = extension == null || extension.isBlank() ? "bin" : extension.replaceAll("^\\.+", "");
        String prefix = "projects/" + normalize(projectId) + "/assets/" + assetId;
        StoredObjectMetadata object = videoStorageService.save(prefix + "/content." + safeExtension, contentType, bytes);
        AssetEntity asset = new AssetEntity(
                assetId,
                normalize(projectId),
                normalize(canvasId),
                normalize(nodeId),
                safeType,
                normalize(name),
                contentUrl(assetId),
                contentUrl(assetId),
                object.objectKey(),
                object.objectKey(),
                object.contentType(),
                object.contentType(),
                object.size(),
                "ready",
                Instant.now()
        );
        applyParseResult(asset, assetParseService.parse(name, contentType, safePurpose, bytes), safePurpose, name, contentType, bytes == null ? null : (long) bytes.length, metadata);
        return toResponse(assetRepository.save(asset));
    }

    @Transactional
    public AssetResponse upload(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            String purpose,
            MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("上传文件不能为空");
        }
        String contentType = file.getContentType() == null || file.getContentType().isBlank()
                ? "application/octet-stream"
                : file.getContentType();
        String safeType = normalize(type).isBlank() ? typeFromContentType(contentType) : safeAssetType(type);
        String originalName = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
                ? safeType + "-asset"
                : file.getOriginalFilename();
        String assetName = normalize(name).isBlank() ? originalName : normalize(name);
        try {
            return createStoredAsset(
                    normalize(projectId),
                    normalize(canvasId),
                    normalize(nodeId),
                    safeType,
                    assetName,
                    file.getBytes(),
                    contentType,
                    extension(originalName, contentType),
                    resolvePurpose(purpose, safeType, originalName, contentType)
            );
        } catch (IOException error) {
            throw new IllegalStateException("读取上传文件失败", error);
        }
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> list(String projectId) {
        List<AssetEntity> assets = projectId == null || projectId.isBlank()
                ? assetRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                : assetRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        return assets.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AssetPageResponse page(String projectId, String type, String keyword, int page, int size, String sort) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Sort.Direction direction = "asc".equalsIgnoreCase(normalize(sort)) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Page<AssetEntity> result = assetRepository.search(
                normalize(projectId),
                normalize(type),
                normalize(keyword),
                PageRequest.of(safePage, safeSize, Sort.by(direction, "createdAt"))
        );
        return new AssetPageResponse(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.getNumber(),
                result.getSize()
        );
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> listReferenceImages(String projectId, int limit) {
        int safeLimit = limit <= 0 ? 6 : limit;
        return assetRepository.findByProjectIdAndPurposeOrderByCreatedAtDesc(normalize(projectId), "reference_image").stream()
                .limit(safeLimit)
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AttachmentContext attachmentContext(String projectId, List<String> attachmentIds, int referenceImageLimit) {
        List<AssetEntity> candidates = selectedAttachmentEntities(projectId, attachmentIds);
        Optional<AssetEntity> script = candidates.stream()
                .filter(asset -> "script_source".equals(asset.purpose()))
                .filter(asset -> "parsed".equals(asset.parseStatus()))
                .findFirst();
        List<AssetResponse> referenceImages = candidates.stream()
                .filter(asset -> "reference_image".equals(asset.purpose()))
                .limit(referenceImageLimit <= 0 ? 6 : referenceImageLimit)
                .map(this::toResponse)
                .toList();
        List<AssetResponse> failedScripts = candidates.stream()
                .filter(asset -> "script_source".equals(asset.purpose()))
                .filter(asset -> "failed".equals(asset.parseStatus()))
                .map(this::toResponse)
                .toList();
        return new AttachmentContext(
                script.map(AssetEntity::id).orElse(""),
                script.map(AssetEntity::name).orElse(""),
                script.map(AssetEntity::parsedText).orElse(""),
                script.map(AssetEntity::parsedSummary).orElse(""),
                referenceImages,
                failedScripts
        );
    }

    @Transactional
    public AssetResponse create(AssetCreateRequest request) {
        return create(
                normalize(request.projectId()),
                normalize(request.canvasId()),
                normalize(request.nodeId()),
                request.type(),
                request.name(),
                request.url(),
                request.thumbnailUrl() == null || request.thumbnailUrl().isBlank() ? request.url() : request.thumbnailUrl(),
                request.purpose()
        );
    }

    @Transactional(readOnly = true)
    public Optional<AssetResponse> get(String assetId) {
        return assetRepository.findById(assetId).map(this::toResponse);
    }

    @Transactional
    public Optional<AssetResponse> update(String assetId, AssetUpdateRequest request) {
        return assetRepository.findById(assetId)
                .map(asset -> {
                    String thumbnailUrl = request.thumbnailUrl() == null || request.thumbnailUrl().isBlank()
                            ? request.url()
                            : request.thumbnailUrl();
                    String resolvedPurpose = resolvePurpose(request.purpose(), request.type(), request.name(), asset.contentType());
                    asset.updateDetails(
                            normalize(request.projectId()),
                            normalize(request.canvasId()),
                            normalize(request.nodeId()),
                            safeAssetType(request.type()),
                            normalize(request.name()),
                            normalize(request.url()),
                            normalize(thumbnailUrl),
                            resolvedPurpose
                    );
                    refreshAttachmentContext(asset, resolvedPurpose);
                    return toResponse(assetRepository.save(asset));
                });
    }

    @Transactional
    public boolean delete(String assetId) {
        if (!assetRepository.existsById(assetId)) {
            return false;
        }
        assetRepository.deleteById(assetId);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<StoredAssetContent> loadContent(String assetId, boolean thumbnail) {
        return assetRepository.findById(assetId)
                .flatMap(asset -> {
                    String objectKey = thumbnail ? asset.thumbnailObjectKey() : asset.objectKey();
                    if (objectKey == null || objectKey.isBlank()) {
                        return Optional.empty();
                    }
                    StoredObject object = videoStorageService.load(objectKey);
                    String contentType = thumbnail ? asset.thumbnailContentType() : asset.contentType();
                    return Optional.of(new StoredAssetContent(
                            object.bytes(),
                            contentType == null || contentType.isBlank() ? object.contentType() : contentType,
                            thumbnail ? asset.name() + "-thumbnail" : asset.name()
                    ));
                });
    }

    @Transactional
    public AssetImportResponse importExternalAssets(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<AssetEntity> assets = assetRepository.findExternalOnlyAssets(PageRequest.of(0, safeLimit));
        List<AssetImportResponse.AssetImportResult> results = new ArrayList<>();
        int imported = 0;
        int failed = 0;
        for (AssetEntity asset : assets) {
            try {
                DownloadedAsset downloaded = download(asset.url());
                String extension = extensionFromUrl(asset.url(), downloaded.contentType());
                String objectKey = "projects/" + normalize(asset.projectId()) + "/assets/" + asset.id() + "/imported." + extension;
                StoredObjectMetadata object = videoStorageService.save(objectKey, downloaded.contentType(), downloaded.bytes());
                String internalUrl = contentUrl(asset.id());
                assetRepository.markStored(
                        asset.id(),
                        internalUrl,
                        internalUrl,
                        object.objectKey(),
                        object.objectKey(),
                        object.contentType(),
                        object.contentType(),
                        object.size(),
                        "ready"
                );
                imported++;
                results.add(new AssetImportResponse.AssetImportResult(asset.id(), asset.name(), "imported", "已写入对象存储", internalUrl));
            } catch (RuntimeException ex) {
                failed++;
                assetRepository.markStatus(asset.id(), "external_import_failed");
                results.add(new AssetImportResponse.AssetImportResult(
                        asset.id(),
                        asset.name(),
                        "failed",
                        ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage(),
                        asset.url()
                ));
            }
        }
        return new AssetImportResponse(assets.size(), imported, failed, results);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private List<AssetEntity> selectedAttachmentEntities(String projectId, List<String> attachmentIds) {
        if (attachmentIds != null && !attachmentIds.isEmpty()) {
            Set<String> selectedIds = new java.util.LinkedHashSet<>(attachmentIds.stream()
                    .filter(id -> id != null && !id.isBlank())
                    .map(String::trim)
                    .toList());
            if (selectedIds.isEmpty()) {
                return List.of();
            }
            return assetRepository.findAllById(selectedIds).stream()
                    .filter(asset -> normalize(projectId).isBlank() || normalize(projectId).equals(asset.projectId()))
                    .sorted(java.util.Comparator.comparing(AssetEntity::createdAt).reversed())
                    .toList();
        }
        return assetRepository.findByProjectIdOrderByCreatedAtDesc(normalize(projectId));
    }

    private void applyParseResult(
            AssetEntity asset,
            AssetParseService.ParseResult result,
            String purpose,
            String filename,
            String contentType,
            Long sizeBytes
    ) {
        asset.updateAttachmentContext(
                purpose,
                result.status(),
                result.text(),
                result.summary(),
                result.error(),
                metadataJson(filename, contentType, sizeBytes)
        );
    }

    private void applyParseResult(
            AssetEntity asset,
            AssetParseService.ParseResult result,
            String purpose,
            String filename,
            String contentType,
            Long sizeBytes,
            Map<String, Object> metadata
    ) {
        asset.updateAttachmentContext(
                purpose,
                result.status(),
                result.text(),
                result.summary(),
                result.error(),
                metadataJson(filename, contentType, sizeBytes, metadata)
        );
    }

    private void refreshAttachmentContext(AssetEntity asset, String purpose) {
        if (!"script_source".equals(purpose)) {
            asset.updateAttachmentContext(
                    purpose,
                    "not_required",
                    null,
                    null,
                    null,
                    metadataJson(asset.name(), asset.contentType(), asset.sizeBytes())
            );
            return;
        }
        if (asset.objectKey() == null || asset.objectKey().isBlank()) {
            asset.updateAttachmentContext(
                    purpose,
                    "failed",
                    null,
                    null,
                    "没有可解析的已存储文件，请重新上传剧本文档",
                    metadataJson(asset.name(), asset.contentType(), asset.sizeBytes())
            );
            return;
        }
        StoredObject object = videoStorageService.load(asset.objectKey());
        String contentType = asset.contentType() == null || asset.contentType().isBlank()
                ? object.contentType()
                : asset.contentType();
        applyParseResult(
                asset,
                assetParseService.parse(asset.name(), contentType, purpose, object.bytes()),
                purpose,
                asset.name(),
                contentType,
                asset.sizeBytes()
        );
    }

    private String resolvePurpose(String requestedPurpose, String type, String filename, String contentType) {
        String normalized = normalize(requestedPurpose)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9_-]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_+|_+$", "");
        if (List.of(
                "reference_image",
                "character_reference",
                "script_source",
                "library_asset",
                "derivative_design",
                "derivative_mockup",
                "model_preview",
                "print_package"
        ).contains(normalized)) {
            return normalized;
        }
        String safeType = safeAssetType(type);
        if ("character".equals(safeType)) {
            return "character_reference";
        }
        if ("derivative".equals(safeType)) {
            return "derivative_design";
        }
        if ("model".equals(safeType)) {
            return "model_preview";
        }
        if ("print".equals(safeType)) {
            return "print_package";
        }
        if ("image".equals(safeType)) {
            return "reference_image";
        }
        if (assetParseService.isSupportedScriptFile(filename, contentType)) {
            return "script_source";
        }
        return "library_asset";
    }

    private String metadataJson(String filename, String contentType, Long sizeBytes) {
        return metadataJson(filename, contentType, sizeBytes, Map.of());
    }

    private String metadataJson(String filename, String contentType, Long sizeBytes, Map<String, Object> metadata) {
        try {
            Map<String, Object> next = new java.util.LinkedHashMap<>();
            if (metadata != null) {
                next.putAll(metadata);
            }
            next.putIfAbsent("filename", normalize(filename));
            next.putIfAbsent("contentType", normalize(contentType));
            next.putIfAbsent("sizeBytes", sizeBytes == null ? 0L : sizeBytes);
            return objectMapper.writeValueAsString(next);
        } catch (Exception ignored) {
            return "{}";
        }
    }

    private String safeAssetType(String type) {
        String normalized = normalize(type)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9_-]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_+|_+$", "");
        return normalized.isBlank() ? "asset" : normalized;
    }

    private String typeFromContentType(String contentType) {
        if (contentType.startsWith("image/")) {
            return "image";
        }
        if (contentType.startsWith("video/")) {
            return "video";
        }
        if (contentType.startsWith("audio/")) {
            return "audio";
        }
        if (assetParseService.isSupportedScriptFile("", contentType)) {
            return "file";
        }
        return "asset";
    }

    private String extension(String filename, String contentType) {
        int dot = filename.lastIndexOf('.');
        if (dot >= 0 && dot + 1 < filename.length()) {
            return filename.substring(dot + 1);
        }
        if ("image/png".equalsIgnoreCase(contentType)) return "png";
        if ("image/jpeg".equalsIgnoreCase(contentType)) return "jpg";
        if ("image/webp".equalsIgnoreCase(contentType)) return "webp";
        if ("video/mp4".equalsIgnoreCase(contentType)) return "mp4";
        return "bin";
    }

    private DownloadedAsset download(String url) {
        ResponseEntity<byte[]> response = restClientBuilder.clone()
                .build()
                .get()
                .uri(URI.create(url))
                .retrieve()
                .toEntity(byte[].class);
        byte[] bytes = response.getBody() == null ? new byte[0] : response.getBody();
        if (bytes.length == 0) {
            throw new IllegalStateException("外链下载结果为空");
        }
        String contentType = response.getHeaders().getContentType() == null
                ? "application/octet-stream"
                : response.getHeaders().getContentType().toString();
        return new DownloadedAsset(bytes, contentType);
    }

    private String extensionFromUrl(String url, String contentType) {
        String normalized = contentType == null ? "" : contentType.toLowerCase();
        if (normalized.contains("png")) return "png";
        if (normalized.contains("jpeg") || normalized.contains("jpg")) return "jpg";
        if (normalized.contains("webp")) return "webp";
        if (normalized.contains("gif")) return "gif";
        if (normalized.contains("mp4")) return "mp4";
        if (normalized.contains("quicktime")) return "mov";
        try {
            String path = URI.create(url).getPath();
            int dot = path.lastIndexOf('.');
            if (dot >= 0 && dot + 1 < path.length()) {
                String extension = path.substring(dot + 1).replaceAll("[^A-Za-z0-9]", "");
                if (!extension.isBlank()) {
                    return extension;
                }
            }
        } catch (IllegalArgumentException ignored) {
        }
        return extension("", contentType);
    }

    private AssetResponse toResponse(AssetEntity asset) {
        return new AssetResponse(
                asset.id(),
                asset.projectId(),
                asset.canvasId(),
                asset.nodeId(),
                asset.type(),
                asset.name(),
                asset.url(),
                asset.thumbnailUrl(),
                valueOrDefault(asset.purpose(), "library_asset"),
                valueOrDefault(asset.parseStatus(), "not_required"),
                asset.parsedSummary(),
                asset.parseError(),
                metadata(asset.metadataJson()),
                asset.createdAt()
        );
    }

    private Map<String, Object> metadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(metadataJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String contentUrl(String assetId) {
        return "/api/assets/" + assetId + "/content";
    }

    private String thumbnailUrl(String assetId) {
        return "/api/assets/" + assetId + "/thumbnail";
    }

    public record StoredAssetContent(
            byte[] bytes,
            String contentType,
            String filename
    ) {
    }

    private record DownloadedAsset(byte[] bytes, String contentType) {
    }

    public record AttachmentContext(
            String scriptAssetId,
            String scriptName,
            String scriptText,
            String scriptSummary,
            List<AssetResponse> referenceImages,
            List<AssetResponse> failedScripts
    ) {
        public boolean hasScript() {
            return scriptText != null && !scriptText.isBlank();
        }
    }
}
