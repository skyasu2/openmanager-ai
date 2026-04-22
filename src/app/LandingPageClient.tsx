'use client';

import dynamic from 'next/dynamic';

const LandingPageRuntime = dynamic(() => import('./LandingPageRuntime'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-4 pt-8 sm:px-6">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 h-10 w-56 animate-pulse rounded-full bg-white/10 sm:h-12 sm:w-72" />
          <div className="mx-auto h-5 w-full max-w-2xl animate-pulse rounded-full bg-white/8" />
        </div>
        <div className="mb-12 min-h-[30rem] rounded-[2rem] border border-white/10 bg-white/5" />
        <div className="mb-12 rounded-[2rem] border border-white/10 bg-black/15 px-4 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur-sm sm:px-6">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
});

export default function LandingPageClient() {
  return <LandingPageRuntime />;
}
