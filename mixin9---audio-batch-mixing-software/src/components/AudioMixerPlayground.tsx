import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sliders, Eye, Laptop, ShieldCheck, Activity, Layers, 
  Sparkles, Info, ZoomIn, ZoomOut, Maximize2, MousePointerClick, 
  Volume2, CheckCircle2, ChevronRight, Zap, RefreshCw, Sun, Moon
} from "lucide-react";

// Types for Hotspots & Feature Spotlights
interface SpotlightFeature {
  id: string;
  title: string;
  shortTitle: string;
  category: "Core" | "Smart" | "Outputs";
  description: string;
  badge: string;
  // CSS positioning for the illuminated cutout (relative %)
  cutout: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  // Center coordinate for the pulsing interactive dot
  hotspot: {
    top: string;
    left: string;
  };
  details: string[];
}

export default function AudioMixerPlayground() {
  const [activeTab, setActiveTab] = useState<"workspace" | "vst">("workspace");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>("eq");
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [enhanceFilter, setEnhanceFilter] = useState<boolean>(true);
  const [simulatedAudioRunning, setSimulatedAudioRunning] = useState<boolean>(false);
  const [activeSimulatedPreset, setActiveSimulatedPreset] = useState<string>("Sound Horeg - Jedag Jedug");

  // Screenshot URLs provided by the user
  const SCREENSHOTS = {
    workspace: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiu4mYS_GiPd0U5b9rBTjr_F2jwgz2Ws6j0DI68uDR70L4fAwV2d1d9VDeXuCOktFQRAlJWWGZtrlf-g24adzpVKJaZz3lBqek-HcF0p6QOh4efvQIE0-vKe1e9sxYC1cFHY2IGXboCHV43Qb40kTyvaArPGuPRmO-peNHC4xfeTqrR8zU3Gkg8MnaBBd4/s1603/Screenshot_36.png",
    vst: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiVGRMHfq8T5_F6T9WfezWgIMJsDnEi3WBJR1ohvr24kDQsu-26DB3sOBtVQJj3FEY4bqwQ5gBXkR4KqJ6HkNQrA4JYelhli3YctIIi-Br814_1OOvFs06J2kDgZBnku24a2LW5CU1ZqVV0ZXf0L0EuK5ymwBY-fu-Dzory123yppxrPlQzL8g72yJ3uNs/s1080/Screenshot_37.png"
  };

  // 15-Band curves preset data to show interactive visual graphs below
  const PRESET_CURVES: Record<string, { label: string; desc: string; frequencies: number[]; color: string }> = {
    "Sound Horeg - Jedag Jedug": {
      label: "Sound Horeg (Jedag Jedug)",
      desc: "Boost ekstrem pada frekuensi sub-bass (25Hz - 100Hz) untuk getaran fisik maksimal khas horeg Jawa Timur.",
      frequencies: [12, 10, 8, 3, -2, -5, -3, 0, 2, 5, 8, 5, 3, 2, 1],
      color: "from-cyan-500 to-blue-600"
    },
    "Dangdut Koplo - Vocal Boost": {
      label: "Dangdut Koplo Vocalist",
      desc: "Menonjolkan vokal tengah (Mid-Range 1kHz - 4kHz) dan ketukan kendang agar terdengar renyah & jernih di atas sound system.",
      frequencies: [-6, -4, -1, 2, 4, 5, 4, 3, 2, 1, 2, 3, 4, 4, 2],
      color: "from-pink-500 to-rose-600"
    },
    "Mastering Spotify - Clear Match": {
      label: "Mastering - Spotify Standard",
      desc: "Kurva netral dengan limiter -14 LUFS untuk kualitas streaming jernih, seimbang, dan bebas distorsi clipping.",
      frequencies: [1, 2, 1, 0, 0, -1, 0, 1, 1, 2, 1, 2, 2, 1, 1],
      color: "from-emerald-500 to-teal-600"
    },
    "Radio Broadcast - Loud Comp": {
      label: "Radio Broadcast Compression",
      desc: "Memadatkan dynamic range dengan boosting mid-high (250Hz - 6.3kHz) agar suara vocal terdengar mantap & bertenaga.",
      frequencies: [-2, -1, 1, 2, 3, 2, 1, 1, 2, 3, 4, 3, 2, 1, 0],
      color: "from-amber-500 to-orange-600"
    }
  };

  // Spotlight regions maps
  const FEATURES_WORKSPACE: SpotlightFeature[] = [
    {
      id: "eq",
      title: "15-Band Studio Equalizer Grafis",
      shortTitle: "15-Band EQ Grafis",
      category: "Core",
      badge: "PRESISI TINGGI",
      description: "Equalizer grafis 15 channel untuk mengendalikan setiap detail frekuensi audio dari Sub-Bass paling rendah (25Hz) hingga Air Sparkle tertinggi (16kHz). Cocok untuk mengatur getaran bass tendangan horeg maupun kelembutan vokal.",
      cutout: {
        top: "52%",
        left: "24.5%",
        width: "55.5%",
        height: "36%"
      },
      hotspot: {
        top: "70%",
        left: "52%"
      },
      details: [
        "Pengaturan fader individual per frekuensi (25, 40, 63, 100, 160, 250, 400, 630, 1k, 1.6k, 2.5k, 4k, 6.3k, 10k, 16k)",
        "Bypass cepat untuk membandingkan audio asli (A) vs hasil mixing (B)",
        "Bebas distorsi digital berkat algoritma pemrosesan C++ native 64-bit"
      ]
    },
    {
      id: "queue",
      title: "Antrean Batch File Paralel (Multi-Threading)",
      shortTitle: "Parallel Batch Queue",
      category: "Core",
      badge: "SUPER EFISIEN",
      description: "Sistem antrean file canggih yang memproses puluhan track audio secara bersamaan menggunakan kekuatan multi-threading CPU Anda. Hemat waktu proses rendering hingga 90% dibanding software DAW tradisional.",
      cutout: {
        top: "12%",
        left: "0.5%",
        width: "23.5%",
        height: "82%"
      },
      hotspot: {
        top: "45%",
        left: "12%"
      },
      details: [
        "Mendukung format audio premium seperti WAV lossless dan MP3 berkualitas tinggi",
        "Watch Folder: Otomatis mendeteksi dan mengolah file baru yang masuk ke folder tertentu",
        "Sistem status intuitif dengan indikator progress rendering per file secara real-time"
      ]
    },
    {
      id: "preset-selector",
      title: "Menu Dropdown Preset Utama",
      shortTitle: "Preset Dropdown",
      category: "Smart",
      badge: "INSTANT PRESETS",
      description: "Dropdown khusus untuk memilih preset legendaris yang sudah diuji oleh ratusan sound engineer. Satu klik untuk mengubah karakter audio mentah Anda menjadi standar mastering industri.",
      cutout: {
        top: "12%",
        left: "80.5%",
        width: "19%",
        height: "17%"
      },
      hotspot: {
        top: "20%",
        left: "90%"
      },
      details: [
        "Preset siap pakai: YouTube Loud, Spotify Streaming, Radio Loud, Metal Tight, House Club",
        "Kemudahan kustomisasi: Simpan, ganti nama, atau hapus preset racikan pribadi Anda",
        "Auto-Mix Engine Assist: Menghitung loudness otomatis untuk target LUFS yang aman"
      ]
    },
    {
      id: "export-settings",
      title: "Format Output & Direktori Ekspor Otomatis",
      shortTitle: "Export & Volume Settings",
      category: "Outputs",
      badge: "KUSTOMISASI OUTPUT",
      description: "Bagian kontrol ekspor terpadu untuk menentukan path penyimpanan, fader volume utama, format output, dan pilihan sampling rate secara otomatis.",
      cutout: {
        top: "60%",
        left: "80.5%",
        width: "19%",
        height: "34%"
      },
      hotspot: {
        top: "76%",
        left: "90%"
      },
      details: [
        "Pilihan format fleksibel (WAV, MP3) dengan optimasi ukuran file",
        "Input destinasi folder lokal langsung (misal: E:\\AUTO KLIK\\MIXIN9\\...)",
        "Master volume limiter internal untuk mencegah clipping pada hasil akhir ekspor"
      ]
    }
  ];

  const FEATURES_VST: SpotlightFeature[] = [
    {
      id: "vst-integration",
      title: "Integrasi Headless VST3 (Ozone 8 & Lainnya)",
      shortTitle: "Integrasi VST3 Pro",
      category: "Core",
      badge: "TEKNOLOGI MAJU",
      description: "MIXIN9 mampu meluncurkan dan mengontrol plugin VST3 eksternal favorit Anda seperti iZotope Ozone 8 langsung di latar belakang secara headless. Menghadirkan kualitas mastering analog profesional langsung ke dalam workflow batch otomatis Anda.",
      cutout: {
        top: "16%",
        left: "14%",
        width: "71%",
        height: "63%"
      },
      hotspot: {
        top: "46%",
        left: "50%"
      },
      details: [
        "Load plugin VST3 pihak ketiga secara mulus langsung dari library lokal",
        "Auto-Close Safely: Memastikan proses Ozone ditutup secara sempurna setelah rendering selesai untuk menghemat RAM",
        "Simpan parameter VST sebagai bagian dari template preset global Anda"
      ]
    },
    {
      id: "logs-panel",
      title: "Sistem Log Deteksi & Pemrosesan Latar Belakang",
      shortTitle: "Console Log Status",
      category: "Smart",
      badge: "REAL-TIME LOGS",
      description: "Konsol pemantauan real-time yang memaparkan langkah demi langkah proses penyiapan plugin, pembacaan file, hingga status rendering akhir tanpa memperlambat sistem.",
      cutout: {
        top: "12%",
        left: "0.5%",
        width: "13%",
        height: "82%"
      },
      hotspot: {
        top: "50%",
        left: "7%"
      },
      details: [
        "Deteksi kegagalan plugin otomatis dengan fallback pengolahan internal",
        "Informasi detail penulisan file master hasil ekspor secara runtut",
        "Tampilan ramah developer untuk memastikan seluruh alur batch berjalan lancar"
      ]
    }
  ];

  const activeFeaturesList = activeTab === "workspace" ? FEATURES_WORKSPACE : FEATURES_VST;
  const currentSelectedFeature = activeFeaturesList.find(f => f.id === selectedFeatureId) || activeFeaturesList[0];

  const handleToggleTab = (tab: "workspace" | "vst") => {
    setActiveTab(tab);
    // Auto-select first feature of new tab
    if (tab === "workspace") {
      setSelectedFeatureId("eq");
    } else {
      setSelectedFeatureId("vst-integration");
    }
  };

  return (
    <div id="interactive-showcase-container" className="w-full font-sans text-slate-100 bg-[#060a1e] rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl relative">
      
      {/* 1. TOP INTERACTIVE SWITCHER BAR */}
      <div className="flex border-b border-cyan-500/10 bg-[#090e28] p-1">
        <button 
          onClick={() => handleToggleTab("workspace")}
          className={`flex-1 py-4 px-3 sm:px-6 text-xs sm:text-sm font-black tracking-wide transition flex items-center justify-center gap-2.5 rounded-lg ${
            activeTab === "workspace" 
            ? "bg-[#121c4b] text-cyan-400 shadow-md border-b-2 border-b-cyan-400" 
            : "text-zinc-400 hover:text-white hover:bg-[#0e163b]/70"
          }`}
        >
          <Laptop className="w-4.5 h-4.5 text-cyan-400" />
          <span className="uppercase">1. Antarmuka Utama Software</span>
        </button>
        <button 
          onClick={() => handleToggleTab("vst")}
          className={`flex-1 py-4 px-3 sm:px-6 text-xs sm:text-sm font-black tracking-wide transition flex items-center justify-center gap-2.5 rounded-lg ${
            activeTab === "vst" 
            ? "bg-[#121c4b] text-cyan-400 shadow-md border-b-2 border-b-cyan-400" 
            : "text-zinc-400 hover:text-white hover:bg-[#0e163b]/70"
          }`}
        >
          <Layers className="w-4.5 h-4.5 text-violet-400" />
          <span className="uppercase">2. Integrasi VST3 & Ozone 8</span>
        </button>
      </div>

      {/* BACKGROUND DECORATIVE GLOW */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/5 via-violet-600/5 to-transparent blur-[80px] pointer-events-none z-0" />

      {/* 2. CORE SHOWCASE PANEL (SIDEBAR + IMAGE INTERACTION) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 relative z-10">
        
        {/* LEFT COLUMN: INTERACTIVE NAVIGATION SIDEBAR (Col Span: 4) */}
        <div className="lg:col-span-4 flex flex-col gap-4 order-2 lg:order-1">
          
          {/* Quick Info Badge */}
          <div className="bg-[#0b1236]/90 border border-cyan-500/10 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>SENTER INTERAKTIF (SPOTLIGHT)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
              Arahkan kursor atau pilih fitur di bawah ini untuk <span className="text-white font-bold">menerangi dan menyorot bagian penting</span> dari tangkapan layar asli software MIXIN9.
            </p>
          </div>

          {/* Feature Selector Buttons */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block pl-1">
              Daftar Fitur Utama Yang Ditampilkan
            </span>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {activeFeaturesList.map((feat) => (
                <button
                  key={feat.id}
                  onClick={() => setSelectedFeatureId(feat.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-2.5 cursor-pointer ${
                    selectedFeatureId === feat.id
                    ? "bg-gradient-to-r from-[#121d51] to-[#0a1030] border-cyan-500/40 shadow-md text-white"
                    : "bg-[#090f2b]/80 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${selectedFeatureId === feat.id ? "bg-cyan-400 animate-pulse" : "bg-zinc-700"}`} />
                    <div className="truncate">
                      <span className="text-xs font-extrabold block tracking-tight">{feat.shortTitle}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest block mt-0.5">{feat.badge}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedFeatureId === feat.id ? "text-cyan-400 translate-x-0.5" : "text-zinc-600"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Enhanced Controls Toolbox */}
          <div className="bg-[#080d28]/90 border border-zinc-800/80 rounded-xl p-4 space-y-3 font-mono text-[11px]">
            <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider block border-b border-zinc-800 pb-1.5">
              ⚙️ Pengaturan Tampilan Desain
            </span>

            {/* Brightness Booster (Answering: "biar gak terlihat gelap begitu") */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Boost Kecerahan Gambar
              </span>
              <button 
                onClick={() => setEnhanceFilter(!enhanceFilter)}
                className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${enhanceFilter ? "bg-cyan-500" : "bg-zinc-800"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${enhanceFilter ? "translate-x-4.5" : "translate-x-0"}`} />
              </button>
            </div>

            <div className="text-[10px] text-zinc-500 leading-relaxed">
              {enhanceFilter 
                ? "✓ Filter kontras dan saturasi premium diaktifkan agar gambar tajam, neon, dan sangat jelas."
                : "Menggunakan tampilan default tangkapan layar mentah."}
            </div>

            {/* Simulated Playback Button */}
            <div className="pt-2">
              <button
                onClick={() => setSimulatedAudioRunning(!simulatedAudioRunning)}
                className={`w-full py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  simulatedAudioRunning 
                  ? "bg-rose-950/40 border border-rose-500 text-rose-400" 
                  : "bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/70"
                }`}
              >
                <Activity className={`w-3.5 h-3.5 ${simulatedAudioRunning ? "animate-spin" : ""}`} />
                <span>{simulatedAudioRunning ? "Sembunyikan Audio FFT Wave" : "Simulasikan Audio FFT Wave"}</span>
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: MAJESTIC SCREENSHOT VIEWER WITH SPOTLIGHTS (Col Span: 8) */}
        <div className="lg:col-span-8 flex flex-col gap-4 order-1 lg:order-2">
          
          {/* OS-Style Window Frame Container */}
          <div className="bg-[#050818] rounded-xl border border-cyan-500/20 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] relative group">
            
            {/* Native Titlebar Chrome */}
            <div className="bg-[#0b1029] border-b border-cyan-500/10 px-4 py-2.5 flex items-center justify-between text-xs font-mono select-none">
              <div className="flex items-center gap-2 text-zinc-300">
                <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-extrabold tracking-tight">
                  {activeTab === "workspace" ? "ZiqvaAudioMixer.exe (Original Design)" : "Ozone8HeadlessProcess.exe"}
                </span>
                <span className="text-[10px] text-zinc-500 px-2 py-0.5 bg-zinc-950 rounded border border-zinc-900 hidden sm:inline">
                  Windows Native C++ Qt Build
                </span>
              </div>
              
              {/* Window Controls */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 block"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 block"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-red-600 block"></div>
              </div>
            </div>

            {/* SCREENSHOT CONTAINER WITH INTEGRATED SPOTLIGHT HOVERING LAYER */}
            <div className="relative overflow-hidden aspect-[16/10] bg-[#02040a] select-none">
              
              {/* Image base render */}
              <img 
                src={activeTab === "workspace" ? SCREENSHOTS.workspace : SCREENSHOTS.vst} 
                alt="MIXIN9 Original Software Interface"
                className={`w-full h-full object-cover select-none pointer-events-none transition-all duration-300 ${
                  enhanceFilter 
                  ? "brightness-[1.14] contrast-[1.05] saturate-[1.12] drop-shadow-xl" 
                  : "brightness-100"
                }`}
                style={{
                  transform: `scale(${zoomScale})`,
                  transformOrigin: "center center"
                }}
              />

              {/* DARK SPOTLIGHT OVERLAY MASK (Dimming the rest of the image when a feature is selected) */}
              <AnimatePresence>
                {selectedFeatureId && currentSelectedFeature && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.65 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 bg-[#020409] pointer-events-none z-10"
                    style={{
                      clipPath: `polygon(
                        0% 0%, 100% 0%, 100% 100%, 0% 100%,
                        0% 0%, 
                        ${currentSelectedFeature.cutout.left} ${currentSelectedFeature.cutout.top},
                        ${currentSelectedFeature.cutout.left} calc(${currentSelectedFeature.cutout.top} + ${currentSelectedFeature.cutout.height}),
                        calc(${currentSelectedFeature.cutout.left} + ${currentSelectedFeature.cutout.width}) calc(${currentSelectedFeature.cutout.top} + ${currentSelectedFeature.cutout.height}),
                        calc(${currentSelectedFeature.cutout.left} + ${currentSelectedFeature.cutout.width}) ${currentSelectedFeature.cutout.top},
                        ${currentSelectedFeature.cutout.left} ${currentSelectedFeature.cutout.top}
                      )`
                    }}
                  />
                )}
              </AnimatePresence>

              {/* HIGHLIGHT BOX OVER THE SELECTED PORTION */}
              {selectedFeatureId && currentSelectedFeature && (
                <div 
                  className="absolute z-20 border-2 border-cyan-400 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.5)] pointer-events-none transition-all duration-300"
                  style={{
                    top: currentSelectedFeature.cutout.top,
                    left: currentSelectedFeature.cutout.left,
                    width: currentSelectedFeature.cutout.width,
                    height: currentSelectedFeature.cutout.height
                  }}
                >
                  {/* Small neon label */}
                  <div className="absolute -top-6 left-0 bg-cyan-400 text-zinc-950 text-[9px] font-black tracking-widest uppercase py-0.5 px-2 rounded-t flex items-center gap-1 shadow-lg">
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    <span>Selected Feature</span>
                  </div>
                </div>
              )}

              {/* FLOATING INTERACTIVE DOTS (HOTSPOTS) */}
              {activeFeaturesList.map((feat) => {
                const isSelected = selectedFeatureId === feat.id;
                return (
                  <button
                    key={feat.id}
                    onClick={() => setSelectedFeatureId(feat.id)}
                    className="absolute z-30 -translate-x-1/2 -translate-y-1/2 group/dot cursor-pointer"
                    style={{
                      top: feat.hotspot.top,
                      left: feat.hotspot.left
                    }}
                  >
                    {/* Ring 1: Outer Pulse */}
                    <span className="absolute inline-flex h-8 w-8 rounded-full bg-cyan-400/30 animate-ping" />
                    
                    {/* Ring 2: Core Glow */}
                    <span className={`relative inline-flex rounded-full h-5.5 w-5.5 items-center justify-center transition-all ${
                      isSelected 
                      ? "bg-cyan-400 text-zinc-950 scale-110 shadow-[0_0_15px_#22d3ee]" 
                      : "bg-[#090f2b] border-2 border-cyan-400 text-cyan-400 group-hover/dot:bg-cyan-500 group-hover/dot:text-zinc-950"
                    }`}>
                      <MousePointerClick className="w-3 h-3" />
                    </span>

                    {/* Tooltip on Hover */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-8 bg-zinc-900 border border-cyan-500/25 text-white text-[10px] font-bold py-1 px-2.5 rounded shadow-xl whitespace-nowrap opacity-0 group-hover/dot:opacity-100 transition pointer-events-none">
                      {feat.shortTitle} (Klik Detail)
                    </div>
                  </button>
                );
              })}

              {/* Bottom Instructions Watermark */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 bg-zinc-950/80 border border-zinc-800/60 py-1 px-3.5 rounded-full text-[9px] font-mono tracking-wider text-zinc-400 flex items-center gap-1.5 select-none pointer-events-none">
                <Info className="w-3 h-3 text-cyan-400" />
                <span>Klik area mana saja pada tangkapan layar untuk mengeksplorasi modul</span>
              </div>

            </div>

            {/* Quick Zoom & Control Toolbar Overlay */}
            <div className="absolute right-3 top-14 z-20 flex flex-col gap-1.5 bg-zinc-950/80 border border-zinc-800/80 p-1.5 rounded-lg shadow-lg">
              <button 
                onClick={() => setZoomScale(prev => Math.min(prev + 0.15, 1.6))}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setZoomScale(prev => Math.max(prev - 0.15, 1))}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => { setZoomScale(1); setSelectedFeatureId(null); }}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-slate-300 hover:text-white transition cursor-pointer text-[9px] font-bold font-mono"
                title="Reset Tampilan"
              >
                RESET
              </button>
            </div>

          </div>

          {/* ACTIVE HIGHLIGHT DETAIL PANEL */}
          <div className="bg-[#090e29] border border-cyan-500/15 rounded-xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
            
            {/* Visual tech grid decoration */}
            <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-at-br from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

            <div className="space-y-3 relative z-10">
              
              {/* Header block */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-cyan-500/10 pb-2.5">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-cyan-400 font-mono tracking-widest uppercase bg-cyan-950/50 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
                    {currentSelectedFeature.badge}
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                    <span>{currentSelectedFeature.title}</span>
                  </h3>
                </div>

                <div className="text-[10px] font-mono text-zinc-500">
                  ID Modul: <span className="text-zinc-300 font-bold">#{currentSelectedFeature.id}</span>
                </div>
              </div>

              {/* Main paragraph description */}
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                {currentSelectedFeature.description}
              </p>

              {/* Detailed Bulletpoints */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold text-zinc-300 tracking-wider font-mono block">
                  🛡️ SPESIFIKASI & METODE OPERASI:
                </span>
                
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-zinc-400 font-medium font-sans">
                  {currentSelectedFeature.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-cyan-400 mt-1 shrink-0">✦</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* 3. INTERACTIVE AUDIO FREQUENCY VISUALIZER PREVIEW (At the bottom) */}
      <div className="border-t border-cyan-500/10 bg-[#04060f] p-4 sm:p-6 text-center space-y-4">
        
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-cyan-400 tracking-widest font-mono uppercase block">
            🎵 VISUALISASI KARAKTER PRESET UTAMA
          </span>
          <h4 className="text-xs sm:text-sm font-extrabold text-white">
            Bagaimana EQ MIXIN9 Mengubah Suara Audio Anda?
          </h4>
          <p className="text-[10px] sm:text-xs text-zinc-400 max-w-2xl mx-auto">
            Garis gelombang di bawah menunjukkan kurva penguatan (gain/boost) frekuensi audio pada masing-masing preset desktop MIXIN9 asli Anda. Pilih preset untuk melihat bentuk kurvanya!
          </p>
        </div>

        {/* Preset tags selectors */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {Object.entries(PRESET_CURVES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setActiveSimulatedPreset(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                activeSimulatedPreset === key
                ? "bg-[#111943] text-cyan-400 border-cyan-500/50"
                : "bg-[#090f27] border-zinc-900/60 text-zinc-400 hover:text-white"
              }`}
            >
              {val.label}
            </button>
          ))}
        </div>

        {/* Dynamic visual graph based on preset selected */}
        <div className="bg-[#070c24] border border-cyan-950/60 rounded-xl p-4 max-w-3xl mx-auto space-y-4 relative overflow-hidden">
          
          {/* Neon background light behind graph */}
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

          {/* Frequencies visual bands */}
          <div className="h-32 flex items-end justify-between gap-1 sm:gap-2 px-2 relative z-10 border-b border-zinc-800 pb-2">
            
            {/* Horizontal Zero-Reference line */}
            <div className="absolute left-0 right-0 h-px border-t border-dashed border-zinc-800 pointer-events-none" style={{ bottom: "50%" }} />

            {PRESET_CURVES[activeSimulatedPreset].frequencies.map((freqValue, idx) => {
              const hzLabels = ["25", "40", "63", "100", "160", "250", "400", "630", "1k", "1.6k", "2.5k", "4k", "6.3k", "10k", "16k"];
              
              // Map DB value (-12 to +12) to percentage height (0 to 100)
              const percentageHeight = ((freqValue + 12) / 24) * 100;
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group/bar">
                  
                  {/* Tooltip db value on hover */}
                  <div className="bg-zinc-950 border border-zinc-800 text-white text-[9px] font-mono py-0.5 px-1.5 rounded mb-1 opacity-0 group-hover/bar:opacity-100 transition whitespace-nowrap pointer-events-none">
                    {freqValue > 0 ? `+${freqValue}` : freqValue} dB
                  </div>

                  {/* Visual Neon Bar */}
                  <div className="w-full h-24 bg-[#050817] rounded-md overflow-hidden relative border border-zinc-900 flex items-end">
                    
                    {/* Active Filled Bar */}
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${percentageHeight}%` }}
                      transition={{ type: "spring", stiffness: 100 }}
                      className={`w-full bg-gradient-to-t ${PRESET_CURVES[activeSimulatedPreset].color} rounded-t-sm`}
                    />

                  </div>

                  <span className="text-[7px] sm:text-[8px] font-mono text-zinc-500 mt-1.5">{hzLabels[idx]}</span>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <span className="text-[11px] font-semibold text-zinc-300 font-sans block max-w-xl mx-auto">
              ℹ️ <span className="text-white font-bold">{PRESET_CURVES[activeSimulatedPreset].label}:</span> {PRESET_CURVES[activeSimulatedPreset].desc}
            </span>
          </div>

        </div>

      </div>

      {/* 4. VERIFIED LEGIT WATERMARK BANNER */}
      <div className="bg-[#090e29] border-t border-cyan-500/15 py-3.5 px-4 text-center text-[10px] sm:text-xs font-mono text-slate-400 flex flex-wrap items-center justify-center gap-3">
        <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <ShieldCheck className="w-4 h-4 fill-current text-emerald-500" />
          DESAIN ASLI TERVERIFIKASI
        </span>
        <span className="text-zinc-600 hidden sm:inline">|</span>
        <span>Tidak ada manipulasi mockup fiktif. Tangkapan layar di atas diambil langsung dari software produksi asli MIXIN9 Anda.</span>
      </div>

    </div>
  );
}
