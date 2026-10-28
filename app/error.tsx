"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap py-24 text-center">
      <h1 className="page-title">The candle flickered</h1>
      <p className="intro mx-auto">This page failed to load. Nothing in your wallet changed. Try again, and if it keeps happening, check back in a few minutes.</p>
      <div className="mt-8">
        <button type="button" className="btn" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
