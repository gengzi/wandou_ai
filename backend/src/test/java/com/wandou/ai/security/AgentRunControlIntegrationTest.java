package com.wandou.ai.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigRepository;
import com.wandou.ai.user.UserAccount;
import com.wandou.ai.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.LinkedHashSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AgentRunControlIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ModelConfigRepository modelConfigRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void agentScopeRunWaitsForConfirmationsAndCompletes() throws Exception {
        String token = login();
        JsonNode project = createProject(token);

        String runId = startRun(token, project.path("id").asText(), project.path("canvasId").asText(), project.path("conversationId").asText());

        JsonNode firstCheckpoint = awaitStatus(token, runId, "waiting_confirmation");
        assertThat(firstCheckpoint.path("checkpoint").asText()).isEqualTo("script");
        assertEvent(firstCheckpoint, "agent.step.completed");
        assertEvent(firstCheckpoint, "agent.confirmation.required");

        confirm(token, runId, "剧本可以，继续。");
        JsonNode secondCheckpoint = awaitStatus(token, runId, "waiting_confirmation");
        assertThat(secondCheckpoint.path("checkpoint").asText()).isEqualTo("storyboard");

        confirm(token, runId, "角色和分镜通过。");
        JsonNode completed = awaitStatus(token, runId, "success");
        assertEvent(completed, "asset.created");
        assertEvent(completed, "run.completed");
        assertEvent(completed, "run.monitor.updated");
        assertThat(completed.path("monitor").path("eventCount").asInt()).isGreaterThan(0);
        assertThat(completed.path("monitor").path("steps").findValuesAsText("step")).contains("script", "export");
        assertThat(completed.path("monitor").path("designSignals").size()).isGreaterThan(0);

        mockMvc.perform(get("/api/tasks")
                        .header("Authorization", "Bearer " + token)
                        .param("projectId", project.path("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("success"))
                .andExpect(jsonPath("$.data[0].progress").value(100));

        String assetsResponse = mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + token)
                        .param("projectId", project.path("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].type").value("video"))
                .andExpect(jsonPath("$.data[0].url").value(org.hamcrest.Matchers.containsString("/api/assets/")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String assetId = objectMapper.readTree(assetsResponse).path("data").path(0).path("id").asText();
        mockMvc.perform(get("/api/assets/{assetId}/content", assetId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsByteArray()).isNotEmpty());
    }

    @Test
    void agentScopeRunCanBeInterruptedAndCancelled() throws Exception {
        String token = login();
        JsonNode project = createProject(token);

        String runId = startRun(token, project.path("id").asText(), project.path("canvasId").asText(), project.path("conversationId").asText());
        awaitStatus(token, runId, "waiting_confirmation");

        mockMvc.perform(post("/api/agent/runs/{runId}/interrupt", runId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"comment":"先暂停，我要调整方向"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("interrupted"));

        JsonNode interrupted = awaitStatus(token, runId, "interrupted");
        assertEvent(interrupted, "run.interrupted");

        mockMvc.perform(post("/api/agent/runs/{runId}/cancel", runId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"comment":"本次不继续"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("cancelled"));

        JsonNode cancelled = awaitStatus(token, runId, "cancelled");
        assertEvent(cancelled, "run.cancelled");
    }

    @Test
    void mockVideoProviderFailureMarksRunAndTaskFailed() throws Exception {
        String token = login();
        JsonNode project = createProject(token);

        String runId = startRun(
                token,
                project.path("id").asText(),
                project.path("canvasId").asText(),
                project.path("conversationId").asText(),
                "生成一个 __fail_video__ 测试视频"
        );

        awaitStatus(token, runId, "waiting_confirmation");
        confirm(token, runId, "剧本可以，继续。");
        awaitStatus(token, runId, "waiting_confirmation");
        confirm(token, runId, "角色和分镜通过。");

        JsonNode failed = awaitStatus(token, runId, "failed");
        assertEvent(failed, "task.failed");
        assertEvent(failed, "run.failed");

        mockMvc.perform(get("/api/tasks")
                        .header("Authorization", "Bearer " + token)
                        .param("projectId", project.path("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("failed"));
    }

    @Test
    void agentScopeRunCompletesWhenImageModelIsNotConfigured() throws Exception {
        createEditorTextModelConfigOnly();
        String token = login("editor@wandou.ai", "Wandou@123456");
        JsonNode project = createProject(token);

        String runId = startRun(token, project.path("id").asText(), project.path("canvasId").asText(), project.path("conversationId").asText());

        awaitStatus(token, runId, "waiting_confirmation");
        confirm(token, runId, "剧本可以，继续。");
        awaitStatus(token, runId, "waiting_confirmation");
        confirm(token, runId, "角色和分镜通过。");

        JsonNode completed = awaitStatus(token, runId, "success");
        assertEvent(completed, "run.completed");

        mockMvc.perform(get("/api/tasks")
                        .header("Authorization", "Bearer " + token)
                        .param("projectId", project.path("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("success"));
    }

    @Test
    void assetContentRequiresLoginAndPermission() throws Exception {
        String adminToken = login();
        JsonNode project = createProject(adminToken);
        String runId = startRun(adminToken, project.path("id").asText(), project.path("canvasId").asText(), project.path("conversationId").asText());

        awaitStatus(adminToken, runId, "waiting_confirmation");
        confirm(adminToken, runId, "剧本可以，继续。");
        awaitStatus(adminToken, runId, "waiting_confirmation");
        confirm(adminToken, runId, "角色和分镜通过。");
        awaitStatus(adminToken, runId, "success");

        String assetsResponse = mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("projectId", project.path("id").asText()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String assetId = objectMapper.readTree(assetsResponse).path("data").path(0).path("id").asText();

        mockMvc.perform(get("/api/assets/{assetId}/content", assetId))
                .andExpect(status().isUnauthorized());

        String editorToken = login("viewer@wandou.ai", "Wandou@123456");
        mockMvc.perform(get("/api/assets/{assetId}/content", assetId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk());

        createNoPermissionUser();
        String noPermissionToken = login("no-assets@wandou.ai", "Wandou@123456");
        mockMvc.perform(get("/api/assets/{assetId}/content", assetId)
                        .header("Authorization", "Bearer " + noPermissionToken))
                .andExpect(status().isForbidden());
    }

    private String login() throws Exception {
        return login("admin@wandou.ai", "Wandou@123456");
    }

    private String login(String email, String password) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(response).path("data").path("tokenValue").asText();
    }

    private JsonNode createProject(String token) throws Exception {
        String response = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"AgentScope Control Test","description":"multi agent flow","aspectRatio":"16:9"}
                                """))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data");
    }

    private String startRun(String token, String projectId, String canvasId, String conversationId) throws Exception {
        return startRun(token, projectId, canvasId, conversationId, "生成一个太空站少女和机器伙伴的 8 秒视频");
    }

    private String startRun(String token, String projectId, String canvasId, String conversationId, String message) throws Exception {
        String response = mockMvc.perform(post("/api/agent/runs")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectId":"%s",
                                  "canvasId":"%s",
                                  "conversationId":"%s",
                                  "message":"%s",
                                  "agentName":"导演"
                                }
                                """.formatted(projectId, canvasId, conversationId, message)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).path("data").path("runId").asText();
    }

    private void confirm(String token, String runId, String comment) throws Exception {
        mockMvc.perform(post("/api/agent/runs/{runId}/confirm", runId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"comment":"%s"}
                                """.formatted(comment)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("running"));
    }

    private JsonNode awaitStatus(String token, String runId, String status) throws Exception {
        JsonNode detail = null;
        for (int i = 0; i < 40; i++) {
            String response = mockMvc.perform(get("/api/agent/runs/{runId}", runId)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            detail = objectMapper.readTree(response).path("data");
            if (status.equals(detail.path("status").asText())) {
                return detail;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("run did not reach status " + status + ", last detail: " + detail);
    }

    private void assertEvent(JsonNode detail, String eventName) {
        assertThat(detail.path("events").findValuesAsText("event")).contains(eventName);
    }

    private void createNoPermissionUser() {
        if (userRepository.existsByEmail("no-assets@wandou.ai")) {
            return;
        }
        userRepository.save(new UserAccount(
                "usr_no_assets",
                "No Assets",
                "no-assets@wandou.ai",
                passwordEncoder.encode("Wandou@123456"),
                new LinkedHashSet<>(),
                true,
                Instant.now(),
                null
        ));
    }

    private void createEditorTextModelConfigOnly() {
        if (modelConfigRepository.findFirstByUserIdAndCapabilityAndEnabledTrueOrderByUpdatedAtDesc("usr_editor", "text").isPresent()) {
            return;
        }
        Instant now = Instant.now();
        modelConfigRepository.save(new ModelConfigEntity(
                "model_cfg_editor_text",
                "usr_editor",
                "text",
                "test",
                "Editor Test Text Model",
                "mock://text",
                "test-text",
                "openai",
                "test-key",
                true,
                now,
                now
        ));
    }
}
