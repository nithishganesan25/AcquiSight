import { useState, useEffect, type ReactNode } from "react";
import {
  Bell,
  BellRing,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  FileBarChart,
  Globe2,
  Layers,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  User,
  X,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { navGroups } from "@/lib/data";
import { ChatCopilot } from "@/components/chat-copilot";
import { useAuth } from "@/lib/auth-context";
import { getAlerts } from "@/lib/api";

const iconMap: Record<string, typeof Command> = {
  CommandCenter: Command,
  Layers,
  Globe2,
  Sparkles,
  BellRing,
  ListChecks,
  ChartNoAxesCombined,
  FileBarChart,
};

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" data-testid="link-logo" className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(74,215,239,.2)] shrink-0">
        <span className="absolute h-4 w-4 rounded-[3px] border-2 border-slate-950/80" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-slate-950" />
      </span>
      <span className={`font-display text-[15px] font-bold tracking-[-.04em] text-slate-100 ${collapsed ? "md:hidden" : ""}`}>
        Acqui<span className="text-cyan-300">Sight</span>
      </span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, officerProfile, signOutOfficer } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  const [alertsDropdown, setAlertsDropdown] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  useEffect(() => {
    getAlerts()
      .then((data) => setRecentAlerts(data.slice(0, 5)))
      .catch(() => {});
  }, []);

  const officerInitials = officerProfile?.displayName
    ? officerProfile.displayName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
    : "TN";

  const sidebar = (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-slate-700/60 bg-[#0a1020]/95 px-3 py-5 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${
        collapsed ? "md:w-[76px]" : "md:w-[248px]"
      } ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-2`}>
        <Logo collapsed={collapsed} />
        <button
          data-testid="button-close-nav"
          className="text-slate-500 md:hidden"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-9 space-y-7 overflow-y-auto scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className={`eyebrow mb-2 px-3 ${collapsed ? "md:hidden" : ""}`}>
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map(([label, href, icon]) => {
                const I = iconMap[icon] || Command;
                const active = location === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    data-testid={`link-nav-${label.toLowerCase().replaceAll(" ", "-")}`}
                    className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold transition ${
                      active
                        ? "bg-cyan-300/10 text-cyan-200"
                        : "text-slate-400 hover:bg-white/[.05] hover:text-slate-200"
                    }`}
                  >
                    <I size={16} className={active ? "text-cyan-300" : "text-slate-500"} />
                    <span className={collapsed ? "md:hidden" : ""}>{label}</span>
                    {active && (
                      <span
                        className={`ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 ${
                          collapsed ? "md:hidden" : ""
                        }`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <div className={`eyebrow mb-2 px-3 ${collapsed ? "md:hidden" : ""}`}>System</div>
          <Link
            href="/settings"
            data-testid="link-nav-settings"
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold ${
              location === "/settings"
                ? "bg-white/[.07] text-slate-100"
                : "text-slate-400 hover:bg-white/[.05]"
            }`}
          >
            <Settings size={16} />
            <span className={collapsed ? "md:hidden" : ""}>Settings</span>
          </Link>
        </div>
      </div>

      {/* Officer Card at Bottom */}
      <div className={`mt-auto border-t border-slate-800 pt-4 ${collapsed ? "md:px-0" : "px-1"}`}>
        <div className="flex items-center justify-between rounded-lg bg-white/[.035] p-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Officer"
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-200">
                {officerInitials}
              </div>
            )}
            <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
              <div className="truncate text-xs font-bold text-slate-200">
                {officerProfile?.displayName || "TN Land Officer"}
              </div>
              <div className="truncate text-[10px] text-slate-400">
                {officerProfile?.email || "Revenue & Disaster Mgmt"}
              </div>
            </div>
          </div>
          {user && !collapsed && (
            <button
              onClick={signOutOfficer}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-rose-400"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>

        <button
          data-testid="button-collapse-nav"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-3 hidden w-full items-center justify-center gap-2 rounded-md py-2 text-xs text-slate-500 hover:bg-white/[.04] hover:text-slate-200 md:flex"
        >
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /> Collapse</>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="noise app-shell min-h-[100dvh] text-slate-800 dark:text-slate-200">
      <AnimatePresence>
        {open && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="button-mobile-overlay"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/70 md:hidden"
          />
        )}
      </AnimatePresence>

      {sidebar}

      <div
        className={`min-h-[100dvh] transition-[margin] duration-300 ${
          collapsed ? "md:ml-[76px]" : "md:ml-[248px]"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-[#0b1120]/75 px-4 backdrop-blur-xl md:px-8">
          <button
            data-testid="button-open-nav"
            onClick={() => setOpen(true)}
            className="rounded-md p-2 text-slate-500 hover:bg-black/[.05] dark:text-slate-400 dark:hover:bg-white/[.06] md:hidden"
          >
            <Menu size={19} />
          </button>

          <div className="hidden items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Tamil Nadu Land Acquisition Network</span>
            <span className="mono ml-3 text-slate-400 dark:text-slate-500">/ TN-LA-ONLINE</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/create-case"
              data-testid="link-create-case-header"
              className="hidden items-center gap-2 rounded-md bg-cyan-400 px-3 py-2 text-[11px] font-extrabold text-slate-950 hover:bg-cyan-300 sm:flex"
            >
              <Plus size={14} /> New Case
            </Link>

            {/* Quick Theme Toggle Button */}
            <button
              type="button"
              data-testid="button-quick-theme-toggle"
              title={isDark ? "Switch to Daylight Mode" : "Switch to Dark Command Mode"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-slate-100 transition"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
            </button>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                data-testid="button-header-alerts"
                onClick={() => setAlertsDropdown(!alertsDropdown)}
                className="relative rounded-md p-2 text-slate-400 hover:bg-white/[.06] hover:text-slate-100"
              >
                <Bell size={18} />
                {recentAlerts.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-400" />
                )}
              </button>

              {alertsDropdown && (
                <div data-header-dropdown="true" className="absolute right-0 top-12 z-30 w-80 rounded-xl border border-slate-700/80 bg-[#0c1527] p-3 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold text-slate-200">Critical Alerts</span>
                    <Link
                      href="/risk-alerts"
                      onClick={() => setAlertsDropdown(false)}
                      className="text-[10px] font-semibold text-cyan-400 hover:underline"
                    >
                      View all ({recentAlerts.length})
                    </Link>
                  </div>
                  <div className="mt-2 divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                    {recentAlerts.slice(0, 4).map((a) => (
                      <div key={a.id} className="py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-200 truncate max-w-[180px]">
                            {a.title}
                          </span>
                          <span className="text-[9px] font-bold text-rose-400">{a.severity}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 line-clamp-2">{a.detail}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[9px] text-slate-500">{a.time}</span>
                          <Link
                            href={`/cases/${encodeURIComponent(a.case_id || a.caseId)}`}
                            onClick={() => setAlertsDropdown(false)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 hover:underline"
                          >
                            Investigate <ArrowRight size={10} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-7 w-px bg-slate-800" />

            {/* Officer Profile Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdown(!userDropdown)}
                  className="flex items-center gap-2 rounded-md bg-white/[.03] px-2.5 py-1.5 hover:bg-white/[.06]"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/15 text-[10px] font-bold text-cyan-200">
                      {officerInitials}
                    </span>
                  )}
                  <span className="hidden text-xs font-semibold text-slate-300 lg:block max-w-[120px] truncate">
                    {officerProfile?.displayName || "Officer"}
                  </span>
                  <ChevronDown size={13} className="text-slate-400" />
                </button>

                {userDropdown && (
                  <div data-header-dropdown="true" className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-slate-700/80 bg-[#0c1527] p-2 shadow-2xl backdrop-blur-xl">
                    <div className="border-b border-slate-800 px-2.5 py-2">
                      <div className="truncate text-xs font-bold text-slate-200">
                        {officerProfile?.displayName}
                      </div>
                      <div className="truncate text-[10px] text-slate-400">{user.email}</div>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setUserDropdown(false)}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-300 hover:bg-white/[.06]"
                    >
                      <Settings size={14} /> Workspace Settings
                    </Link>
                    <button
                      onClick={() => {
                        setUserDropdown(false);
                        signOutOfficer();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-cyan-400/15 border border-cyan-400/30 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/25"
              >
                Sign In
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 md:p-8">{children}</main>
      </div>

      <ChatCopilot />
    </div>
  );
}

export function PublicNav() {
  return (
    <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-12">
      <Logo />
      <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
        <Link
          href="/command-center"
          className="rounded-md bg-cyan-400 px-3.5 py-2 font-bold text-slate-950 hover:bg-cyan-300"
        >
          Open Command Center
        </Link>
      </div>
    </header>
  );
}