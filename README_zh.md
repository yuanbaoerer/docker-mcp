# Docker MCP

[English](./README.md) | [中文](./README_zh.md)

通过 Claude Code 管理 macOS 上的 Docker 的 MCP 服务器。

## 功能特性

- 容器生命周期管理（ps, start, stop, rm, logs, exec）
- 镜像管理（ls, build, rmi）
- Docker Compose 支持（up, down）
- 系统信息查询

## 安装

1. 安装依赖：
   ```bash
   npm install
   ```

2. 构建：
   ```bash
   npm run build
   ```

3. 在 Claude Code 中配置 MCP：
   ```json
   {
     "mcpServers": {
       "docker": {
         "command": "node",
         "args": ["/path/to/docker-mcp/dist/index.js"]
       }
     }
   }
   ```

## 工具列表

| 工具 | 说明 |
|------|------|
| `docker_ps` | 列出所有容器（运行中+已停止） |
| `docker_logs` | 获取容器日志（强制 tail 限制，默认 100 行） |
| `docker_start` | 启动已停止的容器 |
| `docker_stop` | 停止运行中的容器 |
| `docker_rm` | 删除已停止的容器（运行中容器会被阻止删除） |
| `docker_exec` | 在容器中执行一次性命令（非交互式） |
| `docker_images` | 列出本地镜像 |
| `docker_build` | 构建镜像（强制检查 .dockerignore） |
| `docker_rmi` | 删除本地镜像 |
| `docker_system_info` | 获取 Docker 系统信息 |
| `docker_compose_up` | 启动 Compose 项目 |
| `docker_compose_down` | 停止 Compose 项目 |

## 安全约束

- **docker_rm**: 禁止删除运行中的容器，必须先 stop
- **docker_exec**: 仅支持一次性命令（ls, cat, grep），禁止交互式命令（bash, vim, top）
- **docker_build**: 构建前强制检查 .dockerignore 文件，防止上下文过大
- **docker_logs**: 强制 tail 参数限制，防止日志撑爆上下文

## 兼容性

- macOS Intel 和 Apple Silicon 均支持
- 自动检测 Docker Desktop（`/var/run/docker.sock`）或 Colima（`~/.colima/default/docker.sock`）

## 技术栈

- `@modelcontextprotocol/sdk` - 官方 MCP SDK
- `dockerode` - Docker API 客户端
- `zod` - 输入验证

## 许可证

MIT
