import type { AdminDb, SelectQuery, SelectResult } from "../src/data/db";

export interface RpcCall { fn: string; args: Record<string, unknown> }

export interface FakeDb extends AdminDb {
  rpcCalls: RpcCall[];
  selectCalls: SelectQuery[];
}

/** Faux AdminDb : enregistre les appels et renvoie des réponses prédéfinies. */
export function fakeDb(opts: {
  rpc?: Record<string, unknown>;
  /** Réponses calculées à partir des arguments. */
  rpcFn?: Record<string, (args: Record<string, unknown>) => unknown>;
  select?: Record<string, SelectResult | ((q: SelectQuery) => SelectResult)>;
} = {}): FakeDb {
  const rpcCalls: RpcCall[] = [];
  const selectCalls: SelectQuery[] = [];
  return {
    rpcCalls,
    selectCalls,
    async rpc(fn, args = {}) {
      rpcCalls.push({ fn, args });
      const f = opts.rpcFn?.[fn];
      if (f) return f(args);
      const r = opts.rpc?.[fn];
      if (r === undefined) throw new Error(`rpc inattendu : ${fn}`);
      return r;
    },
    async select(q) {
      selectCalls.push(q);
      const r = opts.select?.[q.table];
      if (r === undefined) throw new Error(`select inattendu : ${q.table}`);
      return typeof r === "function" ? r(q) : r;
    },
  };
}
