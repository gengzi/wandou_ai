package com.wandou.ai.replay.dto;

import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.project.dto.ProjectResponse;
import com.wandou.ai.task.dto.TaskResponse;

import java.util.List;

public record ProjectReplayResponse(
        ProjectResponse project,
        ConversationResponse conversation,
        CanvasResponse canvas,
        List<TaskResponse> tasks,
        List<ReplayRunResponse> runs
) {
}
