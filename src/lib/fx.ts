/**
 * Currency support. Live rates come from Yahoo FX pairs, e.g. USDCAD=X
 * (units of the second currency per 1 of the first). Conversion is routed
 * through USD so cross pairs work even when no direct pair exists.
 */

export interface Currency {
  code: string;
  label: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'KRW', label: 'South Korean Won' },
  { code: 'SEK', label: 'Swedish Krona' },
  { code: 'NOK', label: 'Norwegian Krone' },
  { code: 'DKK', label: 'Danish Krone' },
  { code: 'ZAR', label: 'South African Rand' },
  { code: 'TRY', label: 'Turkish Lira' },
  { code: 'PLN', label: 'Polish Zloty' },
];

/** Yahoo FX pair symbol: units of `quote` per 1 `base`. */
export function fxSymbol(base: string, quote: string): string {
  return `${base}${quote}=X`;
}

export function currencyLabel(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

/** Format an amount with the target currency's typical precision. */
export function formatFxAmount(amount: number, code: string): string {
  const digits = code === 'JPY' || code === 'KRW' ? 0 : 2;
  try {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return amount.toFixed(digits);
  }
}

/** Common pairs shown on the FX page (base USD). */
export const COMMON_PAIRS = ['CAD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CNY', 'MXN'];
