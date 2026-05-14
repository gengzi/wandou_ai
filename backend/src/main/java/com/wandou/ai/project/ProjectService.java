package com.wandou.ai.project;

import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.conversation.ConversationService;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.project.dto.ProjectCreateRequest;
import com.wandou.ai.project.dto.ProjectResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ProjectService {

    private final CanvasService canvasService;
    private final ConversationService conversationService;
    private final Map<String, ProjectResponse> projects = new ConcurrentHashMap<>();

    public ProjectService(CanvasService canvasService, ConversationService conversationService) {
        this.canvasService = canvasService;
        this.conversationService = conversationService;
    }

    public ProjectResponse create(ProjectCreateRequest request) {
        String projectId = IdGenerator.id("proj_");
        CanvasResponse canvas = canvasService.createDefaultCanvas(projectId);
        ConversationResponse conversation = conversationService.create(projectId);
        ProjectResponse response = new ProjectResponse(
                projectId,
                request.name(),
                request.description(),
                request.aspectRatio() == null || request.aspectRatio().isBlank() ? "16:9" : request.aspectRatio(),
                canvas.id(),
                conversation.id(),
                Instant.now()
        );
        projects.put(projectId, response);
        return response;
    }

    public List<ProjectResponse> list() {
        return projects.values().stream()
                .sorted(Comparator.comparing(ProjectResponse::createdAt).reversed())
                .toList();
    }

    public Optional<ProjectResponse> get(String projectId) {
        return Optional.ofNullable(projects.get(projectId));
    }
}
