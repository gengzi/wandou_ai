package com.wandou.ai.conversation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "conversation_messages")
public class ConversationMessageEntity {

    @Id
    private String id;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String sender;

    @Column(nullable = false)
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ConversationMessageEntity() {
    }

    public ConversationMessageEntity(String id, String conversationId, String projectId, String role, String sender, String content, Instant createdAt) {
        this.id = id;
        this.conversationId = conversationId;
        this.projectId = projectId;
        this.role = role;
        this.sender = sender;
        this.content = content;
        this.createdAt = createdAt;
    }

    public String id() { return id; }
    public String conversationId() { return conversationId; }
    public String projectId() { return projectId; }
    public String role() { return role; }
    public String sender() { return sender; }
    public String content() { return content; }
    public Instant createdAt() { return createdAt; }
}
