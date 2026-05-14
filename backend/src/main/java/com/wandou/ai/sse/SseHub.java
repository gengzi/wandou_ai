package com.wandou.ai.sse;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class SseHub {

    private static final int MAX_HISTORY_PER_RUN = 200;

    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final Map<String, List<SseEvent>> history = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String runId) {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.computeIfAbsent(runId, key -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(runId, emitter));
        emitter.onTimeout(() -> remove(runId, emitter));
        emitter.onError(error -> remove(runId, emitter));
        sendToEmitter(runId, emitter, SseEvent.of("connected", runId, Map.of("message", "SSE connected")));
        for (SseEvent event : replay(runId)) {
            sendToEmitter(runId, emitter, event);
        }
        return emitter;
    }

    public void send(String runId, SseEvent event) {
        List<SseEvent> runHistory = history.computeIfAbsent(runId, key -> new CopyOnWriteArrayList<>());
        runHistory.add(event);
        if (runHistory.size() > MAX_HISTORY_PER_RUN) {
            runHistory.remove(0);
        }
        List<SseEmitter> runEmitters = emitters.get(runId);
        if (runEmitters == null || runEmitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : runEmitters) {
            sendToEmitter(runId, emitter, event);
        }
    }

    public List<SseEvent> replay(String runId) {
        return new ArrayList<>(history.getOrDefault(runId, List.of()));
    }

    private void remove(String runId, SseEmitter emitter) {
        List<SseEmitter> runEmitters = emitters.get(runId);
        if (runEmitters != null) {
            runEmitters.remove(emitter);
            if (runEmitters.isEmpty()) {
                emitters.remove(runId);
            }
        }
    }

    private void sendToEmitter(String runId, SseEmitter emitter, SseEvent event) {
        try {
            emitter.send(SseEmitter.event()
                    .name(event.event())
                    .data(event, MediaType.APPLICATION_JSON));
        } catch (IOException ex) {
            remove(runId, emitter);
        }
    }
}
