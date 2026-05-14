# Wandou AI

Wandou AI 是一个 AI 视频创作工作台原型，前端使用 React + Vite，根目录的 Node/Express 服务负责托管前端并代理 Gemini 聊天接口，`backend/` 目录是 Spring Boot API 服务，提供项目、画布和 Agent Run/SSE 等后端接口。

## 工程结构

```text
.
├── src/                    # React 前端
├── server.ts               # Node/Express 前端托管与 /api/chat 代理
├── backend/                # Spring Boot 后端服务
├── Dockerfile              # 前端/Node 服务镜像
├── backend/Dockerfile      # 后端服务镜像
└── docker-compose.yml      # 本地一键启动前后端
```

## 端口与服务

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| Web/Node | `3000` 容器内，默认映射到宿主机 `3001` | 访问入口，生产模式下托管 Vite 构建产物，并提供 `/api/chat` |
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

核心接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/projects` | 创建项目，同时生成 `canvasId` 和 `conversationId` |
| `GET` | `/api/projects` | 项目列表 |
| `GET` | `/api/projects/{projectId}` | 项目详情 |
| `GET` | `/api/canvas/{canvasId}` | 画布详情 |
| `GET` | `/api/conversations/{conversationId}` | 会话和消息详情 |
| `POST` | `/api/agent/runs` | 启动 Agent Run |
| `GET` | `/api/agent/runs/{runId}` | 查询 Run 状态和历史事件 |
| `GET` | `/api/agent/runs/{runId}/events` | SSE 事件流，支持历史事件回放 |
| `GET` | `/api/tasks?projectId=...` | 任务列表 |
| `GET` | `/api/assets?projectId=...` | 资产列表 |

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
JRE_IMAGE="eclipse-temurin:17-jre-alpine" \
docker compose build
```

基础接口测试：

```bash
curl http://localhost:8080/actuator/health

curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"测试项目","description":"Docker Compose smoke test","aspectRatio":"16:9"}'

curl -X POST http://localhost:8080/api/agent/runs \
  -H "Content-Type: application/json" \
  -d '{"message":"生成一个宇宙少女短片","agentName":"导演"}'
```

完整链路测试示例：

```bash
PROJECT_JSON=$(curl -s -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"测试项目","description":"Backend smoke test","aspectRatio":"16:9"}')

PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.data.id')
CANVAS_ID=$(echo "$PROJECT_JSON" | jq -r '.data.canvasId')
CONVERSATION_ID=$(echo "$PROJECT_JSON" | jq -r '.data.conversationId')

RUN_JSON=$(curl -s -X POST http://localhost:8080/api/agent/runs \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"canvasId\":\"$CANVAS_ID\",\"conversationId\":\"$CONVERSATION_ID\",\"message\":\"生成一个宇宙少女短片\",\"agentName\":\"导演\"}")

RUN_ID=$(echo "$RUN_JSON" | jq -r '.data.runId')
sleep 6

curl -s "http://localhost:8080/api/agent/runs/$RUN_ID" | jq
curl -s "http://localhost:8080/api/canvas/$CANVAS_ID" | jq
curl -s "http://localhost:8080/api/conversations/$CONVERSATION_ID" | jq
curl -s "http://localhost:8080/api/tasks?projectId=$PROJECT_ID" | jq
curl -s "http://localhost:8080/api/assets?projectId=$PROJECT_ID" | jq
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

默认前端访问 `http://localhost:3000`，后端访问 `http://localhost:8080`。如果本机 `3000` 被占用，可用 `PORT=3001 npm run dev`。如需调整浏览器调用后端的地址，可设置：

```bash
VITE_API_BASE_URL="http://localhost:8080"
```

## 构建与检查

```bash
npm run build
npm run lint

cd backend
mvn -DskipTests package
```
