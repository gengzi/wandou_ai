package com.wandou.ai.agent.monitor;

import com.wandou.ai.agent.dto.AgentRunMonitorResponse;
import com.wandou.ai.agent.dto.AgentStepMonitorResponse;
import com.wandou.ai.agent.runtime.VideoAgentOutput;
import com.wandou.ai.agent.runtime.VideoAgentStep;
import com.wandou.ai.config.WandouAiProperties;
import io.agentscope.core.message.GenerateReason;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(prefix = "wandou.ai.agent.monitor", name = "enabled", havingValue = "true", matchIfMissing = true)
public class InMemoryAgentRunMonitor implements AgentRunMonitor {
    private static final Set<String> IMPORTANT_EVENTS = Set.of(
            "agent.step.completed",
            "agent.confirmation.required",
            "agent.confirmation.accepted",
            "run.interrupted",
            "run.resumed",
            "run.cancelled",
            "run.completed",
            "run.failed"
    );

    private final Map<String, RunMonitor> runs = new ConcurrentHashMap<>();
    private final boolean sseEnabled;
    private final long minPublishIntervalMs;

    public InMemoryAgentRunMonitor(WandouAiProperties properties) {
        WandouAiProperties.AgentMonitor monitor = properties.getAgent().getMonitor();
        this.sseEnabled = monitor.isSseEnabled();
        this.minPublishIntervalMs = monitor.getMinPublishIntervalMs();
    }

    @Override
    public void startRun(String runId, Instant startedAt, String status) {
        runs.put(runId, new RunMonitor(startedAt, status));
    }

    @Override
    public void status(String runId, String status) {
        run(runId).status(status);
    }

    @Override
    public void event(String runId, String eventName) {
        run(runId).event(eventName);
    }

    @Override
    public void stepStarted(String runId, VideoAgentStep step, String agentName) {
        run(runId).stepStarted(step, agentName);
    }

    @Override
    public void stepCompleted(String runId, VideoAgentStep step, String agentName, VideoAgentOutput output, GenerateReason reason) {
        run(runId).stepCompleted(step, agentName, output, reason);
    }

    @Override
    public void confirmationRequired(String runId) {
        run(runId).confirmationRequired();
    }

    @Override
    public void confirmationResolved(String runId) {
        run(runId).confirmationResolved();
    }

    @Override
    public void interrupted(String runId) {
        run(runId).interrupted();
    }

    @Override
    public void resumed(String runId) {
        run(runId).resumed();
    }

    @Override
    public void cancelled(String runId) {
        run(runId).cancelled();
    }

    @Override
    public AgentRunMonitorResponse snapshot(String runId) {
        return run(runId).snapshot(runId);
    }

    @Override
    public boolean shouldPublish(String runId, String eventName) {
        if (!sseEnabled) {
            return false;
        }
        RunMonitor monitor = run(runId);
        if (IMPORTANT_EVENTS.contains(eventName)) {
            monitor.markPublished();
            return true;
        }
        return monitor.tryPublishAfter(minPublishIntervalMs);
    }

    private RunMonitor run(String runId) {
        return runs.computeIfAbsent(runId, key -> new RunMonitor(Instant.now(), "unknown"));
    }

    private static final class RunMonitor {
        private final Instant startedAt;
        private final Map<String, MutableStepMonitor> steps = new LinkedHashMap<>();
        private String status;
        private int eventCount;
        private int interruptionCount;
        private int confirmationWaitCount;
        private long totalConfirmationWaitMs;
        private Instant confirmationStartedAt;
        private Instant updatedAt;
        private Instant lastPublishedAt;

        private RunMonitor(Instant startedAt, String status) {
            this.startedAt = startedAt;
            this.status = status;
            this.updatedAt = startedAt;
        }

        private synchronized void status(String status) {
            this.status = status;
            this.updatedAt = Instant.now();
        }

        private synchronized void event(String eventName) {
            if (!"run.monitor.updated".equals(eventName)) {
                eventCount++;
                updatedAt = Instant.now();
            }
        }

        private synchronized void stepStarted(VideoAgentStep step, String agentName) {
            MutableStepMonitor monitor = steps.computeIfAbsent(step.code(), key -> new MutableStepMonitor(step.code(), step.title()));
            monitor.agentName = agentName;
            monitor.status = "running";
            monitor.startedAt = Instant.now();
            monitor.completedAt = null;
            monitor.durationMs = 0;
            updatedAt = monitor.startedAt;
        }

        private synchronized void stepCompleted(VideoAgentStep step, String agentName, VideoAgentOutput output, GenerateReason reason) {
            Instant now = Instant.now();
            MutableStepMonitor monitor = steps.computeIfAbsent(step.code(), key -> new MutableStepMonitor(step.code(), step.title()));
            monitor.agentName = agentName;
            monitor.status = reason == GenerateReason.INTERRUPTED ? "interrupted" : "completed";
            monitor.reason = reason == null ? "" : reason.name();
            monitor.modelSource = output == null ? "" : stringValue(output.output(), "modelSource", "");
            monitor.completedAt = now;
            if (monitor.startedAt != null) {
                monitor.durationMs = Duration.between(monitor.startedAt, now).toMillis();
            }
            updatedAt = now;
        }

        private synchronized void confirmationRequired() {
            confirmationWaitCount++;
            confirmationStartedAt = Instant.now();
            updatedAt = confirmationStartedAt;
        }

        private synchronized void confirmationResolved() {
            if (confirmationStartedAt != null) {
                totalConfirmationWaitMs += Duration.between(confirmationStartedAt, Instant.now()).toMillis();
                confirmationStartedAt = null;
            }
            updatedAt = Instant.now();
        }

        private synchronized void interrupted() {
            interruptionCount++;
            updatedAt = Instant.now();
        }

        private synchronized void resumed() {
            updatedAt = Instant.now();
        }

        private synchronized void cancelled() {
            confirmationStartedAt = null;
            updatedAt = Instant.now();
        }

        private synchronized boolean tryPublishAfter(long minPublishIntervalMs) {
            Instant now = Instant.now();
            if (lastPublishedAt == null || Duration.between(lastPublishedAt, now).toMillis() >= minPublishIntervalMs) {
                lastPublishedAt = now;
                return true;
            }
            return false;
        }

        private synchronized void markPublished() {
            lastPublishedAt = Instant.now();
        }

        private synchronized AgentRunMonitorResponse snapshot(String runId) {
            Instant now = Instant.now();
            long waitingMs = confirmationStartedAt == null ? 0 : Duration.between(confirmationStartedAt, now).toMillis();
            List<AgentStepMonitorResponse> stepResponses = steps.values().stream()
                    .map(MutableStepMonitor::toResponse)
                    .toList();
            String runningStep = steps.values().stream()
                    .filter(step -> "running".equals(step.status))
                    .map(step -> step.step)
                    .findFirst()
                    .orElse("");
            String bottleneck = steps.values().stream()
                    .filter(step -> step.durationMs > 0)
                    .max(Comparator.comparingLong(step -> step.durationMs))
                    .map(step -> step.step)
                    .orElse("");
            return new AgentRunMonitorResponse(
                    runId,
                    status,
                    runningStep,
                    bottleneck,
                    Duration.between(startedAt, now).toMillis(),
                    eventCount,
                    interruptionCount,
                    confirmationWaitCount,
                    totalConfirmationWaitMs + waitingMs,
                    stepResponses,
                    designSignals(stepResponses, bottleneck, interruptionCount),
                    updatedAt
            );
        }

        private static List<String> designSignals(List<AgentStepMonitorResponse> steps, String bottleneck, int interruptionCount) {
            List<String> signals = new ArrayList<>();
            if (bottleneck != null && !bottleneck.isBlank()) {
                signals.add("耗时最高节点是 " + bottleneck + "，优先检查它的输入上下文、模型配置和是否需要拆成更小的子 Agent。");
            }
            long fallbackCount = steps.stream()
                    .filter(step -> "template-fallback".equals(step.modelSource()))
                    .count();
            if (fallbackCount > 0) {
                signals.add("有 " + fallbackCount + " 个节点走了模板 fallback，agent 设计需要补强结构化 JSON 输出约束或模型可用性。");
            }
            if (interruptionCount > 0) {
                signals.add("本次发生过打断，建议把可人工决策的检查点前移，减少用户在长链路中途修正成本。");
            }
            if (steps.stream().anyMatch(step -> "interrupted".equals(step.status()))) {
                signals.add("存在被中断的 Agent 步骤，恢复策略应明确是否重跑当前节点或复用已有输出。");
            }
            if (signals.isEmpty()) {
                signals.add("链路完整且无明显异常，下一步可以对比多次 Run 的瓶颈节点来调整 Agent 分工。");
            }
            return signals;
        }

        private static String stringValue(Map<String, Object> output, String key, String fallback) {
            Object value = output.get(key);
            if (value instanceof String string && !string.isBlank()) {
                return string;
            }
            return fallback;
        }
    }

    private static final class MutableStepMonitor {
        private final String step;
        private final String title;
        private String agentName = "";
        private String status = "pending";
        private String reason = "";
        private String modelSource = "";
        private Instant startedAt;
        private Instant completedAt;
        private long durationMs;

        private MutableStepMonitor(String step, String title) {
            this.step = step;
            this.title = title;
        }

        private AgentStepMonitorResponse toResponse() {
            return new AgentStepMonitorResponse(
                    step,
                    title,
                    agentName,
                    status,
                    reason,
                    modelSource,
                    startedAt,
                    completedAt,
                    durationMs
            );
        }
    }
}
