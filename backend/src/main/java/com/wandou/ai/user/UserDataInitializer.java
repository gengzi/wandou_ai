package com.wandou.ai.user;

import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class UserDataInitializer implements ApplicationRunner {

    private static final String DEFAULT_PASSWORD = "Wandou@123456";
    private static final String ADMIN_USER_ID = "usr_admin";
    private static final String SILICONFLOW_KOLORS_CONFIG_ID = "model_cfg_siliconflow_kolors";
    private static final String SILICONFLOW_KOLORS_BASE_URL = "https://api.siliconflow.cn";
    private static final String SILICONFLOW_KOLORS_MODEL = "Kwai-Kolors/Kolors";

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final ModelConfigRepository modelConfigRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    public UserDataInitializer(PermissionRepository permissionRepository, RoleRepository roleRepository, UserRepository userRepository, ModelConfigRepository modelConfigRepository, PasswordEncoder passwordEncoder, Environment environment) {
        this.permissionRepository = permissionRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.modelConfigRepository = modelConfigRepository;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Permission> permissions = List.of(
                permission("project:read", "Read projects"),
                permission("project:write", "Write projects"),
                permission("canvas:read", "Read canvas"),
                permission("canvas:write", "Write canvas"),
                permission("conversation:read", "Read conversations"),
                permission("agent:run", "Run agents"),
                permission("asset:read", "Read assets"),
                permission("asset:write", "Write assets"),
                permission("task:read", "Read tasks"),
                permission("model:read", "Read model configs"),
                permission("model:write", "Write model configs"),
                permission("user:read", "Read users"),
                permission("user:write", "Write users")
        );
        permissionRepository.saveAll(permissions);

        Role admin = role("admin", "Administrator", permissions);
        Role editor = role("editor", "Editor", permissions.stream()
                .filter(permission -> !permission.code().startsWith("user:"))
                .toList());
        Role viewer = role("viewer", "Viewer", permissions.stream()
                .filter(permission -> permission.code().endsWith(":read") && !permission.code().startsWith("user:"))
                .toList());
        roleRepository.saveAll(List.of(admin, editor, viewer));

        createUserIfMissing(ADMIN_USER_ID, "Wandou Admin", "admin@wandou.ai", Set.of(admin));
        createUserIfMissing("usr_editor", "Wandou Editor", "editor@wandou.ai", Set.of(editor));
        createUserIfMissing("usr_viewer", "Wandou Viewer", "viewer@wandou.ai", Set.of(viewer));
        createTestModelConfigsIfNeeded();
        createSiliconFlowKolorsConfigIfConfigured();
    }

    private Permission permission(String code, String name) {
        return permissionRepository.findById(code).orElseGet(() -> new Permission(code, name));
    }

    private Role role(String code, String name, List<Permission> permissions) {
        Role existing = roleRepository.findById(code).orElse(null);
        return new Role(
                code,
                existing == null ? name : existing.name(),
                new LinkedHashSet<>(permissions)
        );
    }

    private void createUserIfMissing(String id, String name, String email, Set<Role> roles) {
        if (userRepository.existsByEmail(email)) {
            return;
        }
        userRepository.save(new UserAccount(
                id,
                name,
                email,
                passwordEncoder.encode(DEFAULT_PASSWORD),
                roles,
                true,
                Instant.now(),
                null
        ));
    }

    private void createTestModelConfigsIfNeeded() {
        if (!environment.acceptsProfiles(Profiles.of("test"))) {
            return;
        }
        Instant now = Instant.now();
        if (modelConfigRepository.findFirstByUserIdAndCapabilityAndEnabledTrueOrderByUpdatedAtDesc(ADMIN_USER_ID, "text").isEmpty()) {
            modelConfigRepository.save(new ModelConfigEntity("model_cfg_test_text", ADMIN_USER_ID, "text", "test", "Test Text Model", "mock://text", "test-text", "openai", "test-key", true, now, now));
        }
        if (modelConfigRepository.findFirstByUserIdAndCapabilityAndEnabledTrueOrderByUpdatedAtDesc(ADMIN_USER_ID, "image").isEmpty()) {
            modelConfigRepository.save(new ModelConfigEntity("model_cfg_test_image", ADMIN_USER_ID, "image", "test", "Test Image Model", "mock://image", "test-image", "openai", "test-key", true, now, now));
        }
    }

    private void createSiliconFlowKolorsConfigIfConfigured() {
        String apiKey = configuredValue("wandou.ai.siliconflow.api-key", "WANDOU_AI_SILICONFLOW_API_KEY");
        if (apiKey.isBlank() || modelConfigRepository.existsById(SILICONFLOW_KOLORS_CONFIG_ID)) {
            return;
        }
        Instant now = Instant.now();
        modelConfigRepository.save(new ModelConfigEntity(
                SILICONFLOW_KOLORS_CONFIG_ID,
                ADMIN_USER_ID,
                "image",
                "siliconflow",
                "SiliconFlow Kolors",
                SILICONFLOW_KOLORS_BASE_URL,
                SILICONFLOW_KOLORS_MODEL,
                "openai",
                apiKey,
                true,
                now,
                now
        ));
    }

    private String configuredValue(String propertyName, String environmentName) {
        String propertyValue = environment.getProperty(propertyName, "");
        if (propertyValue != null && !propertyValue.isBlank()) {
            return propertyValue.trim();
        }
        return environment.getProperty(environmentName, "").trim();
    }
}
