import { useSeoMeta } from '@unhead/react';
import { Newspaper } from 'lucide-react';

import { useYahooSearch } from '@/hooks/useYahoo';

import { MarketIndices } from '@/components/terminal/MarketIndices';
import { WatchlistPanel } from '@/components/terminal/WatchlistPanel';
import { TrendingPanel } from '@/components/terminal/TrendingPanel';
import { PortfolioPanel } from '@/components/terminal/PortfolioPanel';
import { MoversScanner } from '@/components/terminal/MoversScanner';
import { OptionsFlow } from '@/components/terminal/OptionsFlow';
import { NewsFeed } from '@/components/terminal/NewsFeed';
import { Panel } from '@/components/terminal/Panel';

const Index = () => {
  useSeoMeta({
    title: 'Vault Terminal — Decentralized Market Terminal',
    description:
      'Track your stocks, options and portfolio with a Bloomberg-style terminal. Watchlist, positions and alerts live on Nostr.',
  });

  const marketNews = useYahooSearch('stocks');

  return (
    <div className="space-y-4">
      <MarketIndices />

      <div className="grid gap-4 lg:grid-cols-3">
        <WatchlistPanel className="lg:col-span-2" />
        <TrendingPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MoversScanner className="lg:col-span-2" />
        <OptionsFlow />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PortfolioPanel className="lg:col-span-2" />
        <Panel
          title="MARKET NEWS"
          id="news"
          right={<Newspaper className="size-3.5 text-muted-foreground" />}
        >
          <NewsFeed items={marketNews.data?.news ?? []} compact />
        </Panel>
      </div>
    </div>
  );
};

export default Index;
