/**
 * LoginPage.tsx
 * =============
 * Official Officer Login Interface for AcquiSight AI.
 * Uses Firebase Authentication with Google OAuth.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Shield, Lock, AlertCircle, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, officerProfile, loading, error, isConfigured, signInWithGoogle, signOutOfficer, clearError } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      // Allow slight delay or let user click continue
    }
  }, [user, loading]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#070c18] px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">
        {/* State Department Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-[0_0_35px_rgba(34,211,238,0.35)]">
            <Shield size={28} />
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

        {/* Login Box */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1527]/90 p-7 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-slate-800/80 pb-5">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
              <Lock size={14} />
              <span>OFFICER AUTHENTICATION</span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-200">
              Sign In to Command Center
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Authorized revenue officers, District Revenue Officers (DRO), and project directors.
            </p>
          </div>

          {/* Configuration Missing Alert */}
          {!isConfigured && (
            <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <div className="font-bold">Firebase Configuration Required</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-amber-300/80">
                    Real Firebase Google OAuth is active. To authenticate with your Google account, configure{" "}
                    <code className="rounded bg-black/40 px-1 py-0.5 text-amber-200">VITE_FIREBASE_API_KEY</code> in your environment variables.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1">
                  <div className="font-bold">Authentication Notice</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-rose-200/80">{error}</div>
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
                    ✓ Authenticated via Google OAuth
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
            /* Unauthenticated Login Action */
            <div className="mt-6 space-y-4">
              <button
                type="button"
                data-testid="button-google-signin"
                disabled={loading}
                onClick={signInWithGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white/[.04] px-4 py-3.5 text-xs font-bold text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/[.06] hover:text-cyan-300 disabled:opacity-50"
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
                <span>{loading ? "Authenticating with Google..." : "Sign in with Google OAuth"}</span>
              </button>

              <div className="text-center text-[11px] text-slate-500">
                Official security notice: Access is monitored and logged under Tamil Nadu Information Technology Policy.
              </div>
            </div>
          )}
        </div>

        {/* Statutory Compliance Footer */}
        <div className="mt-8 text-center text-[10px] text-slate-600">
          RFCTLARR Act 2013 & Tamil Nadu Land Acquisition Intelligence Portal · v3.1.0
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
