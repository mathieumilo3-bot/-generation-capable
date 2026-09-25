/**
 * Faux serveur « OpenAI » pour les tests bout-en-bout : l'application l'appelle
 * exactement comme l'API réelle (OPENAI_BASE_URL), sans aucun code de test
 * dans l'application. Les réponses viennent du double déterministe partagé.
 */
import { createServer } from "node:http";
import { fakeStructured } from "../tests/support/fake-llm";

type Part = { type: string; text?: string };

const port = Number(process.env.MOCK_OPENAI_PORT ?? 4010);

createServer((req, res) => {
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
        messages: { role: string; content: string | Part[] }[];
        response_format: { json_schema: { name: string } };
      };
      const user = body.messages.find((m) => m.role === "user")!;
      const parts: Part[] = typeof user.content === "string" ? [{ type: "text", text: user.content }] : user.content;
      const text = parts.map((p) => p.text ?? "").join("\n");
      const hasPdf = parts.some((p) => p.type === "file");
      const result = fakeStructured(body.response_format.json_schema.name, text, hasPdf);
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: body.model,
          choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(result), refusal: null }, finish_reason: "stop", logprobs: null }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: String(err) } }));
    }
  });
}).listen(port, "127.0.0.1", () => console.log(`mock-openai sur ${port}`));
