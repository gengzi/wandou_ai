package com.wandou.ai.asset;

import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.common.IdGenerator;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AssetService {

    private final Map<String, AssetResponse> assets = new ConcurrentHashMap<>();

    public AssetResponse create(
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            String url,
            String thumbnailUrl
    ) {
        AssetResponse asset = new AssetResponse(
                IdGenerator.id("asset_" + type + "_"),
                projectId,
                canvasId,
                nodeId,
                type,
                name,
                url,
                thumbnailUrl,
                Instant.now()
        );
        assets.put(asset.id(), asset);
        return asset;
    }

    public List<AssetResponse> list(String projectId) {
        return assets.values().stream()
                .filter(asset -> projectId == null || projectId.isBlank() || asset.projectId().equals(projectId))
                .sorted(Comparator.comparing(AssetResponse::createdAt).reversed())
                .toList();
    }

    public Optional<AssetResponse> get(String assetId) {
        return Optional.ofNullable(assets.get(assetId));
    }
}
