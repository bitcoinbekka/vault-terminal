import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import { TerminalLayout } from "@/components/terminal/TerminalLayout";
import Index from "./pages/Index";
import StockPage from "./pages/StockPage";
import JournalPage from "./pages/JournalPage";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<TerminalLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/stock/:symbol" element={<StockPage />} />
          <Route path="/journal" element={<JournalPage />} />
          {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
          <Route path="/:nip19" element={<NIP19Page />} />
        </Route>
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
