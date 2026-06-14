# 本机前端连接 Docker 后端开发

本文说明如何在本机运行改造后的 Vite 前端，并连接 Docker Compose 启动的后端；后端再通过数据源配置连接开发者自己的业务数据库。

适用链路：

```text
本机 Vite 前端 -> Docker Compose 后端 -> 开发者业务数据库
```

数据库连接信息不应写入前端代码，也不应提交到仓库。请通过 Aix-DB 的数据源管理页面或后端数据源 API 配置。

## 克隆仓库

```bash
git clone https://github.com/toudatouda/gtzn_AI_BI.git
cd gtzn_AI_BI
```

以下命令中的 `<repo-root>` 指仓库根目录。

## 启动 Docker 后端

```bash
cd <repo-root>/docker
cp .env.template .env
docker compose -f docker-compose.dev.yaml up -d
docker ps
```

Windows PowerShell 可使用：

```powershell
cd <repo-root>\docker
copy .env.template .env
docker compose -f docker-compose.dev.yaml up -d
docker ps
```

后端 API 预期映射：

```text
127.0.0.1:18088 -> backend container 8088
```

验证后端 API：

```powershell
Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 -Uri "http://127.0.0.1:18088/docs"
```

预期返回 HTTP 200。若失败，检查：

```bash
docker ps
docker logs --tail 120 <backend-container-name>
```

## 启动本机前端

前端通过 Vite 代理 `/sanic/*` 到 Docker 后端。开发 Docker 后端时使用：

```bash
cd <repo-root>/web
pnpm install
VITE_MOBILE_DEMO_MODE=true pnpm dev:docker-backend
```

Windows PowerShell 使用：

```powershell
cd <repo-root>\web
pnpm install
$env:VITE_MOBILE_DEMO_MODE="true"
pnpm dev:docker-backend
```

访问：

```text
http://localhost:2048/m/chat
```

请求链路：

```text
浏览器 -> http://localhost:2048/m/chat
前端 API -> /sanic/...
Vite proxy -> http://127.0.0.1:18088
Docker 后端 -> 容器内 8088
```

`VITE_MOBILE_DEMO_MODE=true` 仅用于本地开发或内部演示，不应在生产环境启用。

## 前端代理配置

前端支持通过环境变量覆盖后端代理目标：

```text
VITE_SANIC_PROXY_TARGET
```

推荐脚本：

```json
{
  "scripts": {
    "dev": "vite --host",
    "dev:docker-backend": "cross-env VITE_SANIC_PROXY_TARGET=http://127.0.0.1:18088 vite --host"
  }
}
```

行为：

```text
设置 VITE_SANIC_PROXY_TARGET -> 使用该值作为 /sanic 代理目标
未设置 VITE_SANIC_PROXY_TARGET -> 默认 http://localhost:8088
```

## pnpm 11 构建脚本批准

如果 `pnpm install` 报错：

```text
ERR_PNPM_IGNORED_BUILDS
```

请确认 `web/pnpm-workspace.yaml` 中包含：

```yaml
allowBuilds:
  '@parcel/watcher': true
  esbuild: true
  unrs-resolver: true
  vue-demi: true
```

然后执行：

```bash
cd <repo-root>/web
pnpm rebuild
pnpm install
pnpm ignored-builds
pnpm exec vite --version
```

期望：

```text
Automatically ignored builds during installation:
  None
```

## 配置业务数据库

开发者需要准备自己的业务数据库连接信息：

```text
DB_TYPE=mysql
DB_HOST=<后端容器可访问的数据库地址>
DB_PORT=<后端容器可访问的数据库端口>
DB_NAME=<数据库名>
DB_USER=<用户名>
DB_PASSWORD=<密码或密钥引用>
```

由于本文使用 Docker 后端，`DB_HOST` 和 `DB_PORT` 必须从后端容器视角填写，而不是从宿主机视角填写。

| 数据库位置 | 后端容器中的 DB_HOST | DB_PORT |
| --- | --- | --- |
| 与后端在同一 Docker 网络 | Compose service 名或容器 DNS 名 | 数据库容器内部端口，MySQL 通常为 `3306` |
| 在另一个 Docker 网络 | 先加入共享 Docker 网络，再使用 service/容器 DNS 名 | 数据库容器内部端口 |
| 只通过宿主机端口暴露的 Docker 数据库 | `host.docker.internal` | 宿主机映射端口 |
| 直接运行在宿主机的数据库 | `host.docker.internal` | 宿主机数据库端口 |
| 远程数据库 | 后端容器可访问的远程域名或 IP | 远程数据库端口 |

不要把容器内的 `localhost` 当成宿主机或数据库。Docker 容器内的 `localhost` 指后端容器自身。

## 测试后端到数据库连接

在配置 UI 前，先验证后端容器能连接数据库。MySQL 示例：

```powershell
docker exec <backend-container-name> python -c "import pymysql; conn=pymysql.connect(host='<DB_HOST>', port=<DB_PORT>, user='<DB_USER>', password='<DB_PASSWORD>', database='<DB_NAME>', connect_timeout=5); cur=conn.cursor(); cur.execute('select database()'); print(cur.fetchone()); conn.close()"
```

期望：

```text
('<DB_NAME>',)
```

如果失败：

- 使用 `docker ps` 确认后端容器名。
- 在后端容器视角检查数据库 host 是否可解析。
- 如果数据库在另一个 Compose 项目中，优先配置共享 Docker 网络。
- 如果数据库在宿主机，使用 `host.docker.internal`，不要使用 `localhost`。
- 检查数据库监听地址、防火墙、用户授权和密码。
- 避免把真实密码写入文档、提交记录或公开日志。

## 在 Aix-DB 中添加数据源

后端能连接数据库后：

1. 打开 Aix-DB 前端。
2. 进入数据源管理页面。
3. 新增数据源，填写开发者自己的数据库配置。
4. host 和 port 使用后端容器视角可访问的值。
5. 点击连接测试。
6. 测试通过后保存数据源。

可用入口：

```text
本机开发前端: http://localhost:2048
移动端问数页: http://localhost:2048/m/chat
Docker 内置前端: http://localhost:18080
后端文档页: http://127.0.0.1:18088/docs
```

如果只在移动端演示页工作，而数据源管理入口不可见，可先通过 Docker 内置前端 `http://localhost:18080` 或本机前端桌面路由完成数据源配置，再回到 `/m/chat` 测试问数。

## 端到端测试

完成启动和数据源配置后：

1. 确认 Docker 后端已启动：`docker compose -f docker-compose.dev.yaml up -d`。
2. 确认后端文档页可访问：`http://127.0.0.1:18088/docs`。
3. 确认后端容器能连接业务数据库。
4. 使用 `pnpm dev:docker-backend` 启动本机前端。
5. 打开 `http://localhost:2048/m/chat`。
6. 提交一个应命中已配置数据源的问题。
7. 在浏览器 DevTools 中确认请求走 `localhost:2048/sanic/...`，且没有 Vite proxy `ECONNREFUSED`。
8. 查看后端日志：

```bash
docker logs --tail 120 <backend-container-name>
```

9. 确认移动端页面渲染回答。
10. 确认移动端页面不展示 SQL。
11. 确认图表正常渲染，或降级结果正常展示。
12. 在约 `360px`、`390px`、`430px` 宽度下检查布局。

## 常见问题

### Vite proxy ECONNREFUSED

通常是前端代理到了 `localhost:8088`，但 Docker 后端暴露在 `127.0.0.1:18088`。

使用：

```bash
cd <repo-root>/web
pnpm dev:docker-backend
```

或手动设置：

```powershell
$env:VITE_SANIC_PROXY_TARGET="http://127.0.0.1:18088"
pnpm dev
```

### 后端无法连接数据库

通常是 `DB_HOST` 或 `DB_PORT` 按宿主机视角填写，而不是按后端容器视角填写。

处理原则：

- 同一 Docker 网络：使用 service 名 + 内部端口。
- 宿主机数据库：使用 `host.docker.internal` + 宿主机端口。
- 只发布到宿主机端口的数据库容器：使用 `host.docker.internal` + 发布端口，或改为共享网络后使用 service 名。

### pnpm install 被 ignored builds 阻塞

执行：

```bash
cd <repo-root>/web
pnpm rebuild
pnpm install
pnpm ignored-builds
```

并确认 `web/pnpm-workspace.yaml` 包含批准清单。
