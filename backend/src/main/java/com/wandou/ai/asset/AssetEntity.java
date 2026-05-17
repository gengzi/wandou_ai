package com.wandou.ai.asset;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "assets")
public class AssetEntity {

    @Id
    private String id;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "canvas_id", nullable = false)
    private String canvasId;

    @Column(name = "node_id", nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String url;

    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @Column(name = "object_key")
    private String objectKey;

    @Column(name = "thumbnail_object_key")
    private String thumbnailObjectKey;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "thumbnail_content_type")
    private String thumbnailContentType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private String purpose = "library_asset";

    @Column(name = "parse_status", nullable = false)
    private String parseStatus = "not_required";

    @Column(name = "parsed_text")
    private String parsedText;

    @Column(name = "parsed_summary")
    private String parsedSummary;

    @Column(name = "parse_error")
    private String parseError;

    @Column(name = "metadata_json")
    private String metadataJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AssetEntity() {
    }

    public AssetEntity(
            String id,
            String projectId,
            String canvasId,
            String nodeId,
            String type,
            String name,
            String url,
            String thumbnailUrl,
            String objectKey,
            String thumbnailObjectKey,
            String contentType,
            String thumbnailContentType,
            Long sizeBytes,
            String status,
            Instant createdAt
    ) {
        this.id = id;
        this.projectId = projectId;
        this.canvasId = canvasId;
        this.nodeId = nodeId;
        this.type = type;
        this.name = name;
        this.url = url;
        this.thumbnailUrl = thumbnailUrl;
        this.objectKey = objectKey;
        this.thumbnailObjectKey = thumbnailObjectKey;
        this.contentType = contentType;
        this.thumbnailContentType = thumbnailContentType;
        this.sizeBytes = sizeBytes;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String id() {
        return id;
    }

    public String projectId() {
        return projectId;
    }

    public String canvasId() {
        return canvasId;
    }

    public String nodeId() {
        return nodeId;
    }

    public String type() {
        return type;
    }

    public String name() {
        return name;
    }

    public String url() {
        return url;
    }

    public String thumbnailUrl() {
        return thumbnailUrl;
    }

    public String objectKey() {
        return objectKey;
    }

    public String thumbnailObjectKey() {
        return thumbnailObjectKey;
    }

    public String contentType() {
        return contentType;
    }

    public String thumbnailContentType() {
        return thumbnailContentType;
    }

    public Long sizeBytes() {
        return sizeBytes;
    }

    public String status() {
        return status;
    }

    public String purpose() {
        return purpose;
    }

    public String parseStatus() {
        return parseStatus;
    }

    public String parsedText() {
        return parsedText;
    }

    public String parsedSummary() {
        return parsedSummary;
    }

    public String parseError() {
        return parseError;
    }

    public String metadataJson() {
        return metadataJson;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public void updateDetails(String projectId, String canvasId, String nodeId, String type, String name, String url, String thumbnailUrl, String purpose) {
        this.projectId = projectId;
        this.canvasId = canvasId;
        this.nodeId = nodeId;
        this.type = type;
        this.name = name;
        this.url = url;
        this.thumbnailUrl = thumbnailUrl;
        if (purpose != null && !purpose.isBlank()) {
            this.purpose = purpose;
        }
    }

    public void updateAttachmentContext(String purpose, String parseStatus, String parsedText, String parsedSummary, String parseError, String metadataJson) {
        if (purpose != null && !purpose.isBlank()) {
            this.purpose = purpose;
        }
        if (parseStatus != null && !parseStatus.isBlank()) {
            this.parseStatus = parseStatus;
        }
        this.parsedText = parsedText;
        this.parsedSummary = parsedSummary;
        this.parseError = parseError;
        this.metadataJson = metadataJson;
    }
}
