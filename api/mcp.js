import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import console from "node:console";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createOpcMcpServer } from "../mcp/server.mjs";

const DEFAULT_PROTOCOL_VERSION = "2025-03-26";
const MCP_ACCEPT = "application/json, text/event-stream";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    sendJson(response, 405, {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "This is a Streamable HTTP MCP endpoint. Use POST with a JSON-RPC request.",
        data: {
          service: "opc-startup-traffic-light",
          transport: "streamable-http",
          method: "POST",
          requiredAccept: MCP_ACCEPT,
        },
      },
      id: null,
    });
    return;
  }

  const normalized = normalizeBody(request.body);
  if (normalized.error) {
    sendJson(response, 400, {
      jsonrpc: "2.0",
      error: { code: -32700, message: "Invalid JSON body.", data: { trace_id: normalized.traceId } },
      id: null,
    });
    return;
  }
  normalizeRequestHeaders(request, normalized.body);

  const server = createOpcMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, normalized.body);
  } catch (error) {
    if (!response.headersSent) {
      const traceId = randomUUID();
      const clientError = isClientRequestError(error);
      console.error(JSON.stringify({ event: "mcp_request_error", trace_id: traceId, client_error: clientError, message: errorMessage(error) }));
      sendJson(response, clientError ? 400 : 500, {
        jsonrpc: "2.0",
        error: {
          code: clientError ? -32600 : -32603,
          message: clientError ? "Invalid MCP request." : "Internal MCP server error.",
          data: { trace_id: traceId },
        },
        id: null,
      });
    }
  } finally {
    await server.close().catch(() => undefined);
  }
}

function normalizeBody(body) {
  if (body === undefined || body === null || typeof body === "object" && !Buffer.isBuffer(body)) {
    return { body };
  }
  const text = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: true, traceId: randomUUID() };
  }
}

function normalizeRequestHeaders(request, body) {
  request.headers ??= {};
  setRequestHeader(request, "Accept", MCP_ACCEPT);
  setRequestHeader(request, "Content-Type", "application/json");
  if (!request.headers["mcp-protocol-version"]) {
    const requestedVersion = body?.method === "initialize" ? body?.params?.protocolVersion : undefined;
    setRequestHeader(request, "Mcp-Protocol-Version", requestedVersion || DEFAULT_PROTOCOL_VERSION);
  }
}

function setRequestHeader(request, name, value) {
  const lowerName = name.toLowerCase();
  request.headers[lowerName] = value;
  if (!Array.isArray(request.rawHeaders)) return;
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (String(request.rawHeaders[index]).toLowerCase() === lowerName) {
      request.rawHeaders[index + 1] = value;
      return;
    }
  }
  request.rawHeaders.push(name, value);
}

function isClientRequestError(error) {
  return /accept|content-type|json|json-rpc|request|protocol|validation|parse|invalid/i.test(errorMessage(error));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
