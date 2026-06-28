import React, { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Sparkle } from "lucide-react";
import { FAQS } from "../data";

export default function FAQ() {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    if (activeIndex === index) {
      setActiveIndex(null);
    } else {
      setActiveIndex(index);
    }
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-gradient-to-b from-[#020512] to-[#010207] border-t border-cyan-500/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-mono block">
            ❓ FAQ
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-semibold">
            Temukan jawaban lengkap seputar skema lisensi, tata cara pembayaran, instalasi VST, dan spesifikasi teknis software MIXIN9.
          </p>
        </div>

        {/* Collapsible Accordion List */}
        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = activeIndex === idx;
            return (
              <div 
                key={idx} 
                className={`bg-[#0f173b]/45 backdrop-blur-md border rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen ? "border-cyan-500/50 shadow-lg shadow-cyan-500/10" : "border-cyan-500/20 hover:border-cyan-500/40"
                }`}
              >
                {/* Accordion Trigger Header */}
                <button
                  onClick={() => toggleAccordion(idx)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left gap-4"
                >
                  <div className="flex items-start gap-2.5">
                    <HelpCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isOpen ? "text-cyan-400 animate-pulse" : "text-zinc-500"}`} />
                    <span className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                      {faq.question}
                    </span>
                  </div>
                  <div className={`p-1 bg-[#070b1c]/90 rounded-lg text-zinc-400 transition ${isOpen ? "rotate-180 text-cyan-400" : ""}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {/* Accordion Content Panel */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-1.5 border-t border-cyan-500/10 text-xs sm:text-sm text-zinc-400 leading-relaxed font-medium bg-[#070b1c]/40 animate-slide-down">
                    {faq.answer}
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* Floating Developer Support Contact card */}
        <div className="mt-12 text-center p-4 bg-[#0f173b]/45 backdrop-blur-md border border-cyan-500/20 rounded-2xl max-w-md mx-auto text-xs text-zinc-400 flex items-center justify-center gap-2 shadow-lg">
          <Sparkle className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Punya pertanyaan khusus lainnya? Hubungi Telegram developer langsung di</span>
          <a 
            href="https://t.me/effands" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-cyan-400 hover:underline font-bold"
          >
            @effands
          </a>
        </div>

      </div>
    </section>
  );
}
