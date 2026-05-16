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

        createUserIfMissing("usr_admin", "Wandou Admin", "admin@wandou.ai", Set.of(admin));
        createUserIfMissing("usr_editor", "Wandou Editor", "editor@wandou.ai", Set.of(editor));
        createUserIfMissing("usr_viewer", "Wandou Viewer", "viewer@wandou.ai", Set.of(viewer));
        createTestModelConfigsIfNeeded();
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
        if (modelConfigRepository.findFirstByUserIdAndCapabilityAndEnabledTrueOrderByUpdatedAtDesc("usr_admin", "text").isEmpty()) {
            modelConfigRepository.save(new ModelConfigEntity("model_cfg_test_text", "usr_admin", "text", "test", "Test Text Model", "mock://text", "test-text", "test-key", true, now, now));
        }
        if (modelConfigRepository.findFirstByUserIdAndCapabilityAndEnabledTrueOrderByUpdatedAtDesc("usr_admin", "image").isEmpty()) {
            modelConfigRepository.save(new ModelConfigEntity("model_cfg_test_image", "usr_admin", "image", "test", "Test Image Model", "mock://image", "test-image", "test-key", true, now, now));
        }
    }
}
