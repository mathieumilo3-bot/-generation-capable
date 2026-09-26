/**
 * Faux serveur « OpenAI » (API Responses) pour les tests : l'application
 * l'appelle exactement comme l'API réelle, via OPENAI_BASE_URL.
 */
import { createServer, type Server } from "node:http";
import { fakeStructured } from "./fake-llm";

type Part = { type: string; text?: string };
export type MockBehaviour = (req: { name: string; text: string; hasPdf: boolean }) =>
  | { status: number; body: unknown }
  | null;

export function responseEnvelope(model: string, jsonText: string, status: "completed" | "incomplete" = "completed") {
  return {
    id: `resp_${Date.now()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status,
    incomplete_details: status === "incomplete" ? { reason: "max_output_tokens" } : null,
    error: null,
    model,
    output: [
      {
        type: "message",
        id: `msg_${Date.now()}`,
        status: status === "completed" ? "completed" : "incomplete",
        role: "assistant",
        content: [{ type: "output_text", text: jsonText, annotations: [] }],
      },
    ],
    usage: { input_tokens: 1200, output_tokens: 340, total_tokens: 1540 },
  };
}

export function startMockOpenAi(port: number, behaviour?: MockBehaviour): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.method === "GET") {
      res.writeHead(200).end("ok");
      return;
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        const body = JSON.parse(raw) as {
          model: string;
          input: { role: string; content: Part[] }[];
          text: { format: { name: string } };
        };
        const parts = body.input.flatMap((m) => m.content);
        const text = parts.map((p) => p.text ?? "").join("\n");
        const hasPdf = parts.some((p) => p.type === "input_file");
        const name = body.text.format.name;
        const custom = behaviour?.({ name, text, hasPdf });
        if (custom) {
          res.writeHead(custom.status, { "Content-Type": "application/json" }).end(JSON.stringify(custom.body));
          return;
        }
        const result = fakeStructured(name, text, hasPdf);
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(responseEnvelope(body.model, JSON.stringify(result))));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: String(err), type: "server_error" } }));
      }
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
