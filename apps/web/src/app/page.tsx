"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Layers, ShieldCheck, Server, ArrowRight } from "lucide-react";

interface HealthData {
  status: string;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      // Calls /api/v1/health through Next.js rewrites proxy
      const res = await fetch("/api/v1/health");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err?.message || "Failed to connect to API");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12 font-sans">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white font-bold px-2.5 py-0.5 rounded text-sm tracking-wide">
                BILLABLE
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                Phase 1: Foundation
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Multi-tenant Invoicing Platform
            </h1>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition self-start sm:self-auto cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Status
          </button>
        </header>

        {/* Health Check Status Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-slate-200">
                Backend Connection (/api/v1/health via Proxy Rewrite)
              </h2>
            </div>
            {loading ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Connecting...
              </span>
            ) : health ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                API Online (HTTP 200)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <XCircle className="w-3.5 h-3.5" />
                Disconnected
              </span>
            )}
          </div>

          {health && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800/80">
                <span className="text-slate-400 block mb-1">Service</span>
                <span className="font-mono text-slate-200 font-semibold">{health.service}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800/80">
                <span className="text-slate-400 block mb-1">API Timestamp</span>
                <span className="font-mono text-slate-200">{health.timestamp}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800/80">
                <span className="text-slate-400 block mb-1">Process Uptime</span>
                <span className="font-mono text-slate-200">{health.uptimeSeconds}s</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
              Error: {error}
            </div>
          )}
        </div>

        {/* Phase 1 Verification Checklist */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Architecture & Foundation Checklist</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-200">npm Workspaces Monorepo</span>
                <p className="text-slate-400 mt-0.5">Unified workspace with <code className="text-slate-300">apps/api</code> and <code className="text-slate-300">apps/web</code>.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-200">First-Party Cookie Rewrites</span>
                <p className="text-slate-400 mt-0.5">Next.js proxies <code className="text-slate-300">/api/*</code> to avoid cross-domain cookie issues.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-200">Global Security & Validation</span>
                <p className="text-slate-400 mt-0.5">Helmet headers, CORS, ValidationPipe with whitelist, and HttpExceptionFilter.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-200">Database Layer Prepared</span>
                <p className="text-slate-400 mt-0.5">Prisma schema initialized with PostgreSQL connector for Phase 2.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full pt-8 text-center text-xs text-slate-600 border-t border-slate-900">
        Billable &bull; Next step: Phase 2 (Authentication & Multi-Tenant Organizations)
      </footer>
    </main>
  );
}
