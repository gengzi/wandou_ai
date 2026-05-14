package com.wandou.ai.task;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.task.dto.TaskResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    @SaCheckPermission("task:read")
    public ApiResponse<List<TaskResponse>> list(@RequestParam(required = false) String projectId) {
        return ApiResponse.ok(taskService.list(projectId));
    }

    @GetMapping("/{taskId}")
    @SaCheckPermission("task:read")
    public ApiResponse<TaskResponse> detail(@PathVariable String taskId) {
        return taskService.get(taskId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("task not found"));
    }
}
