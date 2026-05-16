# Wandou AI

Wandou AI 是一个 AI 视频创作工作台原型，前端使用 React + Vite，根目录的 Node/Express 服务负责托管前端，并代理 Spring Boot API 与 Gemini 聊天接口，`backend/` 目录是 Spring Boot API 服务，提供项目、画布和 Agent Run/SSE 等后端接口。

## 工程结构

```text
.
├── src/                    # React 前端
├── server.ts               # Node/Express 前端托管、/api 后端代理与 /api/chat 代理
├── backend/                # Spring Boot 后端服务
├── Dockerfile              # 前端/Node 服务镜像
├── backend/Dockerfile      # 后端服务镜像
└── docker-compose.yml      # 本地一键启动前后端
```

## 端口与服务

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| PostgreSQL | `5432` | 用户、角色、权限等持久化数据 |
| Web/Node | `3000` 容器内，默认映射到宿主机 `3001` | 访问入口，生产模式下托管 Vite 构建产物，并代理 `/api` |
| Backend | `8080` | Spring Boot API，包含项目、会话、画布、任务、资产、Agent Run/SSE、健康检查 |

## 后端设计

后端当前使用内存仓库，方便本地和 Docker 直接启动测试；服务边界按后续接入数据库、队列和真实模型服务预留：

| 模块 | 职责 |
| --- | --- |
| Project | 创建和查询创作项目，项目会绑定默认画布和默认会话 |
| Canvas | 维护画布节点和连线，Agent Run 会把生成过程同步为节点状态 |
| Conversation | 保存用户和 Agent 消息，支持按会话查询历史 |
| Agent Run | 创建异步运行任务，提供状态查询和 SSE 事件流 |
| Task | 保存视频/素材生成任务进度 |
| Asset | 保存生成资产元数据 |
| LLM Provider | 当前默认 mock，可通过 provider 边界替换真实模型调用 |

## 认证与权限

后端使用 Sa-Token 作为认证和权限框架，用户、角色、权限通过 PostgreSQL 持久化，数据库结构由 Flyway 管理。默认启动时会创建两个演示账号：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `admin@wandou.ai` | `Wandou@123456` | `admin` |
| `editor@wandou.ai` | `Wandou@123456` | `editor` |

权限模型为 `user -> role -> permission`，接口通过 Sa-Token 注解和拦截器统一保护。前端登录后会在请求中附加 `Authorization: Bearer <token>`。

核心接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | 登录并获取 Sa-Token |
| `POST` | `/api/auth/logout` | 退出登录 |
| `GET` | `/api/auth/me` | 当前登录用户 |
| `GET` | `/api/users` | 用户列表，需要 `user:read` |
| `POST` | `/api/users` | 邀请用户，需要 `user:write` |
| `POST` | `/api/projects` | 创建项目，同时生成 `canvasId` 和 `conversationId` |
| `GET` | `/api/projects` | 项目列表 |
| `GET` | `/api/projects/{projectId}` | 项目详情 |
| `GET` | `/api/canvas/{canvasId}` | 画布详情 |
| `PATCH` | `/api/canvas/{canvasId}/nodes/{nodeId}/position` | 保存画布节点位置，需要 `canvas:write` |
| `POST` | `/api/canvas/{canvasId}/edges` | 保存画布连线，需要 `canvas:write` |
| `GET` | `/api/conversations/{conversationId}` | 会话和消息详情 |
| `POST` | `/api/agent/runs` | 启动 Agent Run |
| `GET` | `/api/agent/runs/{runId}` | 查询 Run 状态和历史事件 |
| `GET` | `/api/agent/runs/{runId}/events` | SSE 事件流，支持历史事件回放 |
| `GET` | `/api/tasks?projectId=...` | 任务列表 |
| `GET` | `/api/assets?projectId=...` | 资产列表 |
| `POST` | `/api/assets` | 登记素材元数据，需要 `asset:write` |

## 使用 Docker Compose 启动

需要先安装 Docker Desktop 或 Docker Engine + Docker Compose。

```bash
docker compose up --build
```

启动后访问：

- 前端页面：http://localhost:3001
- 后端健康检查：http://localhost:8080/actuator/health

如需修改宿主机端口：

```bash
WEB_PORT=3002 BACKEND_PORT=8081 docker compose up --build
```

如果 Docker Hub 拉取基础镜像较慢或被网络限制，可通过环境变量替换基础镜像源：

```bash
NODE_IMAGE="node:22-alpine" \
MAVEN_IMAGE="maven:3.9.9-eclipse-temurin-17" \
JRE_IMAGE="eclipse-temurin:17-jre" \
docker compose build
```

基础接口测试：

```bash
curl http://localhost:8080/actuator/health

TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wandou.ai","password":"Wandou@123456"}' | jq -r '.data.tokenValue')

curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"测试项目","description":"Docker Compose smoke test","aspectRatio":"16:9"}'

curl -X POST http://localhost:8080/api/agent/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"生成一个宇宙少女短片","agentName":"导演"}'
```

完整链路测试示例：

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wandou.ai","password":"Wandou@123456"}' | jq -r '.data.tokenValue')

PROJECT_JSON=$(curl -s -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"测试项目","description":"Backend smoke test","aspectRatio":"16:9"}')

PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.data.id')
CANVAS_ID=$(echo "$PROJECT_JSON" | jq -r '.data.canvasId')
CONVERSATION_ID=$(echo "$PROJECT_JSON" | jq -r '.data.conversationId')

RUN_JSON=$(curl -s -X POST http://localhost:8080/api/agent/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"canvasId\":\"$CANVAS_ID\",\"conversationId\":\"$CONVERSATION_ID\",\"message\":\"生成一个宇宙少女短片\",\"agentName\":\"导演\"}")

RUN_ID=$(echo "$RUN_JSON" | jq -r '.data.runId')
sleep 6

curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/agent/runs/$RUN_ID" | jq
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/canvas/$CANVAS_ID" | jq
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/conversations/$CONVERSATION_ID" | jq
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/tasks?projectId=$PROJECT_ID" | jq
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/assets?projectId=$PROJECT_ID" | jq
```

也可以运行脚本化 smoke test：

```bash
npm run smoke:backend
```

`/api/chat` 会调用 Gemini。只浏览页面和测试 Spring Boot mock 接口不需要配置密钥；如果要测试聊天代理，请在启动前设置：

```bash
export GEMINI_API_KEY="你的 Gemini API Key"
docker compose up --build
```

停止服务：

```bash
docker compose down
```

## 本地开发启动

前端/Node 服务：

```bash
npm install
npm run dev
```

后端服务：

```bash
cd backend
mvn spring-boot:run
```

默认前端访问 `http://localhost:3000`，后端访问 `http://localhost:8080`。如果本机 `3000` 被占用，可用 `PORT=3001 npm run dev`。开发时浏览器默认调用同源 `/api`，Vite 会代理到 `http://localhost:8080`。如需调整 Vite 代理的后端地址，可设置：

```bash
VITE_BACKEND_URL="http://localhost:8081"
```

生产或 `npm run dev` 的 Node/Express 入口会使用 `BACKEND_URL` 代理 Spring Boot API：

```bash
BACKEND_URL="http://localhost:8080"
```

## 构建与检查

```bash
npm run build
npm run lint

cd backend
mvn -DskipTests package
mvn test
```

## 许可

本项目为专有软件，保留所有权利。未经版权持有人事先书面授权，不得使用、复制、修改、合并、发布、分发、再许可、部署、托管、销售或以其他方式利用本项目的软件和源代码。

授权使用时必须遵守适用的书面协议；如无单独书面协议，则不得出于任何目的使用本软件。第三方依赖仍受其各自许可证条款约束。
