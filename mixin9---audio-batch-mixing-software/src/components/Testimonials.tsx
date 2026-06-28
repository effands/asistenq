import React from "react";
import { Star, ShieldCheck, Check, Sparkle, Info } from "lucide-react";
import { TESTIMONIALS } from "../data";

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-16 bg-gradient-to-b from-[#01030c] to-[#040822] border-t border-cyan-500/20 relative overflow-hidden">
      
      {/* Glow decorative element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-mono block">
            💬 SOCIAL PROOF
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Telah Membantu Banyak Kreator Menghemat Waktu
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Dengarkan langsung ulasan tulus dari para audio engineer, podcaster, dan content creator profesional yang mengandalkan MIXIN9 dalam pekerjaan mereka sehari-hari.
          </p>
        </div>

        {/* Testimonials Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {TESTIMONIALS.map((test) => (
            <div 
              key={test.id} 
              className="bg-[#0f173b]/45 backdrop-blur-md border border-cyan-500/20 p-6 rounded-2xl flex flex-col justify-between hover:border-cyan-500/50 hover:bg-[#131d4a]/50 transition duration-300 shadow-lg shadow-[#060917]/40"
            >
              <div className="space-y-4">
                {/* Stars and verified status */}
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-400 gap-0.5">
                    {Array.from({ length: test.rating }).map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  {test.verified && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/30">
                      <Check className="w-2.5 h-2.5" /> Verified User
                    </span>
                  )}
                </div>

                {/* Review Text */}
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic">
                  "{test.text}"
                </p>
              </div>

              {/* Author Info */}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-cyan-500/10">
                <img 
                  src={test.avatar} 
                  alt={test.name} 
                  className="w-10 h-10 rounded-full object-cover border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-xs font-bold text-white tracking-tight">{test.name}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{test.role}</p>
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* Solid Shield Lifetime Guarantee Banner */}
        <div className="mt-16 bg-[#0c1224]/40 backdrop-blur-md border border-cyan-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto shadow-xl shadow-cyan-500/5 hover:border-cyan-500/40 transition-all">
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            <div className="p-4 bg-cyan-950/40 border border-cyan-500/20 rounded-full text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Info className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-mono block">
                PEMBERITAHUAN LISENSI & KETENTUAN
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Membeli Artinya Sudah Mengerti Kegunaan Tools Ini
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xl font-medium">
                Sekali bayar, Anda berhak memakai software ini selamanya dengan <span className="text-cyan-400 font-bold">Gratis Update Selamanya</span>. Pastikan Anda sudah memahami seluruh fungsi tools batch audio mixing ini sebelum melakukan pembelian.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/25 border border-cyan-800/30 rounded-lg text-cyan-400 text-xs font-bold font-mono shadow">
            <Sparkle className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            LIFETIME LICENSE
          </div>
        </div>

      </div>
    </section>
  );
}
