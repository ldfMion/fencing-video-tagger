import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClaudeCodeArgs,
  describeClaudeCodeExit,
  parseClaudeCodeResult,
} from "../lib/auto-tag/claude-code";

const launch = { mcpUrl: "http://localhost:3000/api/auto-tag/mcp", token: "secret-token" };

function flagValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  assert.notEqual(index, -1, `${flag} is passed`);
  return args[index + 1];
}

test("claude code runs headless with only the job's MCP server and tools", () => {
  const args = buildClaudeCodeArgs(launch);

  assert.ok(args.includes("--print"));
  assert.equal(flagValue(args, "--output-format"), "json");
  assert.equal(flagValue(args, "--tools"), "", "built-in tools are disabled");
  assert.ok(args.includes("--strict-mcp-config"), "other MCP servers are ignored");
  assert.equal(flagValue(args, "--allowedTools"), "mcp__fencing_auto_tag");
  assert.ok(!args.includes("--model"), "no model override by default");

  const mcpConfig = JSON.parse(flagValue(args, "--mcp-config"));
  assert.deepEqual(mcpConfig, {
    mcpServers: {
      fencing_auto_tag: {
        type: "http",
        url: launch.mcpUrl,
        headers: { Authorization: "Bearer secret-token" },
      },
    },
  });
});

test("a model override is passed through", () => {
  const args = buildClaudeCodeArgs({ ...launch, model: "opus" });
  assert.equal(flagValue(args, "--model"), "opus");
});

test("the json result is parsed leniently", () => {
  assert.deepEqual(
    parseClaudeCodeResult('{"type":"result","is_error":false,"result":"  Done tagging. "}\n'),
    { isError: false, text: "Done tagging." },
  );
  assert.deepEqual(
    parseClaudeCodeResult('{"type":"result","is_error":true,"result":""}'),
    { isError: true, text: null },
  );
  assert.equal(parseClaudeCodeResult("not json"), null);
  assert.equal(parseClaudeCodeResult(""), null);
});

test("exit descriptions explain what went wrong", () => {
  assert.equal(
    describeClaudeCodeExit({
      code: null, signal: null, stdout: "", stderr: "",
      spawnError: "the `claude` command is not on the server's PATH.",
    }),
    "Could not start Claude Code: the `claude` command is not on the server's PATH.",
  );

  assert.equal(
    describeClaudeCodeExit({
      code: 1, signal: null, stdout: "",
      stderr: "warning: something\nError: Not logged in\n",
    }),
    "Claude Code exited with code 1: Error: Not logged in",
  );

  assert.equal(
    describeClaudeCodeExit({ code: null, signal: "SIGKILL", stdout: "", stderr: "" }),
    "Claude Code exited with signal SIGKILL.",
  );

  assert.equal(
    describeClaudeCodeExit({
      code: 0, signal: null, stderr: "",
      stdout: '{"type":"result","is_error":true,"result":"Rate limit reached"}',
    }),
    "Claude Code exited with code 0: Rate limit reached",
  );

  assert.equal(
    describeClaudeCodeExit({
      code: 0, signal: null, stderr: "",
      stdout: '{"type":"result","is_error":false,"result":"I tagged 12 touches."}',
    }),
    "Claude Code stopped without finishing the job. Its last message: I tagged 12 touches.",
  );

  assert.equal(
    describeClaudeCodeExit({ code: 0, signal: null, stdout: "", stderr: "" }),
    "Claude Code stopped without finishing the job.",
  );
});

test("long exit details are truncated", () => {
  const description = describeClaudeCodeExit({
    code: 1, signal: null, stdout: "", stderr: "x".repeat(1000),
  });
  assert.ok(description.length < 450);
  assert.ok(description.endsWith("…"));
});
