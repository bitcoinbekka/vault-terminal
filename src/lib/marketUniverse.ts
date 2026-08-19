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

export const SECTOR_NAMES: Record<string, string> = {
  XLK: 'Technology',
  XLF: 'Financials',
  XLE: 'Energy',
  XLV: 'Health Care',
  XLI: 'Industrials',
  XLY: 'Consumer Disc.',
  XLP: 'Consumer Staples',
  XLU: 'Utilities',
  XLB: 'Materials',
  XLRE: 'Real Estate',
  XLC: 'Communication',
};

/** Popular liquid names per sector, for the "Discover by sector" panel. */
export const SECTOR_SYMBOLS: Record<string, string[]> = {
  XLK: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'AMD', 'INTC', 'ADBE', 'CSCO', 'QCOM', 'TXN', 'IBM', 'MU', 'PLTR', 'PANW', 'NOW', 'ANET', 'SMCI', 'AMAT'],
  XLF: ['JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP', 'WFC', 'C', 'SCHW', 'BLK', 'USB', 'PYPL', 'HOOD', 'COF', 'PNC'],
  XLE: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MP', 'OXY', 'KMI', 'WMB', 'HAL', 'FANG', 'PSX', 'VLO', 'MPC'],
  XLV: ['UNH', 'JNJ', 'LLY', 'MRK', 'ABBV', 'PFE', 'TMO', 'ABT', 'DHR', 'AMGN', 'GILD', 'BMY', 'ISRG', 'VRTX', 'REGN', 'CVS'],
  XLI: ['CAT', 'BA', 'GE', 'HON', 'RTX', 'UPS', 'UNP', 'LMT', 'GD', 'NOC', 'DE', 'WM', 'ETN', 'CMI', 'PH', 'EMR'],
  XLY: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 'BKNG', 'TJX', 'CMG', 'MAR', 'HLT', 'LULU', 'RCL', 'YUM', 'TGT'],
  XLP: ['PG', 'COST', 'WMT', 'KO', 'PEP', 'PM', 'MO', 'CL', 'GIS', 'KMB', 'KHC', 'STZ', 'EL', 'SYY', 'MDLZ'],
  XLU: ['NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'XEL', 'SRE', 'ED', 'PEG', 'EIX', 'WEC', 'ES', 'CMS'],
  XLB: ['LYB', 'DOW', 'NEM', 'FCX', 'NUE', 'SHW', 'APD', 'LIN', 'MLM', 'VMC', 'ECL', 'CTVA', 'PPG', 'IFF'],
  XLRE: ['AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'PSA', 'WELL', 'O', 'AVB', 'EQR', 'DLR', 'BXP', 'VTR', 'ARE'],
  XLC: ['GOOGL', 'META', 'NFLX', 'DIS', 'TMUS', 'VZ', 'T', 'CMCSA', 'WBD', 'EA', 'TTWO', 'PARA', 'LYV', 'ROKU'],
};

export const MOVER_UNIVERSE = [...SECTOR_ETFS, ...MEGA_CAPS];

export const UNIVERSE_LIMIT = 40;
