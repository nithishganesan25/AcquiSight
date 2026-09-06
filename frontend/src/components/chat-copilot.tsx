/**
 * chat-copilot.tsx
 * ================
 * AcquiSight Real Grounded AI Copilot.
 * Connects directly to backend POST /chat. Grounded in authoritative case records,
 * live district analytics, and statutory rules under RFCTLARR Act 2013.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Bot,
  User,
  Scale,
  RotateCcw,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { sendChatMessage } from "@/lib/api";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  time: string;
  citations?: string[];
  actionItems?: string[];
  provider?: string;
}

export function ChatCopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [location] = useLocation();
  const [activeCaseId, setActiveCaseId] = useState<string | undefined>(undefined);

  // Extract case ID if currently on /cases/:id
  useEffect(() => {
    const match = location.match(/^\/cases\/(.+)$/);
    if (match && match[1]) {
      setActiveCaseId(decodeURIComponent(match[1]));
    } else {
      setActiveCaseId(undefined);
    }
  }, [location]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-welcome",
      sender: "ai",
      text: "Vanakkam! I am your AcquiSight AI Legal & Revenue Assistant. Ask me about RFCTLARR 2013 compliance, active case factors, district-level delay counts, or mitigation strategies.",
      time: "Just now",
      citations: ["RFCTLARR Act 2013", "AcquiSight Operational Database"],
      actionItems: [
        "Ask about Section 11 to 19 statutory SLAs",
        "Calculate First Schedule compensation multipliers",
        "Ask 'Why is this case high risk?' when viewing a case dossier",
      ],
      provider: "AcquiSight Grounded Analytics Engine",
    },
  ]);

  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || isTyping) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: q,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsTyping(true);

    try {
      const response = await sendChatMessage({
        message: q,
        case_id: activeCaseId,
      });

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: response.reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations: response.citations,
        actionItems: response.suggested_actions,
        provider: response.provider,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Chat backend error:", err);
      const errorMsg: Message = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: "Unable to reach AcquiSight backend on port 8000. Please ensure FastAPI server is online.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations: ["System Connection Notice"],
        provider: "Offline Diagnostic",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: "m-welcome-reset",
        sender: "ai",
        text: "Conversation cleared. How can I assist with Tamil Nadu land acquisition cases or statutory rules?",
        time: "Just now",
        citations: ["RFCTLARR Act 2013"],
        provider: "AcquiSight Grounded Analytics Engine",
      },
    ]);
  };

  const promptChips = activeCaseId
    ? [
        "Why is this case high risk?",
        "What should I investigate first?",
        "Explain this case to me",
        "What is the statutory Section 11 to 19 deadline?",
      ]
    : [
        "How many delayed cases in Tiruchirappalli?",
        "How is rural compensation calculated under Section 26 & 30?",
        "What causes acquisition lapses under the RFCTLARR 2013 Act?",
        "What is the statutory deadline between Section 11 and Section 19?",
      ];

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen(!open)}
          data-testid="button-toggle-copilot"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.4)] transition hover:bg-cyan-300"
        >
          {open ? (
            <X size={22} className="text-slate-950" />
          ) : (
            <>
              <Bot size={26} className="text-slate-950" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
              </span>
            </>
          )}
        </motion.button>
      </div>

      {/* Floating Chat Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            data-copilot-modal="true"
            className="fixed bottom-24 right-4 sm:right-6 z-50 flex h-[620px] max-h-[82vh] w-[94vw] max-w-[480px] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#09101f]/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">
                  <Scale size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-100">
                    AcquiSight Copilot
                    <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400">
                      Grounded AI
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {activeCaseId ? (
                      <span className="text-cyan-300 font-semibold">Active Dossier: {activeCaseId}</span>
                    ) : (
                      "Tamil Nadu Land Administration Intelligence"
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClear}
                  title="Clear conversation"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Context Chips */}
            <div className="border-b border-slate-800/80 bg-slate-950/40 p-2.5">
              <div className="mb-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {activeCaseId ? "Case Specific Queries" : "Suggested Operational Queries"}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {promptChips.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(qp)}
                    disabled={isTyping}
                    className="shrink-0 rounded-md border border-slate-700/60 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-200 disabled:opacity-50"
                  >
                    {qp.length > 34 ? `${qp.slice(0, 34)}...` : qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs scrollbar-thin">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.sender === "ai" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300">
                      <Bot size={14} />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl p-3.5 leading-relaxed ${
                      m.sender === "user"
                        ? "bg-cyan-500 text-slate-950 font-medium"
                        : "border border-slate-800 bg-slate-900/80 text-slate-200"
                    }`}
                  >
                    {m.provider && (
                      <div className="mb-2 inline-flex items-center gap-1 rounded bg-white/[.04] px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                        <ShieldCheck size={10} className="text-emerald-400" />
                        {m.provider}
                      </div>
                    )}

                    <div className="whitespace-pre-line text-[12px]">{m.text}</div>

                    {/* Citations */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-3 border-t border-slate-800/80 pt-2 text-[10px]">
                        <div className="font-bold text-cyan-300">Verified Sources:</div>
                        <ul className="mt-1 space-y-0.5 text-slate-400">
                          {m.citations.map((c, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-cyan-400" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {m.actionItems && m.actionItems.length > 0 && (
                      <div className="mt-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-[10px] text-emerald-300">
                        <div className="font-bold">Recommended Administrative Actions:</div>
                        <ul className="mt-1 space-y-1">
                          {m.actionItems.map((act, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ChevronRight size={11} className="shrink-0 mt-0.5 text-emerald-400" />
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div
                      className={`mt-1.5 text-right text-[9px] ${
                        m.sender === "user" ? "text-slate-800" : "text-slate-500"
                      }`}
                    >
                      {m.time}
                    </div>
                  </div>

                  {m.sender === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300">
                      <User size={14} />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300">
                    <Bot size={14} />
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:0.4s]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 border-t border-slate-800 bg-slate-950/80 p-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  activeCaseId
                    ? `Ask about Case ${activeCaseId} (e.g. why is it risky?)...`
                    : "Ask about Tamil Nadu districts, RFCTLARR SLAs..."
                }
                data-testid="input-copilot-query"
                disabled={isTyping}
                className="h-10 flex-1 rounded-md border border-slate-700 bg-slate-900/90 px-3 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                data-testid="button-send-copilot"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
