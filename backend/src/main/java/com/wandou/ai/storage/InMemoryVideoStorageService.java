package com.wandou.ai.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@ConditionalOnProperty(name = "wandou.ai.storage.type", havingValue = "fake")
public class InMemoryVideoStorageService implements VideoStorageService {

    private final Map<String, StoredObject> objects = new ConcurrentHashMap<>();

    @Override
    public StoredObjectMetadata save(String objectKey, String contentType, byte[] bytes) {
        byte[] safeBytes = bytes == null ? new byte[0] : bytes;
        StoredObject object = new StoredObject(objectKey, contentType, safeBytes.length, safeBytes);
        objects.put(objectKey, object);
        return new StoredObjectMetadata(objectKey, contentType, safeBytes.length);
    }

    @Override
    public StoredObject load(String objectKey) {
        StoredObject object = objects.get(objectKey);
        if (object == null) {
            throw new IllegalArgumentException("stored object not found: " + objectKey);
        }
        return object;
    }
}
