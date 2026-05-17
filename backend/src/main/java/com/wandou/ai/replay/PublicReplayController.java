package com.wandou.ai.replay;

import com.wandou.ai.agent.AgentRunEntity;
import com.wandou.ai.agent.AgentRunRepository;
import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.conversation.ConversationService;
import com.wandou.ai.project.ProjectService;
import com.wandou.ai.project.dto.ProjectResponse;
import com.wandou.ai.replay.dto.ProjectReplayResponse;
import com.wandou.ai.replay.dto.ReplayRunResponse;
import com.wandou.ai.sse.SseHub;
import com.wandou.ai.task.TaskService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/replays")
public class PublicReplayController {

    private final ProjectService projectService;
    private final ConversationService conversationService;
    private final CanvasService canvasService;
    private final TaskService taskService;
    private final AgentRunRepository agentRunRepository;
    private final SseHub sseHub;

    public PublicReplayController(
            ProjectService projectService,
            ConversationService conversationService,
            CanvasService canvasService,
            TaskService taskService,
            AgentRunRepository agentRunRepository,
            SseHub sseHub
    ) {
        this.projectService = projectService;
        this.conversationService = conversationService;
        this.canvasService = canvasService;
        this.taskService = taskService;
        this.agentRunRepository = agentRunRepository;
        this.sseHub = sseHub;
    }

    @GetMapping("/{projectId}")
    public ApiResponse<ProjectReplayResponse> detail(@PathVariable String projectId) {
        return projectService.get(projectId)
                .flatMap(this::toReplay)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("replay not found"));
    }

    private java.util.Optional<ProjectReplayResponse> toReplay(ProjectResponse project) {
        return conversationService.get(project.conversationId()).flatMap(conversation ->
                canvasService.get(project.canvasId()).map(canvas -> new ProjectReplayResponse(
                        project,
                        conversation,
                        canvas,
                        taskService.list(project.id()),
                        agentRunRepository.findByProjectIdOrderByCreatedAtAsc(project.id()).stream()
                                .map(this::toRun)
                                .toList()
                ))
        );
    }

    private ReplayRunResponse toRun(AgentRunEntity run) {
        return new ReplayRunResponse(
                run.id(),
                run.status(),
                run.agentName(),
                run.message(),
                run.error(),
                run.checkpoint(),
                sseHub.replay(run.id()),
                run.createdAt(),
                run.updatedAt()
        );
    }
}
