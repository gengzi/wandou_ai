package com.wandou.ai.project;

import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.conversation.ConversationService;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.project.dto.ProjectCreateRequest;
import com.wandou.ai.project.dto.ProjectResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

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
                request.name(),
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

    public Optional<ProjectResponse> get(String projectId) {
        return projectRepository.findById(projectId).map(this::toResponse);
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
