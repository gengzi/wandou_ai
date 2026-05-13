package com.wandou.ai.sse;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class SseHub {

    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String runId) {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.computeIfAbsent(runId, key -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(runId, emitter));
        emitter.onTimeout(() -> remove(runId, emitter));
        emitter.onError(error -> remove(runId, emitter));
        send(runId, SseEvent.of("connected", runId, Map.of("message", "SSE connected")));
        return emitter;
    }

    public void send(String runId, SseEvent event) {
        List<SseEmitter> runEmitters = emitters.get(runId);
        if (runEmitters == null || runEmitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : runEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(event.event())
                        .data(event, MediaType.APPLICATION_JSON));
            } catch (IOException ex) {
                remove(runId, emitter);
            }
        }
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
}
