import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './pages/LandingPage';
import { ImageCleanerPage } from './pages/ImageCleanerPage';
import { VideoCleanerPage } from './pages/VideoCleanerPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { HistoryPage } from './pages/HistoryPage';
import { PricingPage } from './pages/PricingPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { UserProfile, HistoryItem, PricingPlan, SampleMedia } from './types';
import { api } from './services/api';
import { ShieldCheck, Heart, Sparkles, Terminal } from 'lucide-react';

export function App() {
  const [currentPage, setCurrentPage] = useState<string>('landing');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [samples, setSamples] = useState<SampleMedia[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Preloaded sample state when launched from landing page
  const [preloadedMediaId, setPreloadedMediaId] = useState<string | undefined>(undefined);
  const [preloadedUrl, setPreloadedUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Load initial app data
    const loadAppData = async () => {
      try {
        const [u, h, p, s] = await Promise.all([
          api.getCurrentUser().catch(() => null),
          api.getHistory().catch(() => []),
          api.getPricing().catch(() => []),
          api.getSampleMedia().catch(() => []),
        ]);
        if (u) setUser(u);
        setHistoryItems(h);
        setPricingPlans(p);
        setSamples(s);
      } catch (err) {
        console.error('Initial data load error:', err);
      }
    };
    loadAppData();
  }, []);

  const handleSelectSample = (sample: SampleMedia) => {
    if (sample.type === 'image') {
      setPreloadedUrl(sample.url);
      setPreloadedMediaId(sample.filename.replace(/\.[^/.]+$/, ''));
      setCurrentPage('image-cleaner');
    } else {
      setPreloadedUrl(sample.url);
      setPreloadedMediaId(sample.filename.replace(/\.[^/.]+$/, ''));
      setCurrentPage('video-cleaner');
    }
  };

  const handleJobCompleted = () => {
    // Refresh history and user credits
    api.getHistory().then(setHistoryItems).catch(console.error);
    api.getCurrentUser().then(setUser).catch(console.error);
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 flex flex-col selection:bg-purple-500/30 selection:text-purple-200">
      {/* Top Navigation */}
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {currentPage === 'landing' && (
          <LandingPage
            onNavigate={setCurrentPage}
            onSelectSample={handleSelectSample}
            samples={samples}
          />
        )}

        {currentPage === 'image-cleaner' && (
          <ImageCleanerPage
            onJobCompleted={handleJobCompleted}
            preloadedMediaId={preloadedMediaId}
            preloadedUrl={preloadedUrl}
          />
        )}

        {currentPage === 'video-cleaner' && (
          <VideoCleanerPage
            onJobInitiated={handleJobCompleted}
          />
        )}

        {currentPage === 'workspace' && (
          <WorkspacePage onNavigate={setCurrentPage} />
        )}

        {currentPage === 'history' && (
          <HistoryPage />
        )}

        {currentPage === 'pricing' && (
          <PricingPage
            plans={pricingPlans}
            user={user}
            onUserUpdate={setUser}
          />
        )}

        {currentPage === 'dashboard' && (
          <DashboardPage
            user={user}
            history={historyItems}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'settings' && (
          <SettingsPage />
        )}
      </main>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => setUser(u)}
      />

      {/* Global Footer */}
      <footer className="mt-20 border-t border-white/5 bg-[#0a0b12] py-12 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-bold text-white tracking-tight">CleanFrame AI</span>
              <span className="text-slate-600">|</span>
              <span>Intelligent Media Restoration & Overlay Inpainting</span>
            </div>

            <div className="flex items-center gap-6">
              <button onClick={() => setCurrentPage('image-cleaner')} className="hover:text-white transition-colors">
                Image Studio
              </button>
              <button onClick={() => setCurrentPage('video-cleaner')} className="hover:text-white transition-colors">
                Video Studio
              </button>
              <button onClick={() => setCurrentPage('pricing')} className="hover:text-white transition-colors">
                Pricing
              </button>
              <button onClick={() => setCurrentPage('settings')} className="hover:text-white transition-colors">
                Settings
              </button>
            </div>

            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="font-medium text-[11px]">Authorized Content Use Only</span>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-600">
            <p>© 2026 CleanFrame AI Inc. Built with OpenCV, PyTorch, FFmpeg, React & FastAPI.</p>
            <p>Designed for creators and production studios holding editing rights to their content.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
