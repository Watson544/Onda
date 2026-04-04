'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import type { VibeSubmission } from '@/lib/types';
import FeedItem from '@/components/FeedItem';

export default function FeedPage() {
  const [items,   setItems]   = useState<VibeSubmission[]>([]);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = items.length < total || page === 1;

  const loadPage = useCallback(async (p: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.vibes.feed(p);
      setItems(prev => p === 1 ? res.data : [...prev, ...res.data]);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Initial load
  useEffect(() => { loadPage(1); }, []); // eslint-disable-line

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && items.length < total) {
        const next = page + 1;
        setPage(next);
        loadPage(next);
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, items.length, total, page, loadPage]);

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-zinc-100">Vibe Feed</h1>
        <span className="text-xs text-zinc-500">{total} submissions</span>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {items.length === 0 && !loading ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🎵</div>
          <p className="text-zinc-400">No vibes yet. Be the first to check in!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(sub => <FeedItem key={sub.id} sub={sub} />)}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
        {loading && (
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {!loading && items.length >= total && total > 0 && (
          <p className="text-xs text-zinc-600">You've seen it all</p>
        )}
      </div>
    </div>
  );
}
