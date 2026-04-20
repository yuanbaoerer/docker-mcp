import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DockerLogsSchema,
  DockerRmSchema,
  DockerExecSchema,
  DockerBuildSchema,
  DockerComposeUpSchema,
  DockerPullSchema,
} from "./server.js";

describe("Schema validation", () => {
  describe("DockerLogsSchema", () => {
    it("requires container parameter", () => {
      const result = DockerLogsSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid input with defaults", () => {
      const result = DockerLogsSchema.safeParse({ container: "nginx" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tail).toBe(100);
        expect(result.data.timestamps).toBe(false);
        expect(result.data.since).toBeUndefined();
      }
    });

    it("accepts custom tail and since", () => {
      const result = DockerLogsSchema.safeParse({
        container: "nginx",
        tail: 50,
        since: "2024-01-01",
        timestamps: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tail).toBe(50);
        expect(result.data.since).toBe("2024-01-01");
        expect(result.data.timestamps).toBe(true);
      }
    });
  });

  describe("DockerRmSchema", () => {
    it("requires container parameter", () => {
      const result = DockerRmSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid input with default removeVolumes", () => {
      const result = DockerRmSchema.safeParse({ container: "mycontainer" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.removeVolumes).toBe(false);
      }
    });

    it("accepts removeVolumes true", () => {
      const result = DockerRmSchema.safeParse({
        container: "mycontainer",
        removeVolumes: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.removeVolumes).toBe(true);
      }
    });
  });

  describe("DockerExecSchema", () => {
    it("requires container and cmd", () => {
      const result = DockerExecSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid command", () => {
      const result = DockerExecSchema.safeParse({
        container: "nginx",
        cmd: "ls -la /app",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing cmd", () => {
      const result = DockerExecSchema.safeParse({ container: "nginx" });
      expect(result.success).toBe(false);
    });
  });

  describe("DockerBuildSchema", () => {
    it("requires tag and path", () => {
      const result = DockerBuildSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts minimal valid input", () => {
      const result = DockerBuildSchema.safeParse({
        tag: "myapp:latest",
        path: "/tmp/build",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional dockerfile and buildArgs", () => {
      const result = DockerBuildSchema.safeParse({
        tag: "myapp:latest",
        path: "/tmp/build",
        dockerfile: "Dockerfile.dev",
        buildArgs: { NODE_ENV: "production" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dockerfile).toBe("Dockerfile.dev");
        expect(result.data.buildArgs).toEqual({ NODE_ENV: "production" });
      }
    });
  });

  describe("DockerComposeUpSchema", () => {
    it("requires projectDir", () => {
      const result = DockerComposeUpSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid input with default detached", () => {
      const result = DockerComposeUpSchema.safeParse({
        projectDir: "/project",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.detached).toBe(true);
      }
    });

    it("accepts detached false", () => {
      const result = DockerComposeUpSchema.safeParse({
        projectDir: "/project",
        detached: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.detached).toBe(false);
      }
    });
  });

  describe("DockerPullSchema", () => {
    it("requires image", () => {
      const result = DockerPullSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid input with default tag", () => {
      const result = DockerPullSchema.safeParse({ image: "nginx" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tag).toBe("latest");
      }
    });

    it("accepts custom tag", () => {
      const result = DockerPullSchema.safeParse({
        image: "nginx",
        tag: "alpine",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tag).toBe("alpine");
      }
    });
  });
});
