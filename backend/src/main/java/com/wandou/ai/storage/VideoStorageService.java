package com.wandou.ai.storage;

public interface VideoStorageService {
    StoredObjectMetadata save(String objectKey, String contentType, byte[] bytes);

    StoredObject load(String objectKey);
}
