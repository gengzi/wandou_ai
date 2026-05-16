package com.wandou.ai.agent.prompt;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PromptTemplateService {

    private static final String BASE_PATH = "prompts/video-agent/";
    private final Map<String, PromptTemplate> cache = new ConcurrentHashMap<>();

    public RenderedPrompt render(String templateName, Map<String, ?> variables) {
        PromptTemplate template = load(templateName);
        String content = template.content();
        for (Map.Entry<String, ?> entry : variables.entrySet()) {
            String value = entry.getValue() == null ? "" : String.valueOf(entry.getValue());
            content = content.replace("{{" + entry.getKey() + "}}", value);
        }
        return new RenderedPrompt(template.name(), template.version(), content);
    }

    public PromptTemplate load(String templateName) {
        return cache.computeIfAbsent(normalizeName(templateName), this::readTemplate);
    }

    private PromptTemplate readTemplate(String templateName) {
        ClassPathResource resource = new ClassPathResource(BASE_PATH + templateName);
        if (!resource.exists()) {
            throw new IllegalArgumentException("prompt template not found: " + templateName);
        }
        try {
            String content = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
            return new PromptTemplate(templateName, hash(content), content);
        } catch (IOException ex) {
            throw new IllegalStateException("failed to read prompt template: " + templateName, ex);
        }
    }

    private String normalizeName(String templateName) {
        if (templateName == null || templateName.isBlank()) {
            throw new IllegalArgumentException("prompt template name is required");
        }
        String normalized = templateName.trim();
        return normalized.endsWith(".md") ? normalized : normalized + ".md";
    }

    private String hash(String content) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 12);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    public record PromptTemplate(String name, String version, String content) {
    }

    public record RenderedPrompt(String name, String version, String content) {
    }
}
