import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, BellPlus, BriefcaseBusiness, BookOpenText, Calculator, Eye, EyeOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useYahooChart, useYahooOptions, useYahooSearch } from '@/hooks/useYahoo';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useToast } from '@/hooks/useToast';

import { CandleChart, type ChartOverlays } from '@/components/terminal/CandleChart';
import { IndicatorToolbar } from '@/components/terminal/IndicatorToolbar';
import { OptionsChain } from '@/components/terminal/OptionsChain';
import { NewsFeed } from '@/components/terminal/NewsFeed';
import { PriceChange } from '@/components/terminal/PriceChange';
import { AddPositionDialog } from '@/components/terminal/AddPositionDialog';
import { AddAlertDialog } from '@/components/terminal/AddAlertDialog';
import { AddTradeDialog } from '@/components/terminal/AddTradeDialog';
import { SnapshotsPanel } from '@/components/terminal/SnapshotsPanel';
import { SupplyChainPanel } from '@/components/terminal/SupplyChainPanel';
import { FundamentalsPanel } from '@/components/terminal/FundamentalsPanel';

import { useFxRate } from '@/hooks/useFx';
import { CURRENCIES } from '@/lib/fx';

import { CHART_RANGES, DEFAULT_RANGE, isValidSymbol, normalizeSymbol } from '@/lib/yahoo';
import { formatCompact, formatPrice, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const StockPage = () => {
  const { symbol: raw } = useParams();
  const symbol = normalizeSymbol(raw ?? '');
  const valid = isValidSymbol(symbol);

  const [searchParams] = useSearchParams();
  const [rangeKey, setRangeKey] = useState(DEFAULT_RANGE);
  const [addPosOpen, setAddPosOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [overlays, setOverlays] = useState<ChartOverlays>({});
  // ?tab=options (set by the command bar) opens straight into that tab.
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'overview');

  const chart = useYahooChart(symbol, rangeKey, valid);
  const info = useYahooSearch(symbol, valid);
  // Fetch the (large) options chain only when the user opens the Options tab.
  const options = useYahooOptions(symbol, valid && tab === 'options');
  // USD equivalent for non-USD listings (e.g. CAD tickers).
  const metaCurrency = chart.data?.meta?.currency;
  const usdRate = useFxRate('USD', metaCurrency ?? 'USD');

  const { watchlist, save, user } = useWatchlist();
  const { toast } = useToast();

  const watched = useMemo(() => watchlist.includes(symbol), [watchlist, symbol]);

  const meta = chart.data?.meta;
  const prev = meta?.chartPreviousClose ?? meta?.previousClose;
  const price = meta?.regularMarketPrice;
  const change = price !== undefined && typeof prev === 'number' ? price - prev : null;
  const pct = change !== null && prev ? (change / prev) * 100 : null;
  const candles = chart.data?.candles ?? [];
  const open = candles[0]?.o;
  const firstQuote = info.data?.quotes?.[0];
  const news = info.data?.news ?? [];

  useSeoMeta({
    title: `${symbol} — Vault Terminal`,
    description: `${meta?.longName ?? symbol} live price, chart, options chain and corporate news.`,
  });

  const toggleWatch = async () => {
    if (!user) {
      toast({ title: 'Not logged in', description: 'Connect your Nostr account to save a watchlist.' });
      return;
    }
    try {
      if (watched) {
        await save(watchlist.filter((s) => s !== symbol));
      } else {
        await save([...watchlist, symbol]);
      }
      toast({ title: watched ? 'Removed from watchlist' : 'Added to watchlist', description: symbol });
    } catch {
      toast({ title: 'Failed to update watchlist', variant: 'destructive' });
    }
  };

  if (!valid) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          “{raw}” is not a valid symbol. Go back to the terminal and pick a ticker.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/">Back to terminal</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quote header */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/"
              className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3" /> TERMINAL
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-bold tracking-wider">{symbol}</h1>
              {watched ? (
                <Badge variant="outline" className="gap-1 font-mono text-[10px] text-signal">
                  <Eye className="size-3" /> WATCHED
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {meta?.longName ?? meta?.shortName ?? firstQuote?.longname ?? firstQuote?.shortname ?? '—'}
              {meta?.fullExchangeName || firstQuote?.exchDisp ? ` · ${meta?.fullExchangeName ?? firstQuote?.exchDisp}` : ''}
            </p>
            {(firstQuote?.sector || firstQuote?.industry) && (
              <p className="text-xs text-muted-foreground">
                {[firstQuote?.sector, firstQuote?.industry].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="font-mono text-4xl font-bold tabular-nums">{formatPrice(price)}</div>
              {metaCurrency && metaCurrency !== 'USD' && CURRENCIES.some((c) => c.code === metaCurrency) ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                  {metaCurrency}
                </span>
              ) : null}
            </div>
            <PriceChange change={change} percent={pct} className="text-lg" />
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              PREV CLOSE {formatPrice(prev)}
            </div>
            {metaCurrency && metaCurrency !== 'USD' && CURRENCIES.some((c) => c.code === metaCurrency) && typeof price === 'number' && usdRate.data ? (
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                ≈ ${(price / usdRate.data).toFixed(2)} USD
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={toggleWatch} size="sm" variant={watched ? 'outline' : 'default'} className="font-mono text-xs">
            {watched ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {watched ? 'WATCHED' : 'WATCH'}
          </Button>
          <Button onClick={() => setAddPosOpen(true)} size="sm" variant="outline" className="font-mono text-xs">
            <BriefcaseBusiness className="size-3.5" /> TRACK POSITION
          </Button>
          <Button onClick={() => setAlertOpen(true)} size="sm" variant="outline" className="font-mono text-xs">
            <BellPlus className="size-3.5" /> ALERT
          </Button>
          <Button onClick={() => setTradeOpen(true)} size="sm" variant="outline" className="font-mono text-xs">
            <BookOpenText className="size-3.5" /> LOG TRADE
          </Button>
          <Button asChild size="sm" variant="outline" className="font-mono text-xs">
            <Link to={`/sizer?symbol=${symbol}&entry=${typeof price === 'number' ? price : ''}`}>
              <Calculator className="size-3.5" /> SIZER
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="OPEN" value={formatPrice(open)} />
          <Stat label="PREV CLOSE" value={formatPrice(prev)} />
          <Stat
            label="DAY RANGE"
            value={
              <span className="text-xs">
                {formatPrice(meta?.regularMarketDayLow)} – {formatPrice(meta?.regularMarketDayHigh)}
              </span>
            }
          />
          <Stat
            label="52W RANGE"
            value={
              <span className="text-xs">
                {formatPrice(meta?.fiftyTwoWeekLow)} – {formatPrice(meta?.fiftyTwoWeekHigh)}
              </span>
            }
          />
          <Stat label="VOLUME" value={formatCompact(meta?.regularMarketVolume)} />
          <Stat label="UPDATED" value={meta?.regularMarketTime ? formatTime(meta.regularMarketTime) : '—'} />
        </div>
      </section>

      {/* Chart */}
      <section className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xs font-bold tracking-widest">PRICE CHART</h2>
            <span className="font-mono text-[10px] text-muted-foreground">{CHART_RANGES[rangeKey]?.range}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(CHART_RANGES).map(([key, r]) => (
              <button
                key={key}
                onClick={() => setRangeKey(key)}
                className={cn(
                  'rounded px-2 py-1 font-mono text-[11px] font-semibold transition-colors',
                  rangeKey === key ? 'bg-signal/15 text-signal' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">INDICATORS</span>
          <IndicatorToolbar value={overlays} onChange={setOverlays} />
        </div>

        {chart.isPending && !chart.data ? (
          <Skeleton className="w-full" style={{ height: 340 }} />
        ) : chart.isError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Could not load chart data for {symbol}. It may be delisted or the feed is unreachable — try
            refreshing.
          </p>
        ) : (
          <CandleChart candles={candles} height={340} overlays={overlays} />
        )}
      </section>

      {/* Nostr snapshot history (written by server/market-snapshot.mjs) */}
      <SnapshotsPanel symbol={symbol} />

      {/* Detail tabs */}
      <section className="rounded-lg border border-border bg-card p-3">
        <Tabs defaultValue="overview" value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="font-mono text-xs">OVERVIEW</TabsTrigger>
            <TabsTrigger value="fundamentals" className="font-mono text-xs">FUNDAMENTALS</TabsTrigger>
            <TabsTrigger value="options" className="font-mono text-xs">OPTIONS</TabsTrigger>
            <TabsTrigger value="news" className="font-mono text-xs">NEWS</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="EXCHANGE" value={meta?.fullExchangeName ?? firstQuote?.exchDisp ?? '—'} />
              <Stat label="TYPE" value={meta?.instrumentType ?? firstQuote?.typeDisp ?? '—'} />
              <Stat label="CURRENCY" value={meta?.currency ?? '—'} />
              <Stat label="SECTOR" value={firstQuote?.sector ?? '—'} />
              <Stat label="INDUSTRY" value={firstQuote?.industry ?? '—'} />
              <Stat label="DATA FEED" value="YAHOO / CBOE" />
            </div>
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Quotes and chart data are delayed via Yahoo Finance; the options chain is delayed via CBOE.
              Head to the <span className="font-semibold text-foreground">OPTIONS</span> tab for the full
              calls/puts chain with greeks, or <span className="font-semibold text-foreground">NEWS</span> for
              recent corporate updates. Add {symbol} to your watchlist to keep it on the terminal home
              screen, and track it as a position to see live P/L.
            </p>

            <div className="mt-4">
              <SupplyChainPanel symbol={symbol} />
            </div>
          </TabsContent>

          <TabsContent value="fundamentals" className="pt-4">
            <FundamentalsPanel symbol={symbol} />
          </TabsContent>

          <TabsContent value="options" className="pt-4">
            <OptionsChain
              symbol={symbol}
              underlyingPrice={price ?? null}
              options={options.data}
              isLoading={options.isPending}
              isError={options.isError}
            />
          </TabsContent>

          <TabsContent value="news" className="pt-2">
            <NewsFeed items={news} />
          </TabsContent>
        </Tabs>
      </section>

      <AddPositionDialog open={addPosOpen} onOpenChange={setAddPosOpen} />
      <AddAlertDialog symbol={symbol} open={alertOpen} onOpenChange={setAlertOpen} />
      <AddTradeDialog open={tradeOpen} onOpenChange={setTradeOpen} initialSymbol={symbol} />
    </div>
  );
};

export default StockPage;
