package com.wandou.ai.storage;

public record StoredObject(
        String objectKey,
        String contentType,
        long size,
        byte[] bytes
) {
}
