/**
 * status-states.tsx
 * =================
 * Production-quality reusable UI states for AcquiSight AI:
 * - Application Splash Loading
 * - Skeleton Loaders (KPI, Chart, Table, Radar)
 * - Empty States (Cases, Filters, Analytics, Comparative, Reports, GIS)
 * - Network & API Failure with Retry
 * - 403 Access Restricted State
 * - 404 Not Found Page State
 * - 500 / Global Error Fallback
 */

import React, { type ReactNode } from "react";
import {
  Shield,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Home,
  Database,
  Lock,
  SearchX,
  FileQuestion,
  BarChart3,
  GitCompare,
  Layers,
  FileText,
} from "lucide-react";
import { Link, useLocation } from "wouter";

// ---------------------------------------------------------------------------
// 1. APPLICATION SPLASH SCREEN
// ---------------------------------------------------------------------------
export function AppSplashScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen w-full flex-col items-center justify-center bg-[#070c18] px-4 text-slate-100"
    >
      <div className="flex flex-col items-center text-center">
        {/* Glowing Shield Logo */}
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-slate-950 shadow-[0_0_50px_rgba(34,211,238,0.45)]">
          <Shield size={40} className="stroke-[2.2]" />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 border-2 border-cyan-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </span>
        </div>

        {/* Branding & Subtitle */}
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">
          Acqui<span className="text-cyan-400">Sight</span> AI
        </h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
          Government of Tamil Nadu
        </p>
        <p className="mt-4 text-sm font-medium text-slate-300">
          Initializing decision-support services...
        </p>

        {/* Animated Progress Bar */}
        <div className="mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/2 rounded-full bg-cyan-400 animate-[indeterminate_1.5s_infinite_linear]" />
        </div>

        <p className="mt-6 text-[11px] text-slate-500 font-mono">
          RFCTLARR Act 2013 · Tamil Nadu Cadastral Analytics Engine
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. SKELETON LOADERS
// ---------------------------------------------------------------------------
export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading key performance metrics"
      className={`grid gap-3 sm:grid-cols-2 ${count === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-8 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="mt-4 h-8 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-3 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-72", title }: { height?: string; title?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading chart data"
      className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 p-5 shadow-sm"
    >
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        {title ? (
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</div>
        ) : (
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        )}
        <div className="mt-1 h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800/60" />
      </div>

      <div className={`relative flex w-full items-end gap-3 ${height} overflow-hidden px-4 pb-4`}>
        {/* Simulated Cartesian Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between py-4 opacity-40">
          <div className="border-b border-dashed border-slate-200 dark:border-slate-800" />
          <div className="border-b border-dashed border-slate-200 dark:border-slate-800" />
          <div className="border-b border-dashed border-slate-200 dark:border-slate-800" />
        </div>

        {/* Simulated Bars */}
        {[45, 75, 30, 90, 60, 80, 50, 65, 85, 40].map((val, idx) => (
          <div key={idx} className="z-10 flex-1 flex flex-col items-center gap-2">
            <div
              style={{ height: `${val}%` }}
              className="w-full animate-pulse rounded-t bg-slate-200 dark:bg-slate-800/70"
            />
            <div className="h-2 w-6 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading tabular data"
      className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 shadow-sm"
    >
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/50 p-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 p-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                style={{ width: c === 0 ? "18%" : c === 1 ? "26%" : "16%" }}
                className="h-3.5 animate-pulse rounded bg-slate-200 dark:bg-slate-800/70"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentCasesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading cases" className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/40 p-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-2.5 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800/60" />
            </div>
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function RadarSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading comparative radar benchmark"
      className="flex h-72 w-full flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-6"
    >
      <div className="relative flex h-48 w-48 items-center justify-center">
        <div className="absolute h-44 w-44 animate-pulse rounded-full border border-dashed border-slate-300 dark:border-slate-700" />
        <div className="absolute h-32 w-32 animate-pulse rounded-full border border-dashed border-slate-300 dark:border-slate-700" />
        <div className="absolute h-16 w-16 animate-pulse rounded-full border border-dashed border-slate-300 dark:border-slate-700" />
        <div className="h-3 w-3 animate-ping rounded-full bg-cyan-400" />
      </div>
      <span className="mt-3 text-xs font-semibold text-slate-400">Computing multidimensional benchmark indices...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. EMPTY STATE CARDS
// ---------------------------------------------------------------------------
interface EmptyStateProps {
  title: string;
  detail: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ElementType;
}

export function EmptyStateCard({
  title,
  detail,
  actionText,
  onAction,
  icon: Icon = SearchX,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/20 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 shadow-inner">
        <Icon size={24} />
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{detail}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition hover:border-cyan-400 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

// Specialized Preset Empty States per problem specification
export function CasesEmptyState({ onClearFilters }: { onClearFilters?: () => void }) {
  if (onClearFilters) {
    return (
      <EmptyStateCard
        icon={SearchX}
        title="No matching cases found"
        detail="There are no acquisition cases matching your current query or filter combination."
        actionText="Clear Filters"
        onAction={onClearFilters}
      />
    );
  }
  return (
    <EmptyStateCard
      icon={Database}
      title="No acquisition cases found"
      detail="Try changing your search or filter criteria."
    />
  );
}

export function AnalyticsEmptyState() {
  return (
    <EmptyStateCard
      icon={BarChart3}
      title="No analytics available"
      detail="There is not enough data for the selected filters."
    />
  );
}

export function ComparativeEmptyState() {
  return (
    <EmptyStateCard
      icon={GitCompare}
      title="Select 2–5 districts to compare performance."
      detail="Pick districts from the selector above to benchmark acquisition velocity, legal friction, and completion rates."
    />
  );
}

export function ReportsEmptyState() {
  return (
    <EmptyStateCard
      icon={FileText}
      title="No report data available for the selected criteria."
      detail="Select a different district or report filter to generate the briefing."
    />
  );
}

export function GisEmptyState({ onResetFilters }: { onResetFilters?: () => void }) {
  return (
    <EmptyStateCard
      icon={Layers}
      title="No spatial records available for the selected criteria."
      detail="No cadastral parcels match the selected district, taluk, or risk filter."
      actionText={onResetFilters ? "Reset GIS Filters" : undefined}
      onAction={onResetFilters}
    />
  );
}

// ---------------------------------------------------------------------------
// 4. NETWORK & API FAILURE STATE WITH RETRY
// ---------------------------------------------------------------------------
interface NetworkErrorProps {
  title?: string;
  detail?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function NetworkErrorState({
  title = "Unable to connect to AcquiSight services",
  detail = "The backend service is currently unavailable.",
  onRetry,
  retrying = false,
}: NetworkErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/10 p-8 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400">
        <AlertTriangle size={24} />
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-rose-200">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400">{detail}</p>
      {onRetry && (
        <button
          type="button"
          disabled={retrying}
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 shadow transition hover:bg-cyan-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
        >
          <RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
          {retrying ? "Reconnecting..." : "Retry"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. 403 ACCESS RESTRICTED / UNAUTHORIZED STATE
// ---------------------------------------------------------------------------
export function UnauthorizedPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#070c18] px-4 text-slate-100">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          <Lock size={32} />
        </div>
        <div className="mt-4 text-[11px] font-bold uppercase tracking-widest text-amber-400">
          HTTP 403 Forbidden
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          Access restricted
        </h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          You don't have permission to access this module.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/command-center"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          >
            <Home size={14} /> Return to Command Center
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-slate-600 font-mono">
          Tamil Nadu Land Acquisition Intelligence Portal · Officer Access Control
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. 404 NOT FOUND PAGE
// ---------------------------------------------------------------------------
export function NotFoundPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#070c18] px-4 text-slate-100">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
          <FileQuestion size={32} />
        </div>
        <div className="mt-4 text-[11px] font-bold uppercase tracking-widest text-cyan-400">
          HTTP 404 Not Found
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          Page not found
        </h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          The requested AcquiSight module could not be found.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/command-center")}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          >
            <Home size={14} /> Return to Command Center
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:text-slate-100 focus:outline-none"
          >
            <ArrowLeft size={14} /> Go Back
          </button>
        </div>

        <p className="mt-8 text-[11px] text-slate-600 font-mono">
          AcquiSight AI · Decision Support Portal · 2026
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. 500 / GLOBAL ERROR FALLBACK FOR REACT ERROR BOUNDARY
// ---------------------------------------------------------------------------
export function GlobalErrorFallback({
  error,
  resetError,
}: {
  error?: Error;
  resetError?: () => void;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#070c18] px-4 text-slate-100">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
          <AlertTriangle size={32} />
        </div>
        <div className="mt-4 text-[11px] font-bold uppercase tracking-widest text-rose-400">
          System Recovery
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          An unexpected system error occurred.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {resetError && (
            <button
              type="button"
              onClick={resetError}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            >
              <RefreshCw size={14} /> Try Again
            </button>
          )}
          <a
            href="/command-center"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
          >
            <Home size={14} /> Return to Command Center
          </a>
        </div>

        <p className="mt-8 text-[11px] text-slate-600 font-mono">
          AcquiSight AI Resilient Runtime Protection
        </p>
      </div>
    </div>
  );
}
