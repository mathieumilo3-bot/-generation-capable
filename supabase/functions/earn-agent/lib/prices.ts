import type { FetchFn } from './earn.ts';

const STABLES = new Set(['USDC', 'USDT', 'USDG', 'PYUSD', 'USDS', 'USD1', 'USD', 'USDE']);

// Fallback when Jupiter has no quote: CoinGecko ids for common reward tokens.
const COINGECKO_IDS: Record<string, string> = {
  SOL: 'solana',
  JUP: 'jupiter-exchange-solana',
  BONK: 'bonk',
  JTO: 'jito-governance-token',
  PYTH: 'pyth-network',
  WIF: 'dogwifcoin',
  RAY: 'raydium',
  ORCA: 'orca',
  HNT: 'helium',
  RENDER: 'render-token',
  W: 'wormhole',
  KMNO: 'kamino',
  DRIFT: 'drift-protocol',
  TNSR: 'tensor',
  ZEUS: 'zeus-network',
  CLOUD: 'sanctum-2',
  MET: 'meteora',
};

export interface PriceBook {
  [symbol: string]: { usd: number; source: string; at: string };
}

/**
 * USD price for each reward token symbol. Stablecoins are pegged to 1;
 * others come from Jupiter (by mint, from Earn's public token list) then
 * CoinGecko. A token with no quote stays absent: the scorer then skips the
 * listing rather than guessing its value.
 */
export async function priceTokens(
  symbols: string[],
  mints: Record<string, string>,
  fetchFn: FetchFn = fetch,
  now = new Date(),
): Promise<PriceBook> {
  const book: PriceBook = {};
  const at = now.toISOString();
  const wanted = [...new Set(symbols.map((s) => s.toUpperCase()))];
  for (const s of wanted) if (STABLES.has(s)) book[s] = { usd: 1, source: 'peg', at };

  const viaJup = wanted.filter((s) => !book[s] && mints[s]);
  if (viaJup.length) {
    try {
      const ids = viaJup.map((s) => mints[s]).join(',');
      const res = await fetchFn(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
      if (res.ok) {
        const data = (await res.json()) as Record<string, { usdPrice?: number }>;
        for (const s of viaJup) {
          const p = data[mints[s]]?.usdPrice;
          if (typeof p === 'number' && p > 0) book[s] = { usd: p, source: 'jupiter', at };
        }
      }
    } catch {
      // fall through to CoinGecko
    }
  }

  const viaCg = wanted.filter((s) => !book[s] && COINGECKO_IDS[s]);
  if (viaCg.length) {
    try {
      const ids = viaCg.map((s) => COINGECKO_IDS[s]).join(',');
      const res = await fetchFn(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (res.ok) {
        const data = (await res.json()) as Record<string, { usd?: number }>;
        for (const s of viaCg) {
          const p = data[COINGECKO_IDS[s]]?.usd;
          if (typeof p === 'number' && p > 0) book[s] = { usd: p, source: 'coingecko', at };
        }
      }
    } catch {
      // leave unpriced
    }
  }
  return book;
}
