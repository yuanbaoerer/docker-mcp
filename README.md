# Docker MCP

MCP server for managing Docker on macOS via Claude Code.

## Features

- Container lifecycle management (ps, start, stop, rm, logs, exec)
- Image management (ls, build, rmi)
- Docker Compose support (up, down)
- System information

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Add to Claude Code MCP configuration:
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

## Tools

| Tool | Description |
|------|-------------|
| `docker_ps` | List running containers |
| `docker_logs` | Get container logs (tail + since enforced) |
| `docker_start` | Start a container |
| `docker_stop` | Stop a container |
| `docker_rm` | Remove a container (running containers blocked) |
| `docker_exec` | Execute command in container (non-interactive only) |
| `docker_images` | List local images |
| `docker_build` | Build image with .dockerignore validation |
| `docker_system_info` | Get Docker system info |
| `docker_compose_up` | Start compose project |
| `docker_compose_down` | Stop compose project |

## Requirements

- macOS with Docker Desktop or Colima installed
- Node.js >= 20.0.0
