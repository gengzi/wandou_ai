package com.wandou.ai.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;

@Service
@ConditionalOnProperty(name = "wandou.ai.storage.type", havingValue = "minio", matchIfMissing = true)
public class MinioVideoStorageService implements VideoStorageService {

    private final MinioClient minioClient;
    private final String bucket;
    private volatile boolean bucketReady;

    public MinioVideoStorageService(
            @Value("${wandou.ai.storage.minio.endpoint}") String endpoint,
            @Value("${wandou.ai.storage.minio.access-key}") String accessKey,
            @Value("${wandou.ai.storage.minio.secret-key}") String secretKey,
            @Value("${wandou.ai.storage.minio.bucket}") String bucket
    ) {
        this.minioClient = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        this.bucket = bucket;
    }

    @Override
    public StoredObjectMetadata save(String objectKey, String contentType, byte[] bytes) {
        try {
            ensureBucket();
            byte[] safeBytes = bytes == null ? new byte[0] : bytes;
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .contentType(contentType)
                    .stream(new ByteArrayInputStream(safeBytes), safeBytes.length, -1)
                    .build());
            return new StoredObjectMetadata(objectKey, contentType, safeBytes.length);
        } catch (Exception ex) {
            throw new IllegalStateException("failed to save object: " + objectKey, ex);
        }
    }

    @Override
    public StoredObject load(String objectKey) {
        try {
            byte[] bytes = minioClient.getObject(GetObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build())
                    .readAllBytes();
            return new StoredObject(objectKey, "application/octet-stream", bytes.length, bytes);
        } catch (Exception ex) {
            throw new IllegalArgumentException("stored object not found: " + objectKey, ex);
        }
    }

    private void ensureBucket() throws Exception {
        if (bucketReady) {
            return;
        }
        synchronized (this) {
            if (bucketReady) {
                return;
            }
            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
            bucketReady = true;
        }
    }
}
