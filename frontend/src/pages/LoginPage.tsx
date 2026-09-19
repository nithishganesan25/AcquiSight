/**
 * LoginPage.tsx
 * =============
 * Modern, Standard Officer Login Interface for AcquiSight AI.
 * Supports standard Email & Password authentication alongside Google OAuth.
 */

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";

interface DemoAccount {
  label: string;
  role: string;
  email: string;
  designation: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "District Revenue Officer",
    role: "DRO",
    email: "dro.chennai@tn.gov.in",
    designation: "Special District Revenue Officer (LA)",
  },
  {
    label: "Land Acquisition Officer",
    role: "LAO",
    email: "lao.highways@tn.gov.in",
    designation: "Land Acquisition Officer (Highways & Transport)",
  },
  {
    label: "Project Director",
    role: "Director",
    email: "director.tnidb@tn.gov.in",
    designation: "Project Director (TN Infrastructure Development)",
  },
];

export function LoginPage() {
  const [, setLocation] = useLocation();
  const {
    user,
    officerProfile,
    loading,
    error,
    isConfigured,
    signInWithGoogle,
    signInWithEmail,
    signOutOfficer,
    clearError,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [activeRoleDesignation, setActiveRoleDesignation] = useState("Special District Revenue Officer (DRO)");

  useEffect(() => {
    if (user && !loading) {
      setLocation("/command-center");
    }
  }, [user, loading, setLocation]);

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    clearError();
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password, activeRoleDesignation);
      setLocation("/command-center");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectDemoAccount = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword("TNRevenue@2026");
    setActiveRoleDesignation(acc.designation);
    clearError();
  };

  const quickLoginDemo = async (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword("TNRevenue@2026");
    setActiveRoleDesignation(acc.designation);
    clearError();
    setIsSubmitting(true);
    try {
      await signInWithEmail(acc.email, "TNRevenue@2026", acc.designation);
      setLocation("/command-center");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#070c18] px-4 py-10 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Decorative Gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 h-[450px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        {/* State Department Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 shadow-[0_0_35px_rgba(34,211,238,0.35)]">
            <Shield size={28} className="text-slate-950" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            Acqui<span className="text-cyan-400">Sight</span> AI
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Government of Tamil Nadu
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Land Administration & Delay Intelligence Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1527]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Card Title & Subtitle */}
          <div className="border-b border-slate-800/80 pb-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                Sign In
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-400">
                <Lock size={11} /> Officer Portal
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Enter your official credentials to access the command center.
            </p>
          </div>

          {/* Session Expired Notice */}
          {window.location.search.includes("session_expired") && !user && (
            <div role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div className="flex-1">
                  <div className="font-semibold">Session expired</div>
                  <div className="mt-0.5 text-[11px] text-amber-200/80">
                    Your session timed out. Please sign in again.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1">
                  <div className="font-semibold">Sign in error</div>
                  <div className="mt-0.5 text-[11px] text-rose-200/90">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Authenticated State */}
          {user ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Officer Avatar" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-200">
                    {officerProfile?.displayName || user.email}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">{user.email}</div>
                  <div className="mt-0.5 text-[10px] text-emerald-400 font-semibold">
                    ✓ Authenticated Officer Session
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-bold"
                  onClick={() => setLocation("/command-center")}
                >
                  Enter Command Center <ArrowRight size={14} className="ml-1" />
                </Button>
                <Button variant="outline" onClick={signOutOfficer}>
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            /* Normal Login Form */
            <form onSubmit={handleEmailPasswordSubmit} className="mt-5 space-y-4">
              {/* Email / Officer ID Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between" htmlFor="login-email">
                  <span>Official Email or Officer ID</span>
                  <span className="text-[10px] text-slate-500 font-normal">e.g. name@tn.gov.in</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-email"
                    type="text"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer.dro@tn.gov.in"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300" htmlFor="login-password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Role Badge */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400/30 accent-cyan-400"
                  />
                  <span>Remember this device</span>
                </label>
              </div>

              {/* Primary Sign In Button */}
              <Button
                type="submit"
                disabled={loading || isSubmitting}
                className="w-full bg-cyan-400 py-2.5 font-bold text-slate-950 hover:bg-cyan-300 transition disabled:opacity-50"
              >
                {isSubmitting || loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Verifying Credentials...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    Sign In as Officer <ArrowRight size={14} />
                  </span>
                )}
              </Button>

              {/* OR Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-slate-800" />
                <span className="absolute bg-[#0d1527] px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Or continue with
                </span>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                data-testid="button-google-signin"
                disabled={loading || isSubmitting}
                onClick={signInWithGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800/80 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin text-cyan-400" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Sign in with Google OAuth</span>
              </button>

              {/* Quick Demo Officer Profiles for SIH Evaluation */}
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                    <Sparkles size={12} className="text-cyan-400" />
                    <span>Quick Demo Accounts (SIH Evaluation)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">1-Click</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => quickLoginDemo(acc)}
                      className="group flex flex-col items-start rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-left transition hover:border-cyan-500/40 hover:bg-cyan-500/5"
                    >
                      <span className="text-[10px] font-bold text-cyan-400 group-hover:text-cyan-300">
                        {acc.role}
                      </span>
                      <span className="mt-0.5 truncate text-[10px] text-slate-400 group-hover:text-slate-200">
                        {acc.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Official IT Notice & Legal Footer */}
        <div className="mt-6 space-y-2 text-center">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Official State Portal · Access is logged and audited under Tamil Nadu Information Technology Policy.
          </p>
          <p className="text-[10px] text-slate-600">
            RFCTLARR Act 2013 & Tamil Nadu Land Acquisition Intelligence Platform · v3.1.0
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1527] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <Info size={16} className="text-cyan-400" />
                <span>Officer Password Assistance</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <p>
                In accordance with Tamil Nadu Land Administration Security Guidelines, credentials for Revenue & Land Acquisition Officers are managed through the State NIC Directory.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400">
                <div className="font-semibold text-slate-300">Self-Service Options:</div>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li>Use <strong>Google OAuth</strong> if your official email is associated with a Google Workspace domain.</li>
                  <li>Use any of the <strong>Quick Demo Accounts</strong> on the login screen for instant SIH evaluation.</li>
                  <li>For credential resets, contact the District Revenue IT Cell at <code className="text-cyan-300">revenue-support@tn.gov.in</code>.</li>
                </ul>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold text-xs"
                onClick={() => setShowForgotModal(false)}
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
