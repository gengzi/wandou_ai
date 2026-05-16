package com.wandou.ai.conversation;

import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.conversation.dto.MessageResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;

    public ConversationService(ConversationRepository conversationRepository, ConversationMessageRepository messageRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional
    public ConversationResponse create(String projectId) {
        Instant now = Instant.now();
        ConversationEntity conversation = conversationRepository.save(new ConversationEntity(
                IdGenerator.id("conv_"),
                projectId,
                now,
                now
        ));
        return toResponse(conversation);
    }

    @Transactional
    public ConversationResponse getOrCreate(String conversationId, String projectId) {
        if (conversationId == null || conversationId.isBlank()) {
            return create(projectId);
        }
        return conversationRepository.findById(conversationId)
                .map(this::toResponse)
                .orElseGet(() -> toResponse(createEntity(conversationId, projectId)));
    }

    public Optional<ConversationResponse> get(String conversationId) {
        return conversationRepository.findById(conversationId).map(this::toResponse);
    }

    @Transactional
    public MessageResponse addMessage(String conversationId, String projectId, String role, String sender, String content) {
        ConversationEntity conversation = conversationRepository.findById(conversationId)
                .orElseGet(() -> createEntity(conversationId, projectId));
        Instant now = Instant.now();
        ConversationMessageEntity message = messageRepository.save(new ConversationMessageEntity(
                IdGenerator.id("msg_"),
                conversation.id(),
                projectId,
                role,
                sender,
                content,
                now
        ));
        conversation.touch(now);
        conversationRepository.save(conversation);
        return toMessageResponse(message);
    }

    private ConversationEntity createEntity(String conversationId, String projectId) {
        Instant now = Instant.now();
        return conversationRepository.save(new ConversationEntity(conversationId, projectId, now, now));
    }

    private ConversationResponse toResponse(ConversationEntity conversation) {
        List<MessageResponse> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversation.id()).stream()
                .map(this::toMessageResponse)
                .toList();
        return new ConversationResponse(conversation.id(), conversation.projectId(), messages, conversation.updatedAt());
    }

    private MessageResponse toMessageResponse(ConversationMessageEntity message) {
        return new MessageResponse(
                message.id(),
                message.conversationId(),
                message.role(),
                message.sender(),
                message.content(),
                message.createdAt()
        );
    }
}
