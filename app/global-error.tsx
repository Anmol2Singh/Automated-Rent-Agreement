'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-slate-50 min-h-screen flex items-center justify-center p-4 text-slate-900">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center max-w-md w-full space-y-4">
          <h2 className="text-lg font-bold">Global Application Error</h2>
          <p className="text-xs text-slate-500">{error.message}</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow"
          >
            Refresh Page
          </button>
        </div>
      </body>
    </html>
  );
}
