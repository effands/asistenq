import React from "react";
import { Sparkles, ArrowRight, Sliders, Star, ShieldCheck, Zap } from "lucide-react";
import { COPYWRITING_STRUCTURE } from "../data";

interface HeroProps {
  onOpenCheckout: () => void;
}

export default function Hero({ onOpenCheckout }: HeroProps) {
  const handleScrollToPlayground = () => {
    const element = document.querySelector("#mixer-playground-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 bg-gradient-to-b from-[#050824]/80 via-[#02040f]/60 to-transparent">
      {/* Absolute Cyber Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-radial-at-t from-violet-600/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-400/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-violet-500/8 rounded-full blur-[125px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          
          {/* Animated Promo Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0f173b]/60 backdrop-blur border border-cyan-500/20 rounded-full animate-pulse">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-300">
              🔥 SPECIAL LAUNCH PROMO: DISKON 50% UNTUK 10 PEMBELI PERTAMA
            </span>
          </div>

          {/* Tagline & Main Title */}
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 font-mono">
              "{COPYWRITING_STRUCTURE.headline.subtitle}"
            </h2>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-none">
              {COPYWRITING_STRUCTURE.headline.title.split("Hasil Pro")[0]}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-indigo-400 to-cyan-400">
                Hasil Pro
              </span>
              {COPYWRITING_STRUCTURE.headline.title.split("Hasil Pro")[1]}
            </h1>
          </div>

          {/* Sub-Headline Copywriting */}
          <p className="text-sm sm:text-base md:text-lg text-zinc-400 leading-relaxed max-w-3xl mx-auto">
            {COPYWRITING_STRUCTURE.subHeadline.text}
          </p>

          {/* Scarcity Urgent Note */}
          <div className="text-xs text-amber-400 font-mono font-semibold flex justify-center items-center gap-1 bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-500/20 max-w-lg mx-auto shadow-md">
            ⚠️ Slot Terbatas: Hanya sisa <span className="text-white bg-red-600 px-1.5 py-0.5 rounded font-bold animate-pulse text-xs">3 slot</span> hari ini sebelum harga kembali normal Rp 199.000!
          </div>

          {/* Call To Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              onClick={onOpenCheckout}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span>Dapatkan MIXIN9 Rp 99.000 Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleScrollToPlayground}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#0e173a]/50 hover:bg-[#131d4a]/70 text-zinc-300 hover:text-white rounded-xl text-sm font-semibold transition border border-cyan-500/25 flex items-center justify-center gap-2 shadow-lg"
            >
              <Sliders className="w-4 h-4 text-cyan-400 rotate-90" />
              <span>Lihat Antarmuka Desktop Asli</span>
            </button>
          </div>

          {/* Social Proof Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-[11px] sm:text-xs text-zinc-500 border-t border-cyan-500/10 max-w-2xl mx-auto">
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-400">
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
              </div>
              <span><strong>4.9/5 Rating</strong> (140+ Pembeli Puas)</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span><strong>Sekali Beli</strong>, Lisensi Lifetime</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span><strong>Gratis Update</strong> Selamanya</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
