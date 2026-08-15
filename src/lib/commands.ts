/**
 * Bloomberg-style command definitions for the <GO> command bar.
 *
 * Mnemonics mirror the classic terminal (TOP, EQS, DES, HP…) mapped onto the
 * features Vault actually implements. `SYMBOL_ALIASES` translate common market
 * codes into Yahoo Finance symbols.
 */

import { isValidSymbol } from './yahoo';

export type CommandKind = 'route' | 'scroll';

export interface VaultCommand {
  /** Mnemonic, e.g. "TOP" */
  code: string;
  /** Human name */
  name: string;
  /** One-line description for the HELP legend / suggestions */
  description: string;
  kind: CommandKind;
  /** Route path (kind: route) or dashboard element id (kind: scroll) */
  target: string;
  aliases?: string[];
}

export const COMMANDS: VaultCommand[] = [
  {
    code: 'TOP',
    name: 'Top News',
    description: 'Breaking global business and market news',
    kind: 'scroll',
    target: 'news',
  },
  {
    code: 'NEWS',
    name: 'Market News',
    description: 'Headlines — same feed as TOP',
    kind: 'scroll',
    target: 'news',
    aliases: ['HEADLINES'],
  },
  {
    code: 'EQS',
    name: 'Equity Screening',
    description: 'Screen the liquid universe by change, volume and 52-week range',
    kind: 'route',
    target: '/screener',
    aliases: ['SCREEN', 'SCREENER'],
  },
  {
    code: 'MOVERS',
    name: 'Market Movers',
    description: 'Gainers, losers, most active, 52-week highs',
    kind: 'scroll',
    target: 'movers',
  },
  {
    code: 'SECTOR',
    name: 'Sector Rotation',
    description: "Today's sector ETF leaders and laggards",
    kind: 'scroll',
    target: 'sectors',
    aliases: ['ROTATION'],
  },
  {
    code: 'REGIME',
    name: 'Macro Regime',
    description: 'VIX fear gauge, yields, gold, silver, BTC, ETH',
    kind: 'scroll',
    target: 'regime',
    aliases: ['MACRO'],
  },
  {
    code: 'PORTFOLIO',
    name: 'Portfolio',
    description: 'Positions, P/L, allocation and option payoff diagrams',
    kind: 'scroll',
    target: 'portfolio',
    aliases: ['POS', 'POSITIONS'],
  },
  {
    code: 'WATCHLIST',
    name: 'Watchlist',
    description: 'Your tracked symbols with live quotes',
    kind: 'scroll',
    target: 'watchlist',
    aliases: ['WL'],
  },
  {
    code: 'SIZER',
    name: 'Position Sizing',
    description: 'Risk-based position size calculator (account %, entry, stop)',
    kind: 'route',
    target: '/sizer',
    aliases: ['SIZE', 'SIZING'],
  },
  {
    code: 'JOURNAL',
    name: 'Trade Journal',
    description: 'FIFO realized P/L, win rate, average hold, open lots',
    kind: 'route',
    target: '/journal',
    aliases: ['TRADES'],
  },
  {
    code: 'TERMINAL',
    name: 'Terminal',
    description: 'Back to the main terminal screen',
    kind: 'route',
    target: '/',
    aliases: ['HOME', 'MAIN'],
  },
  {
    code: 'HELP',
    name: 'Help',
    description: 'List all available commands',
    kind: 'route',
    target: '',
  },
];

/** Stock-page tab names understood by the command bar. */
export const SYMBOL_COMMANDS = new Map([
  ['DES', 'overview'],
  ['FA', 'overview'],
  ['HP', 'overview'],
  ['CHART', 'overview'],
  ['OPTIONS', 'options'],
  ['OP', 'options'],
  ['NEWS', 'news'],
]);

/** Common market codes → Yahoo Finance symbols. */
export const SYMBOL_ALIASES: Record<string, string> = {
  SPX: '^GSPC',
  SP500: '^GSPC',
  NDX: '^IXIC',
  NASDAQ: '^IXIC',
  INDU: '^DJI',
  DOW: '^DJI',
  RTY: '^RUT',
  RUT: '^RUT',
  VIX: '^VIX',
  TNX: '^TNX',
  TYX: '^TYX',
  GOLD: 'GC=F',
  XAU: 'GC=F',
  SILVER: 'SI=F',
  XAG: 'SI=F',
  BTC: 'BTC-USD',
  BITCOIN: 'BTC-USD',
  ETH: 'ETH-USD',
  ETHEREUM: 'ETH-USD',
};

/** Resolve any input token to a Yahoo symbol, or null. */
export function resolveSymbol(input: string): string | null {
  const upper = input.trim().toUpperCase();
  if (!upper) return null;
  if (SYMBOL_ALIASES[upper]) return SYMBOL_ALIASES[upper];
  if (isValidSymbol(upper)) return upper;
  return null;
}

/** True when the input looks like it could be a symbol (not a command). */
export function isSymbolish(input: string): boolean {
  return /^[A-Z0-9^.\-]{1,12}$/i.test(input.trim());
}
