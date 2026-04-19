#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DockerMCP } from "./server.js";

const server = new DockerMCP();
const transport = new StdioServerTransport();

server.connect(transport).catch((err) => {
  console.error("Failed to start Docker MCP server:", err);
  process.exit(1);
});
