package com.wandou.ai.project;

import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.conversation.ConversationService;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.project.dto.ProjectCreateRequest;
import com.wandou.ai.project.dto.ProjectPageResponse;
import com.wandou.ai.project.dto.ProjectResponse;
import com.wandou.ai.project.dto.ProjectUpdateRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final CanvasService canvasService;
    private final ConversationService conversationService;

    public ProjectService(ProjectRepository projectRepository, CanvasService canvasService, ConversationService conversationService) {
        this.projectRepository = projectRepository;
        this.canvasService = canvasService;
        this.conversationService = conversationService;
    }

    @Transactional
    public ProjectResponse create(ProjectCreateRequest request) {
        String projectId = IdGenerator.id("proj_");
        CanvasResponse canvas = canvasService.createDefaultCanvas(projectId);
        ConversationResponse conversation = conversationService.create(projectId);
        ProjectEntity project = new ProjectEntity(
                projectId,
                resolveProjectName(request),
                request.description(),
                request.aspectRatio() == null || request.aspectRatio().isBlank() ? "16:9" : request.aspectRatio(),
                canvas.id(),
                conversation.id(),
                Instant.now()
        );
        return toResponse(projectRepository.save(project));
    }

    public List<ProjectResponse> list() {
        return projectRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    public ProjectPageResponse page(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(30, Math.max(6, size));
        Page<ProjectEntity> result = projectRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(safePage, safeSize));
        return new ProjectPageResponse(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.getNumber(),
                result.getSize()
        );
    }

    public Optional<ProjectResponse> get(String projectId) {
        return projectRepository.findById(projectId).map(this::toResponse);
    }

    @Transactional
    public Optional<ProjectResponse> update(String projectId, ProjectUpdateRequest request) {
        return projectRepository.findById(projectId)
                .map(project -> {
                    project.rename(cleanName(request.name()));
                    return toResponse(projectRepository.save(project));
                });
    }

    private String resolveProjectName(ProjectCreateRequest request) {
        String manualName = cleanName(request.name());
        if (!manualName.isBlank()) {
            return manualName;
        }
        return titleFromPrompt(firstPresent(request.prompt(), request.description()));
    }

    private String cleanName(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstPresent(String... values) {
        return Arrays.stream(values)
                .filter(value -> value != null && !value.trim().isBlank())
                .findFirst()
                .orElse("");
    }

    private String titleFromPrompt(String prompt) {
        String cleaned = cleanName(prompt)
                .replaceAll("[\\r\\n]+", " ")
                .replaceAll("[，。！？、；：,.!?;:]+", " ")
                .replaceAll("\\s+", " ");
        if (cleaned.isBlank()) {
            return "未命名创作项目";
        }

        List<String> stopWords = List.of(
                "生成", "制作", "创建", "一个", "一段", "一套", "视频", "短片", "项目", "帮我", "请", "需要",
                "generate", "create", "make", "video", "project", "please", "a", "an", "the"
        );
        String title = Arrays.stream(cleaned.split(" "))
                .map(String::trim)
                .filter(word -> !word.isBlank())
                .filter(word -> !stopWords.contains(word.toLowerCase(Locale.ROOT)))
                .collect(Collectors.joining(" "));
        if (title.isBlank()) {
            title = cleaned;
        }
        title = title.length() > 18 ? title.substring(0, 18) : title;
        return title.endsWith("项目") ? title : title + "项目";
    }

    private ProjectResponse toResponse(ProjectEntity project) {
        return new ProjectResponse(
                project.id(),
                project.name(),
                project.description(),
                project.aspectRatio(),
                project.canvasId(),
                project.conversationId(),
                project.createdAt()
        );
    }
}
