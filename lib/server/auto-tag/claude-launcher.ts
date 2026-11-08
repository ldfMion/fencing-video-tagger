import "server-only";

import { spawn, type ChildProcess } from "node:child_process";
import {
  buildClaudeCodeArgs,
  CLAUDE_CODE_MODEL_ENV_VAR,
  type ClaudeCodeExit,
} from "@/lib/auto-tag/claude-code";
import { buildAgentPrompt } from "@/lib/auto-tag/prompt";

const STDERR_TAIL_LIMIT = 4000;

// Kept on globalThis so a dev-server module reload can still find and stop running agents.
const globalForAgents = globalThis as typeof globalThis & {
  fencingAutoTagAgents?: Map<string, ChildProcess>;
};
const runningAgents = (globalForAgents.fencingAutoTagAgents ??= new Map());

/** Starts a headless Claude Code process for the job; `onExit` fires once, however it ends. */
export function launchClaudeCodeAgent(options: {
  jobId: string;
  token: string;
  mcpUrl: string;
  cwd: string;
  onExit: (exit: ClaudeCodeExit) => void;
}): void {
  const child = spawn(
    "claude",
    buildClaudeCodeArgs({
      mcpUrl: options.mcpUrl,
      token: options.token,
      model: process.env[CLAUDE_CODE_MODEL_ENV_VAR] || undefined,
    }),
    { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] },
  );
  runningAgents.set(options.jobId, child);

  let stdout = "";
  let stderr = "";
  let settled = false;
  const settle = (exit: ClaudeCodeExit) => {
    if (settled) return;
    settled = true;
    runningAgents.delete(options.jobId);
    options.onExit(exit);
  };

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_TAIL_LIMIT);
  });
  child.on("error", (error: NodeJS.ErrnoException) => {
    settle({
      code: null,
      signal: null,
      stdout,
      stderr,
      spawnError: error.code === "ENOENT"
        ? "the `claude` command is not on the server's PATH."
        : error.message,
    });
  });
  child.on("close", (code, signal) => settle({ code, signal, stdout, stderr }));

  // The prompt goes in on stdin; a process that dies first closes the pipe, which is not an error here.
  child.stdin.on("error", () => {});
  child.stdin.end(`${buildAgentPrompt()}\n`);
}

export function stopClaudeCodeAgent(jobId: string): void {
  const child = runningAgents.get(jobId);
  if (child && child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
  }
}
