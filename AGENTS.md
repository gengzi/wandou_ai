# Project Memory

## Security and Authorization

- This project is an enterprise-oriented application. Authentication and authorization must be built on mature frameworks instead of custom security logic.
- Backend authentication and authorization should prefer Sa-Token for the current product stage. It is lighter and more ergonomic for Spring Boot front-end/back-end separated applications than a full Spring Security OAuth stack.
- Sa-Token should own login state, token handling, route interception, role checks, permission checks, logout, and future SSO/OAuth2 integration points.
- Role and permission checks should be modeled as Sa-Token roles and permissions, enforced through Sa-Token interceptors or annotations. Do not scatter manual permission `if` checks in controllers.
- Password hashing must use a mature password encoder such as BCrypt. Do not store or compare raw passwords.
- User, role, and permission data should be persisted in PostgreSQL with Flyway-managed schema migrations. In-memory identity stores are only acceptable in focused tests.
- Authentication and authorization changes must include integration tests that prove login, unauthorized access, and forbidden permissions.
- Keep the domain model independent from Sa-Token so the identity source can later be replaced by OIDC/SSO without rewriting business permissions.
- For enterprise SSO/OIDC, prefer integrating a standard identity provider such as Keycloak, Microsoft Entra ID, Auth0, Okta, or another OIDC-compatible provider through Sa-Token SSO/OAuth2 or a dedicated resource-server layer when needed.
- Frontend authentication state should consume the backend login flow and attach access tokens through a centralized API client. Avoid duplicating security policy in the UI; backend enforcement is authoritative.
