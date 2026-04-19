import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import Docker from "dockerode";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Detect Docker socket path (works for both Intel and Apple Silicon)
function getDockerSocket(): string {
  const dockerDesktopSocket = "/var/run/docker.sock";
  const colimaSocket = path.join(process.env.HOME || "", ".colima/default/docker.sock");

  if (fs.existsSync(dockerDesktopSocket)) {
    return dockerDesktopSocket;
  }
  return colimaSocket;
}

const docker = new Docker({ socketPath: getDockerSocket() });

// Zod schemas - use .shape when passing to server.tool()
const DockerPsSchema = z.object({});
const DockerLogsSchema = z.object({
  container: z.string(),
  tail: z.number().default(100),
  since: z.string().optional(),
  timestamps: z.boolean().default(false),
});
const DockerStartSchema = z.object({ container: z.string() });
const DockerStopSchema = z.object({ container: z.string() });
const DockerRmSchema = z.object({
  container: z.string(),
  removeVolumes: z.boolean().default(false),
});
const DockerExecSchema = z.object({
  container: z.string(),
  cmd: z.string(),
});
const DockerImagesSchema = z.object({});
const DockerBuildSchema = z.object({
  tag: z.string(),
  path: z.string(),
  dockerfile: z.string().optional(),
  buildArgs: z.record(z.string()).optional(),
});
const DockerRmiSchema = z.object({
  image: z.string(),
  force: z.boolean().default(false),
});
const DockerSystemInfoSchema = z.object({});
const DockerComposeUpSchema = z.object({
  projectDir: z.string(),
  detached: z.boolean().default(true),
});
const DockerComposeDownSchema = z.object({
  projectDir: z.string(),
  removeVolumes: z.boolean().default(false),
});

// Tool implementations
async function dockerPs() {
  const containers = await docker.listContainers({ all: true });
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(containers, null, 2),
      },
    ],
  };
}

async function dockerLogs(args: z.infer<typeof DockerLogsSchema>) {
  const { container, tail = 100, since, timestamps = false } = args;
  const options: any = {
    stdout: true,
    stderr: true,
    tail,
    timestamps,
  };
  if (since) {
    options.since = new Date(since);
  }

  const logsStream = await docker.getContainer(container).logs(options);
  const cleanLogs = await streamToString(logsStream);

  return {
    content: [
      {
        type: "text" as const,
        text: cleanLogs,
      },
    ],
  };
}

async function dockerStart(args: z.infer<typeof DockerStartSchema>) {
  await docker.getContainer(args.container).start();
  return {
    content: [{ type: "text" as const, text: `Container ${args.container} started` }],
  };
}

async function dockerStop(args: z.infer<typeof DockerStopSchema>) {
  await docker.getContainer(args.container).stop();
  return {
    content: [{ type: "text" as const, text: `Container ${args.container} stopped` }],
  };
}

async function dockerRm(args: z.infer<typeof DockerRmSchema>) {
  const { container: containerId, removeVolumes = false } = args;
  const container = docker.getContainer(containerId);
  const info = await container.inspect();

  if (info.State.Running) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Cannot remove running container ${containerId}. Please docker_stop it first.`,
        },
      ],
      isError: true,
    };
  }

  const volumes = info.Mounts || [];
  const hasVolumes = volumes.length > 0;

  await container.remove({ v: removeVolumes, force: false });

  let msg = `Container ${containerId} removed.`;
  if (hasVolumes && !removeVolumes) {
    msg += "\nAssociated volumes were NOT removed (removeVolumes=false): " + volumes.map((v) => v.Name || v.Source).join(", ");
  } else if (hasVolumes && removeVolumes) {
    msg += "\nAssociated volumes were removed.";
  }

  return {
    content: [{ type: "text" as const, text: msg }],
  };
}

async function dockerExec(args: z.infer<typeof DockerExecSchema>) {
  const { container, cmd } = args;
  const interactiveCommands = ["bash", "sh", "vim", "vi", "nano", "top", "less", "more", "htop"];
  const isInteractive = interactiveCommands.some((ic) => cmd.includes(ic));

  if (isInteractive) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Interactive command detected. docker_exec only supports one-shot commands (ls, cat, grep, etc.). Interactive TTY commands (bash/sh, vim, top) will cause the request to hang.`,
        },
      ],
      isError: true,
    };
  }

  const exec = await docker.getContainer(container).exec({
    Cmd: ["/bin/sh", "-c", cmd],
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: false });
  const output = await streamToString(stream);

  return {
    content: [{ type: "text" as const, text: output }],
  };
}

async function dockerImages() {
  const images = await docker.listImages();
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(images, null, 2),
      },
    ],
  };
}

async function dockerBuild(args: z.infer<typeof DockerBuildSchema>): Promise<{ content: Array<{ type: "text"; text: string; annotations?: any; _meta?: any }>; isError?: boolean }> {
  const { tag, path: buildPath, dockerfile, buildArgs } = args;

  // Layer 1: Check .dockerignore exists (pre-flight validation)
  const dockerignorePath = path.join(buildPath, ".dockerignore");
  if (!fs.existsSync(dockerignorePath)) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Missing .dockerignore in build context at "${buildPath}".\n\nBefore building, please create a .dockerignore file to prevent massive context transfer.\n\nRecommended .dockerignore entries:\nnode_modules\n.git\nvendor\ndist\n*.log\n.env\n.cache\n__pycache__`,
        },
      ],
      isError: true,
    };
  }

  // Layer 2: Build
  return new Promise<{ content: Array<{ type: "text"; text: string; annotations?: any; _meta?: any }>; isError?: boolean }>((resolve) => {
    docker.buildImage(
      {
        context: buildPath,
        src: dockerfile ? [dockerfile] : ["Dockerfile"],
      },
      {
        t: tag,
        buildargs: buildArgs,
      },
      (err, stream) => {
        if (err) {
          resolve({
            content: [{ type: "text" as const, text: `Build error: ${err.message}` }],
            isError: true,
          });
          return;
        }

        if (!stream) {
          resolve({
            content: [{ type: "text" as const, text: "Build started but no stream returned" }],
            isError: true,
          });
          return;
        }

        let output = "";
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });

        stream.on("end", () => {
          resolve({
            content: [
              {
                type: "text" as const,
                text: `Image ${tag} built successfully.\n\nBuild output:\n${output}`,
              },
            ],
          });
        });

        stream.on("error", (err: Error) => {
          resolve({
            content: [{ type: "text" as const, text: `Stream error: ${err.message}` }],
            isError: true,
          });
        });
      }
    );
  });
}

async function dockerRmi(args: z.infer<typeof DockerRmiSchema>) {
  const { image, force = false } = args;
  await docker.getImage(image).remove({ force });
  return {
    content: [{ type: "text" as const, text: `Image ${image} removed` }],
  };
}

async function dockerSystemInfo() {
  const info = await docker.info();
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(info, null, 2),
      },
    ],
  };
}

async function dockerComposeUp(args: z.infer<typeof DockerComposeUpSchema>) {
  const { projectDir, detached = true } = args;
  const argsArr = ["compose", "up"];
  if (detached) argsArr.push("-d");

  try {
    const { stdout, stderr } = await execFile("docker", argsArr, { cwd: projectDir });
    return {
      content: [
        {
          type: "text" as const,
          text: `Compose up succeeded.\n\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Compose up failed: ${err.message}` }],
      isError: true,
    };
  }
}

async function dockerComposeDown(args: z.infer<typeof DockerComposeDownSchema>) {
  const { projectDir, removeVolumes = false } = args;
  const argsArr = ["compose", "down"];
  if (removeVolumes) argsArr.push("-v");

  try {
    const { stdout, stderr } = await execFile("docker", argsArr, { cwd: projectDir });
    return {
      content: [
        {
          type: "text" as const,
          text: `Compose down succeeded.\n\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Compose down failed: ${err.message}` }],
      isError: true,
    };
  }
}

// Helper functions
function stripDockerHeaders(data: Buffer | string): string {
  if (typeof data === "string") return data;

  let result = "";
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

  for (let i = 0; i < buf.length; i += 8) {
    if (i + 8 <= buf.length) {
      result += buf.slice(i + 8, i + 8 + 4).toString("utf8");
    }
  }

  return result.trim();
}

function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    stream.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    stream.on("end", () => resolve(output));
    stream.on("error", reject);
  });
}

// Server class
export class DockerMCP {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: "docker-mcp",
      version: "1.0.0",
    });

    this.registerTools();
  }

  private registerTools() {
    // docker_ps
    this.server.tool(
      "docker_ps",
      "List all containers (running and stopped)",
      DockerPsSchema.shape,
      {},
      async () => dockerPs()
    );

    // docker_logs
    this.server.tool(
      "docker_logs",
      "Get container logs with mandatory tail limit to prevent context explosion",
      DockerLogsSchema.shape,
      {},
      async (args) => dockerLogs(args as any)
    );

    // docker_start
    this.server.tool(
      "docker_start",
      "Start a stopped container",
      DockerStartSchema.shape,
      {},
      async (args) => dockerStart(args as any)
    );

    // docker_stop
    this.server.tool(
      "docker_stop",
      "Stop a running container",
      DockerStopSchema.shape,
      {},
      async (args) => dockerStop(args as any)
    );

    // docker_rm
    this.server.tool(
      "docker_rm",
      "Remove a stopped container. Running containers are blocked and must be stopped first.",
      DockerRmSchema.shape,
      {},
      async (args) => dockerRm(args as any)
    );

    // docker_exec
    this.server.tool(
      "docker_exec",
      "Execute a one-shot command in a container. WARNING: Interactive commands (bash, vim, top) will cause the request to hang.",
      DockerExecSchema.shape,
      {},
      async (args) => dockerExec(args as any)
    );

    // docker_images
    this.server.tool(
      "docker_images",
      "List local Docker images",
      DockerImagesSchema.shape,
      {},
      async () => dockerImages()
    );

    // docker_build
    this.server.tool(
      "docker_build",
      "Build a Docker image. IMPORTANT: .dockerignore check is enforced before build to prevent massive context transfer.",
      DockerBuildSchema.shape,
      {},
      async (args) => dockerBuild(args as any)
    );

    // docker_rmi
    this.server.tool(
      "docker_rmi",
      "Remove a local Docker image",
      DockerRmiSchema.shape,
      {},
      async (args) => dockerRmi(args as any)
    );

    // docker_system_info
    this.server.tool(
      "docker_system_info",
      "Get Docker system information",
      DockerSystemInfoSchema.shape,
      {},
      async () => dockerSystemInfo()
    );

    // docker_compose_up
    this.server.tool(
      "docker_compose_up",
      "Start a Docker Compose project using docker compose CLI",
      DockerComposeUpSchema.shape,
      {},
      async (args) => dockerComposeUp(args as any)
    );

    // docker_compose_down
    this.server.tool(
      "docker_compose_down",
      "Stop a Docker Compose project using docker compose CLI",
      DockerComposeDownSchema.shape,
      {},
      async (args) => dockerComposeDown(args as any)
    );
  }

  async connect(transport: any) {
    await this.server.connect(transport);
  }
}
