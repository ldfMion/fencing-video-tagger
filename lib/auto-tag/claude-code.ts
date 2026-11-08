import { AUTO_TAG_MCP_SERVER_NAME } from "@/lib/auto-tag/prompt";

/** Optional model override for the auto-tag agent, e.g. `opus` or a full model id. */
export const CLAUDE_CODE_MODEL_ENV_VAR = "AUTO_TAG_CLAUDE_MODEL";

const EXIT_DETAIL_LIMIT = 400;

export interface ClaudeCodeLaunchOptions {
  mcpUrl: string;
  token: string;
  model?: string;
}

/** How a Claude Code process ended; `spawnError` means it never started. */
export interface ClaudeCodeExit {
  code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  spawnError?: string;
}

export interface ClaudeCodeResult {
  isError: boolean;
  text: string | null;
}

/**
 * Arguments for a headless Claude Code run that can reach nothing but the job's MCP tools:
 * built-in tools are off, only the job's server is loaded, and its tools are pre-approved.
 */
export function buildClaudeCodeArgs(options: ClaudeCodeLaunchOptions): string[] {
  const mcpConfig = {
    mcpServers: {
      [AUTO_TAG_MCP_SERVER_NAME]: {
        type: "http",
        url: options.mcpUrl,
        headers: { Authorization: `Bearer ${options.token}` },
      },
    },
  };
  return [
    "--print",
    "--output-format", "json",
    "--no-session-persistence",
    "--tools", "",
    "--strict-mcp-config",
    "--mcp-config", JSON.stringify(mcpConfig),
    "--allowedTools", `mcp__${AUTO_TAG_MCP_SERVER_NAME}`,
    ...(options.model ? ["--model", options.model] : []),
  ];
}

/** The single JSON object `--output-format json` prints, or null when stdout holds anything else. */
export function parseClaudeCodeResult(stdout: string): ClaudeCodeResult | null {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    return {
      isError: record.is_error === true,
      text: typeof record.result === "string" && record.result.trim() ? record.result.trim() : null,
    };
  } catch {
    return null;
  }
}

/** Why a job failed when its Claude Code process ended before calling `finish_job`. */
export function describeClaudeCodeExit(exit: ClaudeCodeExit): string {
  if (exit.spawnError) {
    return `Could not start Claude Code: ${exit.spawnError}`;
  }
  const result = parseClaudeCodeResult(exit.stdout);
  const detail = truncate(result?.text ?? lastLine(exit.stderr));
  if (exit.code !== 0 || result?.isError) {
    const status = exit.code === null ? `signal ${exit.signal ?? "unknown"}` : `code ${exit.code}`;
    return `Claude Code exited with ${status}${detail ? `: ${detail}` : "."}`;
  }
  return detail
    ? `Claude Code stopped without finishing the job. Its last message: ${detail}`
    : "Claude Code stopped without finishing the job.";
}

function lastLine(text: string): string | null {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

function truncate(text: string | null): string | null {
  if (!text) return null;
  return text.length > EXIT_DETAIL_LIMIT ? `${text.slice(0, EXIT_DETAIL_LIMIT - 1)}…` : text;
}
