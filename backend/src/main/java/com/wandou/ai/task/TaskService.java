package com.wandou.ai.task;

import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.task.dto.TaskResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional
    public TaskResponse create(String runId, String projectId, String canvasId, String nodeId, String type) {
        TaskEntity task = new TaskEntity(
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
        return toResponse(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse update(String taskId, String status, int progress, String message) {
        TaskEntity current = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("task not found: " + taskId));
        current.update(status, progress, message, Instant.now());
        return toResponse(taskRepository.save(current));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> list(String projectId) {
        List<TaskEntity> tasks = projectId == null || projectId.isBlank()
                ? taskRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "updatedAt"))
                : taskRepository.findByProjectIdOrderByUpdatedAtDesc(projectId);
        return tasks.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<TaskResponse> get(String taskId) {
        return taskRepository.findById(taskId).map(this::toResponse);
    }

    private TaskResponse toResponse(TaskEntity task) {
        return new TaskResponse(
                task.id(),
                task.runId(),
                task.projectId(),
                task.canvasId(),
                task.nodeId(),
                task.type(),
                task.status(),
                task.progress(),
                task.message(),
                task.updatedAt()
        );
    }
}
