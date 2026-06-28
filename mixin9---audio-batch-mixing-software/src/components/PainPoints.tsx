import React from "react";
import { Clock, Sliders, AlertTriangle, CreditCard, ChevronRight } from "lucide-react";
import { PAIN_POINTS } from "../data";

export default function PainPoints() {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Clock":
        return <Clock className="w-6 h-6 text-red-400" />;
      case "Sliders":
        return <Sliders className="w-6 h-6 text-amber-400" />;
      case "AlertTriangle":
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      case "CreditCard":
        return <CreditCard className="w-6 h-6 text-rose-400" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-red-400" />;
    }
  };

  const handleScrollToSolution = () => {
    const element = document.querySelector("#solution");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="pain-points" className="py-16 bg-gradient-to-b from-transparent via-[#05081b]/60 to-[#030616]/80 border-t border-cyan-500/20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase font-mono block">
            Kenyataan Pahit di DAW Tradisional
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Apakah Anda Sering Frustrasi Mengalami Masalah Ini?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Proses mixing audio konvensional seringkali memakan waktu produktif Anda dan membuat hasil karya terdengar amatir.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {PAIN_POINTS.map((item) => (
            <div 
              key={item.id} 
              className="bg-[#0f173b]/45 backdrop-blur-md border border-cyan-500/20 p-5 rounded-2xl flex flex-col justify-between hover:border-red-500/40 hover:bg-[#131d4a]/50 transition-all duration-300 group hover:-translate-y-1 relative shadow-lg shadow-[#060917]/40"
            >
              {/* Card top decorative accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 opacity-0 group-hover:opacity-100 transition rounded-t-2xl" />

              <div className="space-y-4">
                <div className="p-3 bg-[#070b1c]/90 rounded-xl border border-cyan-500/25 w-fit group-hover:scale-105 transition shadow-inner">
                  {getIcon(item.icon)}
                </div>
                
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-red-400">
                    {item.badge}
                  </span>
                  <h3 className="text-sm font-bold text-white group-hover:text-red-300 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Red warning border hint */}
              <div className="mt-4 pt-3 border-t border-cyan-500/10 text-[10px] text-zinc-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>Menghambat Produktivitas</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Teaser */}
        <div className="text-center mt-12">
          <button
            onClick={handleScrollToSolution}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition font-bold uppercase tracking-wider"
          >
            <span>Tenang, Ada Solusi Lebih Baik</span>
            <ChevronRight className="w-4 h-4 text-cyan-400 animate-bounce" />
          </button>
        </div>

      </div>
    </section>
  );
}
