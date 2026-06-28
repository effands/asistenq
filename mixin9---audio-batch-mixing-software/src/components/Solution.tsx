import React from "react";
import { CheckCircle2, Sliders, Zap, ShieldCheck, Heart } from "lucide-react";
import { COPYWRITING_STRUCTURE } from "../data";

export default function Solution() {
  const getBenefitIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Zap className="w-5 h-5 text-cyan-400" />;
      case 1:
        return <Sliders className="w-5 h-5 text-violet-400" />;
      case 2:
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 3:
        return <ShieldCheck className="w-5 h-5 text-amber-400" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <section id="solution" className="py-16 md:py-24 bg-gradient-to-b from-[#030616]/90 via-[#040822]/80 to-[#020512] border-t border-cyan-500/20 relative overflow-hidden">
      
      {/* Visual background decor */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-64 bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Solution Introductions */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-mono block">
              💡 SOLUSI ALUR KERJA TERBAIK
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {COPYWRITING_STRUCTURE.solution.heading}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {COPYWRITING_STRUCTURE.solution.text}
            </p>
            
            {/* Benefits Bullet list */}
            <div className="space-y-4 pt-2">
              {COPYWRITING_STRUCTURE.solution.benefits.map((benefit, idx) => (
                <div key={idx} className="flex gap-3 bg-[#0f173b]/45 backdrop-blur-md p-3 rounded-xl border border-cyan-500/20 hover:border-cyan-500/40 transition shadow-lg shadow-[#060917]/35">
                  <div className="flex-shrink-0 p-2 bg-[#070b1c]/90 rounded-lg border border-cyan-500/20">
                    {getBenefitIcon(idx)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Manfaat {idx + 1}:</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed font-semibold mt-0.5">{benefit}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs text-zinc-500 font-medium">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>Dibuat dengan cinta untuk menyederhanakan hidup para audio creator.</span>
            </div>
          </div>

          {/* Right Column: Visual Mockup / Interface Teaser */}
          <div className="lg:col-span-6">
            <div className="relative group">
              {/* Outer neon border glow */}
              <div className="absolute -inset-1.5 bg-gradient-to-tr from-violet-600 to-cyan-400 rounded-2xl blur-lg opacity-25 group-hover:opacity-40 transition duration-1000" />
              
              {/* Mockup Frame */}
              <div className="relative bg-[#0d1633]/85 backdrop-blur-md border border-cyan-500/35 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20">
                {/* OS window header mockup */}
                <div className="bg-[#121c40]/80 px-4 py-3 border-b border-cyan-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="text-[10px] font-bold font-mono text-zinc-500">MIXIN9_Setup.msi / pkg</span>
                  <div className="w-10" />
                </div>

                {/* Software showcase body */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-violet-600 text-white rounded">
                      <Sliders className="w-4 h-4 rotate-90" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Aplikasi MIXIN9 Desktop</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">Platform: Windows 10/11 • macOS M1/M2/M3 & Intel</p>
                    </div>
                  </div>

                  <div className="bg-[#0a0f26]/90 p-4 rounded-xl border border-cyan-500/20 space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-bold text-zinc-400 uppercase">
                      <span>Batch Processing Queue</span>
                      <span className="text-cyan-400 font-mono">100 files ready</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div className="h-full w-[85%] bg-gradient-to-r from-violet-600 to-cyan-500 rounded-full" />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                      <span>Proses: 85%</span>
                      <span>Kecepatan: 120 file/menit</span>
                    </div>
                  </div>

                  {/* Bullet micro advantages */}
                  <ul className="text-xs space-y-2 text-zinc-400 pt-2 font-semibold">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500 text-sm font-bold">✓</span>
                      <span>UI intuitif, pemula langsung bisa tanpa training audio.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500 text-sm font-bold">✓</span>
                      <span>Hemat CPU & Memori RAM, tidak membebani komputer.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500 text-sm font-bold">✓</span>
                      <span>Offline processing, data aman 100% tanpa kirim cloud.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
