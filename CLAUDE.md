# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP server for managing Docker on macOS via Claude Code. Supports both Intel and Apple Silicon Macs by auto-detecting Docker socket (Docker Desktop or Colima).

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode with tsx (dev only, not for production)
npm start            # Run production server
npm run typecheck    # TypeScript type checking without emitting
```

## Architecture

- [src/index.ts](src/index.ts) - Entry point; creates transport and starts server
- [src/server.ts](src/server.ts) - Core logic; `DockerMCP` class registers all tools with Zod schemas

**Tool flow**: Zod schema validation → tool implementation → MCP response

**Key design decisions in server.ts**:
- `getDockerSocket()` auto-detects Docker socket path (line 9-17)
- `docker_logs` enforces `tail` parameter (default 100) to prevent context explosion
- `docker_rm` blocks removal of running containers and prompts for volume cleanup
- `docker_build` validates `.dockerignore` exists before building (context size protection)
- `docker_exec` blocks interactive commands (bash, vim, top, etc.)

## TypeScript Config

ES2022 target, NodeNext module resolution, strict mode. Output to `dist/`, source in `src/`.

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol
- `dockerode` - Docker API client
- `zod` - Schema validation