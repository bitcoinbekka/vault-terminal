/**
 * A curated liquid universe used by the movers scanner: mega-cap equities
 * plus sector ETFs. All are valid Yahoo Finance symbols.
 */

export const MEGA_CAPS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO',
  'AMD', 'NFLX', 'INTC', 'CRM', 'ORCL', 'ADBE', 'CSCO', 'QCOM',
  'TXN', 'IBM', 'MU', 'PLTR', 'COIN', 'HOOD', 'UBER', 'JPM',
  'BAC', 'GS', 'XOM', 'CVX', 'WMT', 'COST', 'DIS', 'NKE',
];

export const SECTOR_ETFS = [
  'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC',
];

export const MOVER_UNIVERSE = [...SECTOR_ETFS, ...MEGA_CAPS];

export const UNIVERSE_LIMIT = 40;
