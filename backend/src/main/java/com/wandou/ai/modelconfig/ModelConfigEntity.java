package com.wandou.ai.modelconfig;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "model_configs")
public class ModelConfigEntity {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String capability;

    @Column(nullable = false)
    private String provider;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "base_url", nullable = false)
    private String baseUrl;

    @Column(name = "model_name", nullable = false)
    private String modelName;

    @Column(name = "api_key_secret")
    private String apiKeySecret;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ModelConfigEntity() {
    }

    public ModelConfigEntity(String id, String userId, String capability, String provider, String displayName, String baseUrl, String modelName, String apiKeySecret, boolean enabled, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.userId = userId;
        this.capability = capability;
        this.provider = provider;
        this.displayName = displayName;
        this.baseUrl = baseUrl;
        this.modelName = modelName;
        this.apiKeySecret = apiKeySecret;
        this.enabled = enabled;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String id() {
        return id;
    }

    public String userId() {
        return userId;
    }

    public String capability() {
        return capability;
    }

    public String provider() {
        return provider;
    }

    public String displayName() {
        return displayName;
    }

    public String baseUrl() {
        return baseUrl;
    }

    public String modelName() {
        return modelName;
    }

    public String apiKeySecret() {
        return apiKeySecret;
    }

    public boolean enabled() {
        return enabled;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public void update(String capability, String provider, String displayName, String baseUrl, String modelName, String apiKeySecret, boolean enabled, Instant updatedAt) {
        this.capability = capability;
        this.provider = provider;
        this.displayName = displayName;
        this.baseUrl = baseUrl;
        this.modelName = modelName;
        if (apiKeySecret != null && !apiKeySecret.isBlank()) {
            this.apiKeySecret = apiKeySecret;
        }
        this.enabled = enabled;
        this.updatedAt = updatedAt;
    }
}
