package com.wandou.ai.canvas;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.canvas.dto.CanvasEdgeResponse;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;
import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.canvas.dto.PositionResponse;
import com.wandou.ai.common.IdGenerator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CanvasService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final CanvasNodeRepository nodeRepository;
    private final CanvasEdgeRepository edgeRepository;
    private final CanvasRepository canvasRepository;
    private final ObjectMapper objectMapper;

    public CanvasService(CanvasNodeRepository nodeRepository, CanvasEdgeRepository edgeRepository, CanvasRepository canvasRepository, ObjectMapper objectMapper) {
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.canvasRepository = canvasRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public CanvasResponse createDefaultCanvas(String projectId) {
        String canvasId = IdGenerator.id("canvas_");
        Instant now = Instant.now();
        canvasRepository.save(new CanvasEntity(canvasId, projectId, now, now));
        nodeRepository.save(new CanvasNodeEntity(
                entityId(canvasId, "script-1"),
                canvasId,
                projectId,
                "script-1",
                "script",
                "智能剧本生成",
                "idle",
                80,
                260,
                toJson(Map.of("title", "智能剧本生成", "status", "idle")),
                toJson(Map.of()),
                now,
                now
        ));
        return requireCanvas(canvasId);
    }

    public Optional<CanvasResponse> get(String canvasId) {
        Optional<CanvasEntity> canvas = canvasRepository.findById(canvasId);
        if (canvas.isEmpty()) {
            return Optional.empty();
        }
        List<CanvasNodeEntity> nodes = nodeRepository.findByCanvasIdOrderByCreatedAtAsc(canvasId);
        return Optional.of(toResponse(canvas.get(), nodes, edgeRepository.findByCanvasIdOrderByCreatedAtAsc(canvasId)));
    }

    @Transactional
    public CanvasNodeResponse addNode(
            String canvasId,
            String type,
            String title,
            String status,
            PositionResponse position,
            Map<String, Object> data
    ) {
        String projectId = requireProjectId(canvasId);
        String nodeId = IdGenerator.id("node_" + type + "_");
        Instant now = Instant.now();
        CanvasNodeEntity node = nodeRepository.save(new CanvasNodeEntity(
                entityId(canvasId, nodeId),
                canvasId,
                projectId,
                nodeId,
                type,
                title,
                status,
                position.x(),
                position.y(),
                toJson(data),
                toJson(Map.of()),
                now,
                now
        ));
        touchCanvas(canvasId, now);
        return toNodeResponse(node);
    }

    @Transactional
    public CanvasNodeResponse updateNode(String canvasId, String nodeId, String status, Map<String, Object> output) {
        CanvasNodeEntity node = requireNode(canvasId, nodeId);
        node.update(
                status,
                node.positionX(),
                node.positionY(),
                node.dataJson(),
                toJson(output),
                Instant.now()
        );
        CanvasNodeEntity savedNode = nodeRepository.save(node);
        touchCanvas(canvasId, savedNode.updatedAt());
        return toNodeResponse(savedNode);
    }

    @Transactional
    public CanvasNodeResponse mergeNodeOutput(String canvasId, String nodeId, String status, Map<String, Object> output) {
        CanvasNodeEntity node = requireNode(canvasId, nodeId);
        Map<String, Object> mergedOutput = new LinkedHashMap<>(fromJson(node.outputJson()));
        mergedOutput.putAll(output);
        node.update(
                status == null || status.isBlank() ? node.status() : status,
                node.positionX(),
                node.positionY(),
                node.dataJson(),
                toJson(mergedOutput),
                Instant.now()
        );
        CanvasNodeEntity savedNode = nodeRepository.save(node);
        touchCanvas(canvasId, savedNode.updatedAt());
        return toNodeResponse(savedNode);
    }

    @Transactional
    public CanvasNodeResponse updateNodePosition(String canvasId, String nodeId, PositionResponse position) {
        CanvasNodeEntity node = requireNode(canvasId, nodeId);
        node.update(
                node.status(),
                position.x(),
                position.y(),
                node.dataJson(),
                node.outputJson(),
                Instant.now()
        );
        CanvasNodeEntity savedNode = nodeRepository.save(node);
        touchCanvas(canvasId, savedNode.updatedAt());
        return toNodeResponse(savedNode);
    }

    @Transactional
    public CanvasEdgeResponse addEdge(String canvasId, String source, String target) {
        Optional<CanvasEdgeEntity> existing = edgeRepository.findByCanvasIdAndSourceNodeIdAndTargetNodeId(canvasId, source, target);
        if (existing.isPresent()) {
            return toEdgeResponse(existing.get());
        }
        String projectId = requireProjectId(canvasId);
        CanvasEdgeEntity edge = edgeRepository.save(new CanvasEdgeEntity(
                IdGenerator.id("edge_"),
                canvasId,
                projectId,
                source,
                target,
                Instant.now()
        ));
        touchCanvas(canvasId, edge.createdAt());
        return toEdgeResponse(edge);
    }

    @Transactional
    public void deleteNode(String canvasId, String nodeId) {
        CanvasNodeEntity node = requireNode(canvasId, nodeId);
        List<CanvasEdgeEntity> incidentEdges = edgeRepository.findByCanvasIdOrderByCreatedAtAsc(canvasId).stream()
                .filter(edge -> edge.sourceNodeId().equals(nodeId) || edge.targetNodeId().equals(nodeId))
                .toList();
        edgeRepository.deleteAll(incidentEdges);
        nodeRepository.delete(node);
        touchCanvas(canvasId, Instant.now());
    }

    @Transactional
    public void deleteEdge(String canvasId, String edgeId) {
        CanvasEdgeEntity edge = edgeRepository.findById(edgeId)
                .filter(candidate -> candidate.canvasId().equals(canvasId))
                .orElseThrow(() -> new IllegalArgumentException("canvas edge not found: " + edgeId));
        edgeRepository.delete(edge);
        touchCanvas(canvasId, Instant.now());
    }

    private CanvasResponse requireCanvas(String canvasId) {
        return get(canvasId).orElseThrow(() -> new IllegalArgumentException("canvas not found: " + canvasId));
    }

    private String requireProjectId(String canvasId) {
        return get(canvasId)
                .map(CanvasResponse::projectId)
                .orElseThrow(() -> new IllegalArgumentException("canvas not found: " + canvasId));
    }

    private CanvasNodeEntity requireNode(String canvasId, String nodeId) {
        return nodeRepository.findByCanvasIdAndNodeId(canvasId, nodeId)
                .orElseThrow(() -> new IllegalArgumentException("canvas node not found: " + nodeId));
    }

    private CanvasResponse toResponse(CanvasEntity canvas, List<CanvasNodeEntity> nodeEntities, List<CanvasEdgeEntity> edgeEntities) {
        List<CanvasNodeResponse> nodes = nodeEntities.stream()
                .map(this::toNodeResponse)
                .toList();
        List<CanvasEdgeResponse> edges = edgeEntities.stream()
                .map(this::toEdgeResponse)
                .toList();
        return new CanvasResponse(canvas.id(), canvas.projectId(), nodes, edges, canvas.updatedAt());
    }

    private CanvasNodeResponse toNodeResponse(CanvasNodeEntity node) {
        return new CanvasNodeResponse(
                node.nodeId(),
                node.type(),
                node.title(),
                node.status(),
                new PositionResponse(node.positionX(), node.positionY()),
                fromJson(node.dataJson()),
                fromJson(node.outputJson()),
                node.updatedAt()
        );
    }

    private CanvasEdgeResponse toEdgeResponse(CanvasEdgeEntity edge) {
        return new CanvasEdgeResponse(edge.id(), edge.sourceNodeId(), edge.targetNodeId());
    }

    private String entityId(String canvasId, String nodeId) {
        return canvasId + ":" + nodeId;
    }

    private void touchCanvas(String canvasId, Instant updatedAt) {
        CanvasEntity canvas = canvasRepository.findById(canvasId)
                .orElseThrow(() -> new IllegalArgumentException("canvas not found: " + canvasId));
        canvas.touch(updatedAt);
        canvasRepository.save(canvas);
    }

    private String toJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("failed to serialize canvas node data", ex);
        }
    }

    private Map<String, Object> fromJson(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, MAP_TYPE);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("failed to read canvas node data", ex);
        }
    }
}
