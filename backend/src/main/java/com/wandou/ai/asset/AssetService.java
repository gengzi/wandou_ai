package com.wandou.ai.asset;

import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.asset.dto.AssetCreateRequest;
import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.storage.StoredObject;
import com.wandou.ai.storage.StoredObjectMetadata;
import com.wandou.ai.storage.VideoStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class AssetService {

    private final AssetRepository assetRepository;
    private final VideoStorageService videoStorageService;

    public AssetService(AssetRepository assetRepository, VideoStorageService videoStorageService) {
        this.assetRepository = assetRepository;
        this.videoStorageService = videoStorageService;
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
        String assetId = IdGenerator.id("asset_" + type + "_");
        AssetEntity asset = new AssetEntity(
                assetId,
                projectId,
                canvasId,
                nodeId,
                type,
                name,
                url,
                thumbnailUrl,
                null,
                null,
                null,
                null,
                null,
                "ready",
                Instant.now()
        );
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
                name,
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
        String safeType = normalize(type).isBlank() ? "asset" : normalize(type);
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
                name,
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
        return toResponse(assetRepository.save(asset));
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> list(String projectId) {
        List<AssetEntity> assets = projectId == null || projectId.isBlank()
                ? assetRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))
                : assetRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        return assets.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> listReferenceImages(String projectId, int limit) {
        int safeLimit = limit <= 0 ? 6 : limit;
        return list(projectId).stream()
                .filter(asset -> "image".equalsIgnoreCase(asset.type()))
                .limit(safeLimit)
                .toList();
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
                request.thumbnailUrl() == null || request.thumbnailUrl().isBlank() ? request.url() : request.thumbnailUrl()
        );
    }

    @Transactional(readOnly = true)
    public Optional<AssetResponse> get(String assetId) {
        return assetRepository.findById(assetId).map(this::toResponse);
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

    private String normalize(String value) {
        return value == null ? "" : value;
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
                asset.createdAt()
        );
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
}
