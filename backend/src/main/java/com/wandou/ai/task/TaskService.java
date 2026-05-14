package com.wandou.ai.task;

import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.task.dto.TaskResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TaskService {

    private final Map<String, TaskResponse> tasks = new ConcurrentHashMap<>();

    public TaskResponse create(String runId, String projectId, String canvasId, String nodeId, String type) {
        TaskResponse task = new TaskResponse(
                IdGenerator.id("task_" + type + "_"),
                runId,
                projectId,
                canvasId,
                nodeId,
                type,
                "running",
                0,
                "任务已创建",
                Instant.now()
        );
        tasks.put(task.id(), task);
        return task;
    }

    public TaskResponse update(String taskId, String status, int progress, String message) {
        TaskResponse current = tasks.get(taskId);
        if (current == null) {
            throw new IllegalArgumentException("task not found: " + taskId);
        }
        TaskResponse updated = new TaskResponse(
                current.id(),
                current.runId(),
                current.projectId(),
                current.canvasId(),
                current.nodeId(),
                current.type(),
                status,
                progress,
                message,
                Instant.now()
        );
        tasks.put(taskId, updated);
        return updated;
    }

    public List<TaskResponse> list(String projectId) {
        return tasks.values().stream()
                .filter(task -> projectId == null || projectId.isBlank() || task.projectId().equals(projectId))
                .sorted(Comparator.comparing(TaskResponse::updatedAt).reversed())
                .toList();
    }

    public Optional<TaskResponse> get(String taskId) {
        return Optional.ofNullable(tasks.get(taskId));
    }
}
