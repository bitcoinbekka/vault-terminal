import { useSeoMeta } from '@unhead/react';
import { Newspaper } from 'lucide-react';

import { useYahooSearch } from '@/hooks/useYahoo';

import { MarketIndices } from '@/components/terminal/MarketIndices';
import { MarketRegime } from '@/components/terminal/MarketRegime';
import { WatchlistPanel } from '@/components/terminal/WatchlistPanel';
import { TrendingPanel } from '@/components/terminal/TrendingPanel';
import { PortfolioPanel } from '@/components/terminal/PortfolioPanel';
import { SectorRotation } from '@/components/terminal/SectorRotation';
import { SectorDiscover } from '@/components/terminal/SectorDiscover';
import { MoversScanner } from '@/components/terminal/MoversScanner';
import { ExtendedHoursPanel } from '@/components/terminal/ExtendedHoursPanel';
import { OptionsFlow } from '@/components/terminal/OptionsFlow';
import { NewsFeed } from '@/components/terminal/NewsFeed';
import { Panel } from '@/components/terminal/Panel';
import { LazyPanel } from '@/components/terminal/LazyPanel';

const Index = () => {
  useSeoMeta({
    title: 'Vault Terminal — Decentralized Market Terminal',
    description:
      'Track your stocks, options and portfolio with a Bloomberg-style terminal. Watchlist, positions and alerts live on Nostr.',
  });

  const marketNews = useYahooSearch('stocks');

  return (
    <div className="space-y-4">
      {/* Your positions first — right under the ticker */}
      <PortfolioPanel />

      <MarketIndices />
      <MarketRegime />

      <WatchlistPanel />

      {/* Heavy scanner panels are lazy: they only fetch when scrolled into
          view, keeping the initial load small (Yahoo rate-limits the server IP). */}
      <LazyPanel title="MARKET MOVERS">
        <MoversScanner />
      </LazyPanel>

      <LazyPanel title="EXTENDED HOURS // OVERNIGHT MOVERS">
        <ExtendedHoursPanel />
      </LazyPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <LazyPanel title="TRENDING // MARKETS">
          <TrendingPanel />
        </LazyPanel>
        <LazyPanel title="SECTOR ROTATION // TODAY'S LEADERS">
          <SectorRotation />
        </LazyPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LazyPanel title="DISCOVER BY SECTOR">
          <SectorDiscover />
        </LazyPanel>
        <OptionsFlow />
      </div>

      <Panel
        title="MARKET NEWS"
        id="news"
        right={<Newspaper className="size-3.5 text-muted-foreground" />}
      >
        <NewsFeed items={marketNews.data?.news ?? []} compact />
      </Panel>
    </div>
  );
};

export default Index;
