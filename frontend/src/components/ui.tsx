import { type ReactNode } from "react";
import { ArrowUpRight, Check, CircleAlert, Info, LoaderCircle, Search, X, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { scoreCase, type RiskLevel } from "@/lib/data";

export function Button({ children, onClick, variant="primary", className="", type="button", disabled=false }: { children:ReactNode; onClick?:()=>void; variant?: "primary"|"ghost"|"outline"|"danger"; className?:string; type?:"button"|"submit"; disabled?:boolean }) {
  const styles = { primary:"bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_24px_rgba(74,215,239,.15)]", ghost:"bg-white/[.04] text-slate-200 hover:bg-white/[.09]", outline:"border border-slate-600/70 text-slate-200 hover:border-cyan-300/60 hover:text-cyan-200", danger:"bg-rose-500/15 text-rose-300 border border-rose-400/25 hover:bg-rose-500/25" };
  return <button data-testid={`button-${typeof children==="string" ? children.toLowerCase().replace(/\s+/g,"-") : "action"}`} type={type} disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-[12px] font-bold tracking-wide transition duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

export function Badge({ children, tone="neutral" }: { children:ReactNode; tone?: "neutral"|"cyan"|"violet"|"amber"|"red"|"green" }) {
  const styles = { neutral:"bg-slate-400/10 text-slate-300 border-slate-400/20", cyan:"bg-cyan-400/10 text-cyan-300 border-cyan-300/20", violet:"bg-violet-400/10 text-violet-300 border-violet-300/20", amber:"bg-amber-400/10 text-amber-300 border-amber-300/20", red:"bg-rose-400/10 text-rose-300 border-rose-300/20", green:"bg-emerald-400/10 text-emerald-300 border-emerald-300/20" };
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${styles[tone]}`}>{children}</span>;
}

export function RiskBadge({ level }: { level:RiskLevel }) { return <Badge tone={level==="High"?"red":level==="Medium"?"amber":"green"}>{level} risk</Badge>; }

export function RiskMeter({ item }: { item: Parameters<typeof scoreCase>[0] }) {
  const { score, level } = scoreCase(item);
  return <div className="flex items-center gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-700/70"><div style={{width:`${score}%`}} className={`h-full rounded-full ${level==="High"?"bg-rose-400":level==="Medium"?"bg-amber-300":"bg-emerald-400"}`} /></div><span className={`mono text-[11px] ${level==="High"?"text-rose-300":level==="Medium"?"text-amber-300":"text-emerald-300"}`}>{score}</span></div>;
}

export function SectionTitle({ eyebrow, title, detail, action }: { eyebrow?:string; title:string; detail?:string; action?:ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow mb-2">{eyebrow}</div><h1 className="font-display text-2xl font-bold tracking-[-.04em] text-slate-900 dark:text-slate-100 md:text-3xl">{title}</h1>{detail && <p className="mt-1.5 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{detail}</p>}</div>{action}</div>;
}

export function Surface({ children, className="" }: { children:ReactNode; className?:string }) { return <div className={`glass rounded-xl ${className}`}>{children}</div>; }

export function SearchBox({ value, onChange, placeholder="Search cases, locations, owners..." }: { value:string; onChange:(value:string)=>void; placeholder?:string }) {
  return <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" /><input data-testid="input-search" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-300 dark:border-slate-700/70 bg-white dark:bg-slate-950/40 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-200 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/10" /></div>;
}

export function StatCard({ label, value, note, icon:Icon, tone="cyan", onClick }: { label:string; value:string|number; note:string; icon:LucideIcon; tone?:"cyan"|"violet"|"amber"|"red"|"green"; onClick?:()=>void }) {
  const color = {cyan:"text-cyan-400 dark:text-cyan-300 bg-cyan-400/10", violet:"text-violet-400 dark:text-violet-300 bg-violet-400/10", amber:"text-amber-400 dark:text-amber-300 bg-amber-400/10", red:"text-rose-400 dark:text-rose-300 bg-rose-400/10", green:"text-emerald-400 dark:text-emerald-300 bg-emerald-400/10"}[tone];
  return <motion.div whileHover={{y:-3}} onClick={onClick} className={`glass-hover glass rounded-xl p-4 ${onClick?"cursor-pointer":""}`}><div className="flex items-start justify-between"><span className="text-[11px] font-semibold uppercase tracking-[.13em] text-slate-500 dark:text-slate-400">{label}</span><span className={`rounded-md p-2 ${color}`}><Icon size={16}/></span></div><div className="mt-4 text-3xl font-extrabold tracking-[-.06em] text-slate-900 dark:text-slate-100">{value}</div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p></motion.div>;
}

export function Toast({ message, onClose }: { message:string; onClose:()=>void }) {
  return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-cyan-300/25 bg-slate-900/95 px-4 py-3 text-sm text-slate-200 shadow-2xl"><Check size={16} className="text-cyan-300"/><span>{message}</span><button data-testid="button-close-toast" onClick={onClose} className="ml-2 text-slate-500 hover:text-slate-200"><X size={15}/></button></motion.div>;
}

export function EmptyState({ title, detail, action }: { title:string; detail:string; action?:ReactNode }) { return <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700/70 bg-slate-50 dark:bg-white/[.015] p-8 text-center"><CircleAlert size={26} className="mb-3 text-slate-400 dark:text-slate-500"/><h3 className="font-bold text-slate-900 dark:text-slate-200">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-500">{detail}</p>{action && <div className="mt-4">{action}</div>}</div>; }

export function LoadingState() { return <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-14 animate-pulse rounded-lg bg-white/[.04]"/>)}<div className="flex items-center justify-center gap-2 pt-3 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin"/> Loading intelligence</div></div>; }

export function IconArrow() { return <ArrowUpRight size={14}/>; }