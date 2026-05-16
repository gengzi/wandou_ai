package com.wandou.ai.storage;

public record StoredObjectMetadata(
        String objectKey,
        String contentType,
        long size
) {
}
