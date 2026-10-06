import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeTus {
  url: string;
  close(): Promise<void>;
  uploads: Map<string, { length: number; data: Buffer[]; received: number; metadata: string }>;
  stats: { creates: number; patches: number; heads: number; bytesReceived: number };
  /** Coupe la connexion au milieu du N-ième PATCH (après `afterBytes` octets). */
  dropOnPatch(n: number, afterBytes: number): void;
  failOnPatch(n: number, status: number): void;
  expireAll(): void;
  rejectAuth(count: number): void;
}

export async function startFakeTus(): Promise<FakeTus> {
  const uploads: FakeTus["uploads"] = new Map();
  const stats = { creates: 0, patches: 0, heads: 0, bytesReceived: 0 };
  let drop: { n: number; after: number } | null = null;
  const fails = new Map<number, number>();
  let authFails = 0;
  let id = 0;

  const server: Server = createServer(async (req: IncomingMessage, res) => {
    const base = `http://${req.headers.host}`;
    const u = new URL(req.url ?? "/", base);
    res.setHeader("Tus-Resumable", "1.0.0");
    if (authFails > 0) { authFails--; res.statusCode = 401; res.end(); return; }

    if (req.method === "POST") {
      stats.creates++;
      const key = `u${++id}`;
      uploads.set(key, { length: Number(req.headers["upload-length"]), data: [], received: 0, metadata: String(req.headers["upload-metadata"] ?? "") });
      res.statusCode = 201; res.setHeader("Location", `${base}/files/${key}`); res.end(); return;
    }
    const key = u.pathname.split("/").pop() ?? "";
    const up = uploads.get(key);
    if (!up) { res.statusCode = 404; res.end(); return; }

    if (req.method === "HEAD") {
      stats.heads++;
      res.setHeader("Upload-Offset", String(up.received)); res.setHeader("Upload-Length", String(up.length));
      res.statusCode = 200; res.end(); return;
    }
    if (req.method === "PATCH") {
      stats.patches++;
      const n = stats.patches;
      const st = fails.get(n);
      if (st) { res.statusCode = st; res.end(); return; }
      if (Number(req.headers["upload-offset"]) !== up.received) { res.statusCode = 409; res.end(); return; }
      const chunks: Buffer[] = [];
      let got = 0;
      for await (const c of req) {
        chunks.push(c as Buffer); got += (c as Buffer).length;
        if (drop && drop.n === n && got >= drop.after) {
          // L'octet reçu avant la coupure est conservé jusqu'à `after` (comportement TUS : offset partiel).
          const partial = Buffer.concat(chunks).subarray(0, drop.after);
          up.data.push(partial); up.received += partial.length; stats.bytesReceived += partial.length;
          drop = null;
          req.socket.destroy();
          return;
        }
      }
      const body = Buffer.concat(chunks);
      up.data.push(body); up.received += body.length; stats.bytesReceived += body.length;
      res.statusCode = 204; res.setHeader("Upload-Offset", String(up.received)); res.end(); return;
    }
    res.statusCode = 405; res.end();
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/upload`, uploads, stats,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
    dropOnPatch: (n, after) => { drop = { n, after }; },
    failOnPatch: (n, status) => { fails.set(n, status); },
    expireAll: () => uploads.clear(),
    rejectAuth: (c) => { authFails = c; },
  };
}
