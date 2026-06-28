import React from "react";
import { 
  Zap, Activity, Sparkles, BarChart3, Award, Gauge, Cpu, Download, Sparkle 
} from "lucide-react";
import { FEATURES } from "../data";

export default function Features() {
  const getIcon = (iconName: string) => {
    const classStyle = "w-6 h-6 text-cyan-400";
    switch (iconName) {
      case "Zap":
        return <Zap className={classStyle} />;
      case "Activity":
        return <Activity className="w-6 h-6 text-violet-400" />;
      case "Sparkles":
        return <Sparkles className="w-6 h-6 text-amber-400" />;
      case "BarChart3":
        return <BarChart3 className="w-6 h-6 text-cyan-400" />;
      case "Award":
        return <Award className="w-6 h-6 text-emerald-400" />;
      case "Gauge":
        return <Gauge className="w-6 h-6 text-rose-400" />;
      case "Cpu":
        return <Cpu className="w-6 h-6 text-violet-400" />;
      case "Download":
        return <Download className="w-6 h-6 text-cyan-400" />;
      default:
        return <Sparkles className={classStyle} />;
    }
  };

  return (
    <section id="features" className="py-16 md:py-24 bg-gradient-to-b from-[#020410] to-[#01030c] border-t border-cyan-500/20 relative">
      
      {/* Background visual elements */}
      <div className="absolute top-1/4 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[10px] font-bold tracking-widest text-violet-400 uppercase font-mono block">
            💎 CORE ARCHITECTURE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Fitur Utama Spesifikasi Monster MIXIN9
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Dipersenjatai dengan mesin pengolah audio terkini, MIXIN9 memadukan kepraktisan instan dengan kualitas standar rilis industri.
          </p>
        </div>

        {/* Features Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {FEATURES.map((feat) => (
            <div 
              key={feat.id} 
              className="p-6 bg-[#0f173b]/45 backdrop-blur-md border border-cyan-500/20 rounded-2xl flex flex-col justify-between hover:border-cyan-500/55 hover:bg-[#131d4a]/50 transition-all duration-300 group shadow-lg shadow-[#060917]/40"
            >
              <div className="space-y-4">
                
                {/* Header Row with Icon and Tag */}
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-[#070b1c]/90 rounded-xl border border-cyan-500/25 group-hover:scale-105 transition shadow-inner">
                    {getIcon(feat.icon)}
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-[#070b1c]/90 border border-cyan-500/20 text-zinc-400 px-2.5 py-0.5 rounded-full">
                    {feat.tag}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                    {feat.description}
                  </p>
                </div>

              </div>

              {/* Bottom tag decorator */}
              <div className="mt-4 pt-3 border-t border-cyan-500/10 flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                <Sparkle className="w-3 h-3 text-cyan-500" />
                <span>Teknologi Native C++</span>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
