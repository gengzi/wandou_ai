package com.wandou.ai.conversation;

import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.conversation.dto.MessageResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ConversationService {

    private final Map<String, MutableConversation> conversations = new ConcurrentHashMap<>();

    public ConversationResponse create(String projectId) {
        String conversationId = IdGenerator.id("conv_");
        MutableConversation conversation = new MutableConversation(conversationId, projectId);
        conversations.put(conversationId, conversation);
        return conversation.toResponse();
    }

    public ConversationResponse getOrCreate(String conversationId, String projectId) {
        if (conversationId == null || conversationId.isBlank()) {
            return create(projectId);
        }
        return conversations.computeIfAbsent(conversationId, id -> new MutableConversation(id, projectId)).toResponse();
    }

    public Optional<ConversationResponse> get(String conversationId) {
        MutableConversation conversation = conversations.get(conversationId);
        return conversation == null ? Optional.empty() : Optional.of(conversation.toResponse());
    }

    public MessageResponse addMessage(String conversationId, String projectId, String role, String sender, String content) {
        MutableConversation conversation = conversations.computeIfAbsent(
                conversationId,
                id -> new MutableConversation(id, projectId)
        );
        MessageResponse message = new MessageResponse(
                IdGenerator.id("msg_"),
                conversationId,
                role,
                sender,
                content,
                Instant.now()
        );
        synchronized (conversation) {
            conversation.messages.add(message);
            conversation.updatedAt = Instant.now();
        }
        return message;
    }

    private static final class MutableConversation {
        private final String id;
        private final String projectId;
        private final List<MessageResponse> messages = new ArrayList<>();
        private Instant updatedAt = Instant.now();

        private MutableConversation(String id, String projectId) {
            this.id = id;
            this.projectId = projectId;
        }

        private synchronized ConversationResponse toResponse() {
            return new ConversationResponse(id, projectId, List.copyOf(messages), updatedAt);
        }
    }
}
