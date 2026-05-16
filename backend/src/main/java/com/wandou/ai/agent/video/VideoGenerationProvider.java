package com.wandou.ai.agent.video;

public interface VideoGenerationProvider {
    String submit(VideoGenerationRequest request);

    VideoGenerationStatus getStatus(String providerJobId);
}
