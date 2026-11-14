import React, { useState, useEffect } from 'react';
import {
  History,
  Trash2,
  Download,
  Eye,
  Film,
  Image as ImageIcon,
  Search,
  Filter,
  Sparkles,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { HistoryItem } from '../types';
import { api } from '../services/api';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';

export const HistoryPage: React.FC = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  const loadHistory = async () => {
    try {
      const data = await api.getHistory();
      setItems(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteHistoryItem(id);
      setItems(items.filter((i) => i.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear your entire processing history?')) {
      await api.clearHistory();
      setItems([]);
      setSelectedItem(null);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesType = filterType === 'all' || item.media_type === filterType;
    const matchesSearch = item.filename.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
              Vault
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Processing History</h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Review, compare, and download previously cleaned image and video files.
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#12141e]/90 p-3 shadow-xl backdrop-blur-md">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-black/40 p-1">
          {(['all', 'image', 'video'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                filterType === type
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {type === 'all' ? 'All Media' : `${type}s`}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* History Grid */}
      {filteredItems.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-slate-500 mb-4">
            <History className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-white">No items found</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            Cleaned media files will appear here automatically with before/after comparisons and original downloads.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#12141e]/80 shadow-xl backdrop-blur-md transition-all hover:border-purple-500/40 hover:bg-[#151824]"
            >
              {/* Media Preview Box */}
              <div
                onClick={() => setSelectedItem(item)}
                className="relative h-44 w-full cursor-pointer overflow-hidden bg-black/50"
              >
                {item.media_type === 'video' ? (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-purple-950/40 to-slate-900">
                    <Film className="h-10 w-10 text-purple-400/80 group-hover:scale-110 transition-transform" />
                    <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-purple-300">
                      MP4
                    </span>
                  </div>
                ) : (
                  <img
                    src={item.result_url || item.original_url}
                    alt={item.filename}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}

                {/* Inspect Overlay Pill */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white shadow-lg border border-white/20">
                    <Eye className="h-3.5 w-3.5 text-purple-400" />
                    <span>Compare Before / After</span>
                  </span>
                </div>
              </div>

              {/* Item Details */}
              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-bold text-white max-w-[180px]">
                    {item.filename}
                  </span>
                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300 uppercase">
                    {item.media_type}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{item.resolution || 'Auto'}</span>
                  <span>•</span>
                  <span>{item.algorithm_used}</span>
                  <span>•</span>
                  <span>{item.processing_time_sec ? `${item.processing_time_sec}s` : 'Instant'}</span>
                </div>

                {/* Actions Footer */}
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{item.created_at}</span>

                  <div className="flex items-center gap-2">
                    {item.result_url && (
                      <a
                        href={item.result_url}
                        download={`clean_${item.filename}`}
                        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:text-white hover:bg-white/10"
                        title="Download Cleaned Media"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg border border-rose-500/20 p-1.5 text-rose-400 hover:bg-rose-500/10"
                      title="Delete Entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Before / After Inspection Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-[#12141e] p-6 shadow-2xl">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">
              Before / After Inspection: {selectedItem.filename}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Restored with {selectedItem.algorithm_used}
            </p>

            {selectedItem.media_type === 'image' && selectedItem.result_url ? (
              <BeforeAfterSlider
                originalUrl={selectedItem.original_url}
                cleanedUrl={selectedItem.result_url}
                originalLabel="Original with Overlay"
                cleanedLabel="AI Reconstructed"
              />
            ) : selectedItem.media_type === 'video' && selectedItem.result_url ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <video
                  src={selectedItem.result_url}
                  controls
                  className="max-h-[60vh] rounded-xl border border-white/10"
                />
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Close
              </button>
              {selectedItem.result_url && (
                <a
                  href={selectedItem.result_url}
                  download
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/25 hover:bg-purple-500"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Cleaned File</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
