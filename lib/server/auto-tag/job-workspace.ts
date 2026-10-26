import "server-only";

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { AUTO_TAG_MCP_SERVER_NAME, buildAgentPrompt } from "@/lib/auto-tag/prompt";

const execFileAsync = promisify(execFile);

const AUTO_TAG_TOKEN_ENV_VAR = "FENCING_AUTO_TAG_TOKEN";
const CODEX_TOOL_TIMEOUT_SECONDS = 180;

export function getAutoTagJobDirectory(jobId: string): string {
  return path.join(process.cwd(), ".data", "auto-tag-jobs", jobId);
}

export function getAutoTagOverviewDirectory(jobId: string): string {
  return path.join(getAutoTagJobDirectory(jobId), "overview");
}

export function getAutoTagSamplesDirectory(jobId: string): string {
  return path.join(getAutoTagJobDirectory(jobId), "samples");
}

function getLaunchScriptPath(jobId: string): string {
  return path.join(getAutoTagJobDirectory(jobId), "run.sh");
}

export function buildLaunchCommand(jobId: string): string {
  return `bash ${quoteForShell(getLaunchScriptPath(jobId))}`;
}

export async function writeCodexLaunchFiles(options: {
  jobId: string;
  token: string;
  mcpUrl: string;
}): Promise<void> {
  const jobDirectory = getAutoTagJobDirectory(options.jobId);
  await fs.mkdir(jobDirectory, { recursive: true });
  await fs.writeFile(path.join(jobDirectory, "PROMPT.md"), `${buildAgentPrompt()}\n`);
  await fs.writeFile(
    getLaunchScriptPath(options.jobId),
    buildCodexLaunchScript(jobDirectory, options.token, options.mcpUrl),
    { mode: 0o700 },
  );
}

function buildCodexLaunchScript(jobDirectory: string, token: string, mcpUrl: string): string {
  const serverKey = `mcp_servers.${AUTO_TAG_MCP_SERVER_NAME}`;
  const configOverrides = [
    `${serverKey}.url=${toTomlString(mcpUrl)}`,
    `${serverKey}.bearer_token_env_var=${toTomlString(AUTO_TAG_TOKEN_ENV_VAR)}`,
    `${serverKey}.default_tools_approval_mode="approve"`,
    `${serverKey}.required=true`,
    `${serverKey}.tool_timeout_sec=${CODEX_TOOL_TIMEOUT_SECONDS}`,
  ];
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    `cd ${quoteForShell(jobDirectory)}`,
    `export ${AUTO_TAG_TOKEN_ENV_VAR}=${quoteForShell(token)}`,
    [
      "exec codex",
      `--cd ${quoteForShell(jobDirectory)}`,
      "--sandbox read-only",
      "--ask-for-approval never",
      ...configOverrides.map((override) => `-c ${quoteForShell(override)}`),
      '"$(cat PROMPT.md)"',
    ].join(" \\\n  "),
    "",
  ].join("\n");
}

export async function removeAutoTagJobWorkspace(jobId: string): Promise<void> {
  await fs.rm(getAutoTagJobDirectory(jobId), { recursive: true, force: true });
}

/** Opens Terminal.app running `command`; macOS asks for Automation permission the first time. */
export async function openCommandInTerminal(command: string): Promise<void> {
  const script = `tell application "Terminal"\nactivate\ndo script ${toAppleScriptString(command)}\nend tell`;
  await execFileAsync("osascript", ["-e", script], { timeout: 15_000 });
}

function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function toTomlString(value: string): string {
  return JSON.stringify(value);
}

function toAppleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
