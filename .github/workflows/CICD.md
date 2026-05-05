# CI/CD 发布说明

本项目已接入 GitHub Actions，发布流程为手动触发：输入版本号，构建 Docker 镜像并推送到 GHCR，然后通过 SSH 账号密码登录服务器，使用服务器上的 Docker Compose 文件完成更新。

## 工作流文件

- `.github/workflows/docker-build.yml`
- `docker-compose.yml`：可直接放到服务器上，并将 `COMPOSE_FILE_PATH` 指向它的绝对路径
- 触发方式：`workflow_dispatch`
- 必填输入：`version`
- 默认镜像仓库：`ghcr.io/<owner>/<repo>:<version>`
- 默认部署环境：`production`

## GitHub 环境配置

进入 GitHub 仓库的 `Settings -> Environments -> production`，配置以下内容。

### Environment secrets

这些值属于敏感信息，放在 `production` 环境的 Secrets 中：

| 名称 | 说明 |
| --- | --- |
| `SERVER_HOST` | 服务器 IP 或域名 |
| `SERVER_USERNAME` | SSH 登录账号 |
| `SERVER_PASSWORD` | SSH 登录密码 |
| `GHCR_TOKEN` | 可选。服务器拉取私有 GHCR 镜像时使用的 token |
| `GHCR_USERNAME` | 可选。与 `GHCR_TOKEN` 配套的 GHCR 用户名 |
| `SSH_KNOWN_HOSTS` | 可选。服务器 SSH host key，配置后会启用严格主机校验 |

如果 GHCR 镜像包是公开的，`GHCR_TOKEN` 和 `GHCR_USERNAME` 可以不配置。私有镜像建议创建一个具备 `read:packages` 权限的 GitHub token。

### Environment variables

这些值不属于密钥，放在 `production` 环境的 Variables 中：

| 名称 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `COMPOSE_FILE_PATH` | 是 | `/opt/fluximage/docker-compose.yml` | 服务器上的 Docker Compose 文件绝对路径 |
| `SERVER_SSH_PORT` | 否 | `22` | SSH 端口，不配置时默认 `22` |
| `COMPOSE_SERVICE` | 否 | `app` | Compose 服务名，不配置时默认 `app` |

## 服务器准备

服务器需要提前安装 Docker 和 Docker Compose，并确保 `SERVER_USERNAME` 对应的用户可以直接执行 `docker` 命令。

建议目录结构：

```bash
/opt/fluximage/
├── docker-compose.yml
└── .env
```

`docker-compose.yml` 中的应用服务需要使用 `APP_IMAGE` 环境变量，例如：

```yaml
services:
  app:
    image: ${APP_IMAGE:-ghcr.io/your-username/fluximage:latest}
    container_name: fluximage-app
    restart: unless-stopped
    ports:
      - "${APP_PORT:-3000}:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    volumes:
      - uploads:/app/public/uploads

volumes:
  uploads:
```

服务器上的 `.env` 继续存放应用运行时配置，例如数据库、Redis、JWT、AI API、邮件服务等。发布脚本会自动在这个 `.env` 中新增或更新 `APP_IMAGE=ghcr.io/<owner>/<repo>:<version>`。

## 手动发布步骤

1. 进入 GitHub 仓库页面。
2. 打开 `Actions`。
3. 选择 `Build and Deploy Docker Image`。
4. 点击 `Run workflow`。
5. 填写 `version`，例如 `v2.0.1`。
6. 选择是否同时打 `latest` 标签。
7. 点击运行。

版本号会作为 Docker tag 使用，格式只允许字母、数字、下划线、点和短横线，长度不超过 128 个字符。

## 发布过程

工作流会按顺序执行：

1. 校验 `version`。
2. 构建 `linux/amd64` 和 `linux/arm64` Docker 镜像。
3. 推送镜像到 GHCR。
4. 通过 SSH 账号密码登录服务器。
5. 根据 `COMPOSE_FILE_PATH` 找到服务器上的 Compose 文件。
6. 更新同目录 `.env` 中的 `APP_IMAGE`。
7. 执行 `docker compose pull app` 和 `docker compose up -d app`。
8. 输出 Compose 服务状态并清理悬空镜像。

## 回滚

回滚时重新手动触发工作流，并将 `version` 填写为之前已经成功发布过的镜像版本即可。工作流会把服务器 `.env` 中的 `APP_IMAGE` 改回指定版本，并重新执行 Docker Compose。

## 常见问题

### 服务器拉取镜像失败

如果镜像是私有 GHCR 包，请确认 `GHCR_USERNAME` 和 `GHCR_TOKEN` 已配置到 `production` 环境 Secrets，且 token 具备 `read:packages` 权限。

### 找不到 Compose 文件

确认 `COMPOSE_FILE_PATH` 是服务器上的绝对路径，例如 `/opt/fluximage/docker-compose.yml`，并且 SSH 用户有读取权限。

### docker compose 权限不足

确认 SSH 用户已加入 Docker 用户组，或具备直接执行 Docker 命令的权限。当前工作流不会交互式输入 sudo 密码。
