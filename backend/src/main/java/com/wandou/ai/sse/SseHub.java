package com.wandou.ai.sse;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class SseHub {

    private static final int MAX_HISTORY_PER_RUN = 200;
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final Map<String, List<SseEvent>> history = new ConcurrentHashMap<>();
    private final Map<SseEmitter, Set<String>> emittedEventIds = new ConcurrentHashMap<>();
    private final SseEventRepository eventRepository;
    private final ObjectMapper objectMapper;

    public SseHub(SseEventRepository eventRepository, ObjectMapper objectMapper) {
        this.eventRepository = eventRepository;
        this.objectMapper = objectMapper;
    }

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
        eventRepository.save(new SseEventEntity(
                event.id(),
                runId,
                event.event(),
                toJson(event.data()),
                event.createdAt()
        ));
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
        List<SseEventEntity> persisted = eventRepository.findTop200ByRunIdOrderByCreatedAtDesc(runId);
        if (!persisted.isEmpty()) {
            List<SseEvent> events = persisted.stream()
                    .map(this::toEvent)
                    .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
            Collections.reverse(events);
            return events;
        }
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
        emittedEventIds.remove(emitter);
    }

    private void sendToEmitter(String runId, SseEmitter emitter, SseEvent event) {
        try {
            Set<String> sentIds = emittedEventIds.computeIfAbsent(emitter, key -> ConcurrentHashMap.newKeySet());
            if (!sentIds.add(event.id())) {
                return;
            }
            emitter.send(SseEmitter.event()
                    .id(event.id())
                    .name(event.event())
                    .data(event, MediaType.APPLICATION_JSON));
        } catch (IOException ex) {
            remove(runId, emitter);
        }
    }

    private SseEvent toEvent(SseEventEntity entity) {
        return new SseEvent(
                entity.id(),
                entity.eventName(),
                entity.runId(),
                fromJson(entity.dataJson()),
                entity.createdAt()
        );
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private Map<String, Object> fromJson(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, MAP_TYPE);
        } catch (JsonProcessingException ex) {
            return Map.of("unreadable", true);
        }
    }
}
