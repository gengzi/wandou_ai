package com.wandou.ai.project;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.project.dto.ProjectCreateRequest;
import com.wandou.ai.project.dto.ProjectPageResponse;
import com.wandou.ai.project.dto.ProjectResponse;
import com.wandou.ai.project.dto.ProjectUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    @SaCheckPermission("project:write")
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody ProjectCreateRequest request) {
        return ApiResponse.ok(projectService.create(request));
    }

    @GetMapping
    @SaCheckPermission("project:read")
    public ApiResponse<List<ProjectResponse>> list() {
        return ApiResponse.ok(projectService.list());
    }

    @GetMapping("/page")
    @SaCheckPermission("project:read")
    public ApiResponse<ProjectPageResponse> page(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return ApiResponse.ok(projectService.page(page, size));
    }

    @GetMapping("/{projectId}")
    @SaCheckPermission("project:read")
    public ApiResponse<ProjectResponse> detail(@PathVariable String projectId) {
        return projectService.get(projectId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("project not found"));
    }

    @PatchMapping("/{projectId}")
    @SaCheckPermission("project:write")
    public ApiResponse<ProjectResponse> update(@PathVariable String projectId, @Valid @RequestBody ProjectUpdateRequest request) {
        return projectService.update(projectId, request)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("project not found"));
    }
}
