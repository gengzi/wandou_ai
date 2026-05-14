package com.wandou.ai.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AppCapabilitiesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void adminCanUseWorkspaceAssetsAndUserCapabilities() throws Exception {
        String token = login("admin@wandou.ai", "Wandou@123456");

        String projectJson = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Capability Test","description":"workspace flow","aspectRatio":"16:9"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode project = objectMapper.readTree(projectJson).path("data");
        String canvasId = project.path("canvasId").asText();

        mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].name", hasItem("Capability Test")));

        mockMvc.perform(patch("/api/canvas/{canvasId}/nodes/{nodeId}/position", canvasId, "script-1")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"position":{"x":220,"y":180}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.position.x").value(220));

        mockMvc.perform(post("/api/canvas/{canvasId}/edges", canvasId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"source":"script-1","target":"img-1"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("script-1"))
                .andExpect(jsonPath("$.data.target").value("img-1"));

        mockMvc.perform(post("/api/assets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectId":"%s",
                                  "canvasId":"%s",
                                  "nodeId":"img-1",
                                  "type":"image",
                                  "name":"Reference Image",
                                  "url":"https://example.com/reference.png"
                                }
                                """.formatted(project.path("id").asText(), canvasId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.thumbnailUrl").value("https://example.com/reference.png"));

        mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + token)
                        .param("projectId", project.path("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].name", hasItem("Reference Image")));

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Viewer One","email":"viewer.one@wandou.ai","role":"viewer"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("viewer.one@wandou.ai"))
                .andExpect(jsonPath("$.data.roles[0]").value("viewer"));
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
}
