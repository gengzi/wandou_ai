package com.wandou.ai.agent;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.wandou.ai.agent.dto.AgentRunControlRequest;
import com.wandou.ai.agent.dto.AgentRunControlResponse;
import com.wandou.ai.agent.dto.AgentRunRequest;
import com.wandou.ai.agent.dto.AgentRunResponse;
import com.wandou.ai.agent.dto.AgentRunDetailResponse;
import com.wandou.ai.common.ApiResponse;
import com.wandou.ai.sse.SseHub;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/agent/runs")
public class AgentRunController {

    private final AgentRunService agentRunService;
    private final SseHub sseHub;

    public AgentRunController(AgentRunService agentRunService, SseHub sseHub) {
        this.agentRunService = agentRunService;
        this.sseHub = sseHub;
    }

    @PostMapping
    @SaCheckPermission("agent:run")
    public ApiResponse<AgentRunResponse> start(@Valid @RequestBody AgentRunRequest request) {
        return ApiResponse.ok(agentRunService.start(request));
    }

    @GetMapping("/{runId}")
    @SaCheckPermission("agent:run")
    public ApiResponse<AgentRunDetailResponse> detail(@PathVariable String runId) {
        return agentRunService.get(runId)
                .map(ApiResponse::ok)
                .orElseGet(() -> ApiResponse.fail("agent run not found"));
    }

    @GetMapping
    @SaCheckPermission("agent:run")
    public ApiResponse<List<AgentRunDetailResponse>> list(@RequestParam(required = false) String projectId) {
        return ApiResponse.ok(agentRunService.listByProject(projectId));
    }

    @PostMapping("/{runId}/confirm")
    @SaCheckPermission("agent:run")
    public ApiResponse<AgentRunControlResponse> confirm(
            @PathVariable String runId,
            @RequestBody(required = false) AgentRunControlRequest request
    ) {
        return ApiResponse.ok(agentRunService.confirm(runId, request));
    }

    @PostMapping("/{runId}/interrupt")
    @SaCheckPermission("agent:run")
    public ApiResponse<AgentRunControlResponse> interrupt(
            @PathVariable String runId,
            @RequestBody(required = false) AgentRunControlRequest request
    ) {
        return ApiResponse.ok(agentRunService.interrupt(runId, request));
    }

    @PostMapping("/{runId}/resume")
    @SaCheckPermission("agent:run")
    public ApiResponse<AgentRunControlResponse> resume(
            @PathVariable String runId,
            @RequestBody(required = false) AgentRunControlRequest request
    ) {
        return ApiResponse.ok(agentRunService.resume(runId, request));
    }

    @PostMapping("/{runId}/cancel")
    @SaCheckPermission("agent:run")
    public ApiResponse<AgentRunControlResponse> cancel(
            @PathVariable String runId,
            @RequestBody(required = false) AgentRunControlRequest request
    ) {
        return ApiResponse.ok(agentRunService.cancel(runId, request));
    }

    @GetMapping(value = "/{runId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @SaCheckPermission("agent:run")
    public SseEmitter events(@PathVariable String runId) {
        return sseHub.subscribe(runId);
    }
}
