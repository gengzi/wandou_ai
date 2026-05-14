package com.wandou.ai.canvas;

import com.wandou.ai.canvas.dto.CanvasEdgeResponse;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;
import com.wandou.ai.canvas.dto.CanvasResponse;
import com.wandou.ai.canvas.dto.PositionResponse;
import com.wandou.ai.common.IdGenerator;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CanvasService {

    private final Map<String, MutableCanvas> canvases = new ConcurrentHashMap<>();

    public CanvasResponse createDefaultCanvas(String projectId) {
        String canvasId = IdGenerator.id("canvas_");
        MutableCanvas canvas = new MutableCanvas(canvasId, projectId);
        canvas.nodes.add(new CanvasNodeResponse(
                "script-1",
                "script",
                "智能剧本生成",
                "idle",
                new PositionResponse(80, 120),
                Map.of("title", "智能剧本生成", "status", "idle"),
                Map.of(),
                Instant.now()
        ));
        canvas.nodes.add(new CanvasNodeResponse(
                "char-1",
                "character",
                "角色一致性生成",
                "idle",
                new PositionResponse(480, 120),
                Map.of("title", "角色一致性生成", "status", "idle"),
                Map.of(),
                Instant.now()
        ));
        canvas.nodes.add(new CanvasNodeResponse(
                "img-1",
                "images",
                "场景概念图生成",
                "idle",
                new PositionResponse(940, 120),
                Map.of("title", "场景概念图生成", "status", "idle"),
                Map.of(),
                Instant.now()
        ));
        canvas.nodes.add(new CanvasNodeResponse(
                "audio-1",
                "audio",
                "生成音效配乐",
                "idle",
                new PositionResponse(940, 500),
                Map.of("title", "生成音效配乐", "status", "idle"),
                Map.of(),
                Instant.now()
        ));
        canvas.edges.add(new CanvasEdgeResponse("e-script-char", "script-1", "char-1"));
        canvas.edges.add(new CanvasEdgeResponse("e-char-img", "char-1", "img-1"));
        canvas.edges.add(new CanvasEdgeResponse("e-script-audio", "script-1", "audio-1"));
        canvases.put(canvasId, canvas);
        return canvas.toResponse();
    }

    public Optional<CanvasResponse> get(String canvasId) {
        MutableCanvas canvas = canvases.get(canvasId);
        return canvas == null ? Optional.empty() : Optional.of(canvas.toResponse());
    }

    public CanvasNodeResponse addNode(
            String canvasId,
            String type,
            String title,
            String status,
            PositionResponse position,
            Map<String, Object> data
    ) {
        MutableCanvas canvas = requireCanvas(canvasId);
        CanvasNodeResponse node = new CanvasNodeResponse(
                IdGenerator.id("node_" + type + "_"),
                type,
                title,
                status,
                position,
                data,
                Map.of(),
                Instant.now()
        );
        synchronized (canvas) {
            canvas.nodes.add(node);
            canvas.updatedAt = Instant.now();
        }
        return node;
    }

    public CanvasNodeResponse updateNode(String canvasId, String nodeId, String status, Map<String, Object> output) {
        MutableCanvas canvas = requireCanvas(canvasId);
        synchronized (canvas) {
            for (int index = 0; index < canvas.nodes.size(); index++) {
                CanvasNodeResponse node = canvas.nodes.get(index);
                if (node.id().equals(nodeId)) {
                    CanvasNodeResponse updated = new CanvasNodeResponse(
                            node.id(),
                            node.type(),
                            node.title(),
                            status,
                            node.position(),
                            node.data(),
                            output,
                            Instant.now()
                    );
                    canvas.nodes.set(index, updated);
                    canvas.updatedAt = Instant.now();
                    return updated;
                }
            }
        }
        throw new IllegalArgumentException("canvas node not found: " + nodeId);
    }

    public CanvasNodeResponse updateNodePosition(String canvasId, String nodeId, PositionResponse position) {
        MutableCanvas canvas = requireCanvas(canvasId);
        synchronized (canvas) {
            for (int index = 0; index < canvas.nodes.size(); index++) {
                CanvasNodeResponse node = canvas.nodes.get(index);
                if (node.id().equals(nodeId)) {
                    CanvasNodeResponse updated = new CanvasNodeResponse(
                            node.id(),
                            node.type(),
                            node.title(),
                            node.status(),
                            position,
                            node.data(),
                            node.output(),
                            Instant.now()
                    );
                    canvas.nodes.set(index, updated);
                    canvas.updatedAt = Instant.now();
                    return updated;
                }
            }
        }
        throw new IllegalArgumentException("canvas node not found: " + nodeId);
    }

    public CanvasEdgeResponse addEdge(String canvasId, String source, String target) {
        MutableCanvas canvas = requireCanvas(canvasId);
        synchronized (canvas) {
            for (CanvasEdgeResponse edge : canvas.edges) {
                if (edge.source().equals(source) && edge.target().equals(target)) {
                    return edge;
                }
            }
            CanvasEdgeResponse edge = new CanvasEdgeResponse(
                    IdGenerator.id("edge_"),
                    source,
                    target
            );
            canvas.edges.add(edge);
            canvas.updatedAt = Instant.now();
            return edge;
        }
    }

    private MutableCanvas requireCanvas(String canvasId) {
        MutableCanvas canvas = canvases.get(canvasId);
        if (canvas == null) {
            throw new IllegalArgumentException("canvas not found: " + canvasId);
        }
        return canvas;
    }

    private static final class MutableCanvas {
        private final String id;
        private final String projectId;
        private final List<CanvasNodeResponse> nodes = new ArrayList<>();
        private final List<CanvasEdgeResponse> edges = new ArrayList<>();
        private Instant updatedAt = Instant.now();

        private MutableCanvas(String id, String projectId) {
            this.id = id;
            this.projectId = projectId;
        }

        private synchronized CanvasResponse toResponse() {
            return new CanvasResponse(id, projectId, List.copyOf(nodes), List.copyOf(edges), updatedAt);
        }
    }
}
