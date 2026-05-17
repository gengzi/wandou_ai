package com.wandou.ai.modelconfig;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "wandou.ai.siliconflow.api-key=test-siliconflow-key")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SiliconFlowModelConfigIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void seedsSiliconFlowKolorsImageModelWhenApiKeyIsConfigured() throws Exception {
        String token = login("admin@wandou.ai", "Wandou@123456");

        mockMvc.perform(get("/api/model-configs")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].provider", hasItem("siliconflow")))
                .andExpect(jsonPath("$.data[*].displayName", hasItem("SiliconFlow Kolors")))
                .andExpect(jsonPath("$.data[*].baseUrl", hasItem("https://api.siliconflow.cn")))
                .andExpect(jsonPath("$.data[*].modelName", hasItem("Kwai-Kolors/Kolors")))
                .andExpect(jsonPath("$.data[*].compatibilityMode", hasItem("openai")));
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
