import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { authenticateAutoTagToken } from "@/lib/server/auto-tag/job-service";
import { registerAutoTagTools } from "@/lib/server/auto-tag/mcp-server";

const mcpHandler = createMcpHandler(registerAutoTagTools, {
  serverInfo: { name: "fencing-auto-tag", version: "1.0.0" },
});

const authenticatedHandler = withMcpAuth(mcpHandler, async (_request, bearerToken) => {
  if (!bearerToken) return undefined;
  const job = await authenticateAutoTagToken(bearerToken);
  return job
    ? { token: bearerToken, clientId: job.agent, scopes: [], extra: { jobId: job.id } }
    : undefined;
}, { required: true });

export { authenticatedHandler as GET, authenticatedHandler as POST, authenticatedHandler as DELETE };
