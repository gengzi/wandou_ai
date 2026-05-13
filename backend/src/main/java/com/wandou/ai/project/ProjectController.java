package com.wandou.ai.project;

import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.project.dto.ProjectCreateRequest;
import com.wandou.ai.project.dto.ProjectResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final Map<String, ProjectResponse> projects = new ConcurrentHashMap<>();

    @PostMapping
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody ProjectCreateRequest request) {
        String projectId = "proj_" + shortId();
        ProjectResponse response = new ProjectResponse(
                projectId,
                request.name(),
                request.description(),
                request.aspectRatio() == null || request.aspectRatio().isBlank() ? "16:9" : request.aspectRatio(),
                "canvas_" + shortId(),
                Instant.now()
        );
        projects.put(projectId, response);
        return ApiResponse.ok(response);
    }

    @GetMapping
    public ApiResponse<List<ProjectResponse>> list() {
        return ApiResponse.ok(projects.values().stream().toList());
    }

    @GetMapping("/{projectId}")
    public ApiResponse<ProjectResponse> detail(@PathVariable String projectId) {
        ProjectResponse project = projects.get(projectId);
        if (project == null) {
            return ApiResponse.fail("project not found");
        }
        return ApiResponse.ok(project);
    }

    private String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
