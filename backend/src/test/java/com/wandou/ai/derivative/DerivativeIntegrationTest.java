package com.wandou.ai.derivative;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayInputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipInputStream;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DerivativeIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createTshirtDerivativeWritesAssetsNodeAndPrintPackage() throws Exception {
        String token = login("admin@wandou.ai", "Wandou@123456");
        JsonNode project = createProject(token);
        String sourceAssetId = createSourceAsset(token, project);

        String response = mockMvc.perform(post("/api/derivatives")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceAssetId":"%s",
                                  "kind":"tshirt_print",
                                  "prompt":"正面大图，保留角色标志性配色",
                                  "settings":{"size":"30cm x 40cm","technique":"DTF"}
                                }
                                """.formatted(sourceAssetId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.asset.type").value("derivative"))
                .andExpect(jsonPath("$.data.asset.purpose").value("derivative_design"))
                .andExpect(jsonPath("$.data.asset.metadata.sourceAssetId").value(sourceAssetId))
                .andExpect(jsonPath("$.data.mockupAsset.purpose").value("derivative_mockup"))
                .andExpect(jsonPath("$.data.printAsset.type").value("print"))
                .andExpect(jsonPath("$.data.printAsset.purpose").value("print_package"))
                .andExpect(jsonPath("$.data.node.type").value("derivative"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode data = objectMapper.readTree(response).path("data");
        String printAssetId = data.path("printAsset").path("id").asText();

        byte[] packageBytes = mockMvc.perform(get("/api/assets/{assetId}/content", printAssetId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray();

        assertZipContains(packageBytes, Set.of("artwork.png", "mockup.png", "spec.txt"));

        mockMvc.perform(get("/api/assets")
                        .header("Authorization", "Bearer " + token)
                        .param("projectId", project.path("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].purpose", hasItem("print_package")));
    }

    @Test
    void createModelPreviewCreatesWaitingModelAssetWithoutPrintPackage() throws Exception {
        String token = login("admin@wandou.ai", "Wandou@123456");
        JsonNode project = createProject(token);
        String sourceAssetId = createSourceAsset(token, project);

        mockMvc.perform(post("/api/derivatives")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceAssetId":"%s","kind":"model_preview"}
                                """.formatted(sourceAssetId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.asset.type").value("model"))
                .andExpect(jsonPath("$.data.asset.purpose").value("model_preview"))
                .andExpect(jsonPath("$.data.asset.metadata.kind").value("model_preview"))
                .andExpect(jsonPath("$.data.printAsset").value(nullValue()))
                .andExpect(jsonPath("$.data.node.output.status").value("waiting_upload"));
    }

    @Test
    void derivativeCreationRequiresLoginAndAssetWritePermission() throws Exception {
        mockMvc.perform(post("/api/derivatives")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceAssetId":"asset_missing","kind":"tshirt_print"}
                                """))
                .andExpect(status().isUnauthorized());

        String viewerToken = login("viewer@wandou.ai", "Wandou@123456");
        mockMvc.perform(post("/api/derivatives")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceAssetId":"asset_missing","kind":"tshirt_print"}
                                """))
                .andExpect(status().isForbidden());
    }

    private JsonNode createProject(String token) throws Exception {
        String projectJson = mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Derivative Test","description":"角色衍生测试","aspectRatio":"1:1"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(projectJson).path("data");
    }

    private String createSourceAsset(String token, JsonNode project) throws Exception {
        String assetJson = mockMvc.perform(post("/api/assets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectId":"%s",
                                  "canvasId":"%s",
                                  "nodeId":"script-1",
                                  "type":"character",
                                  "name":"小豌豆",
                                  "url":"https://example.com/character.png",
                                  "thumbnailUrl":"https://example.com/character-thumb.png",
                                  "purpose":"character_reference"
                                }
                                """.formatted(project.path("id").asText(), project.path("canvasId").asText())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(assetJson).path("data").path("id").asText();
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

    private static void assertZipContains(byte[] bytes, Set<String> expectedNames) throws Exception {
        Set<String> names = new HashSet<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                names.add(entry.getName());
            }
        }
        if (!names.containsAll(expectedNames)) {
            throw new AssertionError("ZIP entries " + names + " did not contain " + expectedNames);
        }
    }
}
