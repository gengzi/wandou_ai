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

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody ProjectCreateRequest request) {
        return ApiResponse.ok(projectService.create(request));
    }

    @GetMapping
    public ApiResponse<List<ProjectResponse>> list() {
        return ApiResponse.ok(projectService.list());
    }

    @GetMapping("/{projectId}")
    public ApiResponse<ProjectResponse> detail(@PathVariable String projectId) {
        return projectService.get(projectId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("project not found"));
    }
}
