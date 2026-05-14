package com.wandou.ai.user;

import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.user.dto.InviteUserRequest;
import com.wandou.ai.user.dto.UserResponse;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class UserService {

    private static final String DEFAULT_PASSWORD = "Wandou@123456";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Optional<UserAccount> authenticate(String email, String password) {
        return findByEmail(email)
                .filter(UserAccount::active)
                .filter(user -> passwordEncoder.matches(password, user.passwordHash()))
                .map(user -> {
                    user.markLoggedIn(Instant.now());
                    return userRepository.save(user);
                });
    }

    public Optional<UserAccount> findById(String id) {
        return userRepository.findById(id);
    }

    public Optional<UserAccount> findByEmail(String email) {
        return userRepository.findByEmail(normalizeEmail(email));
    }

    public List<UserResponse> list() {
        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public UserResponse invite(InviteUserRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("user already exists");
        }

        Set<Role> roles = rolesByCode(Set.of(request.role()));
        UserAccount user = new UserAccount(
                IdGenerator.id("usr_"),
                request.name(),
                email,
                passwordEncoder.encode(DEFAULT_PASSWORD),
                roles,
                true,
                Instant.now(),
                null
        );
        return toResponse(userRepository.save(user));
    }

    public List<String> rolesOf(String userId) {
        return findById(userId)
                .map(UserAccount::roles)
                .stream()
                .flatMap(Set::stream)
                .map(Role::code)
                .toList();
    }

    public List<String> permissionsOf(String userId) {
        return findById(userId)
                .map(this::permissionCodes)
                .orElseGet(List::of);
    }

    public UserResponse toResponse(UserAccount user) {
        return new UserResponse(
                user.id(),
                user.name(),
                user.email(),
                user.roles().stream().map(Role::code).sorted().toList(),
                permissionCodes(user),
                user.active() ? "active" : "disabled",
                user.createdAt(),
                user.lastLoginAt()
        );
    }

    private List<String> permissionCodes(UserAccount user) {
        return user.roles().stream()
                .flatMap(role -> role.permissions().stream())
                .map(Permission::code)
                .distinct()
                .sorted()
                .toList();
    }

    private Set<Role> rolesByCode(Set<String> roleCodes) {
        Set<Role> roles = new LinkedHashSet<>();
        for (String roleCode : roleCodes) {
            String normalized = normalizeRole(roleCode);
            roleRepository.findById(normalized).ifPresent(roles::add);
        }
        if (roles.isEmpty()) {
            roleRepository.findById("viewer").ifPresent(roles::add);
        }
        return roles;
    }

    private String normalizeRole(String role) {
        return role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
