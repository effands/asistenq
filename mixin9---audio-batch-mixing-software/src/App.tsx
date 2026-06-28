import React, { useState, useEffect } from "react";
import { Sliders, Send, Sparkles, ShieldCheck } from "lucide-react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import PainPoints from "./components/PainPoints";
import Solution from "./components/Solution";
import AudioMixerPlayground from "./components/AudioMixerPlayground";
import Features from "./components/Features";
import Testimonials from "./components/Testimonials";
import Pricing from "./components/Pricing";
import FAQ from "./components/FAQ";
import CheckoutModal from "./components/CheckoutModal";

export default function App() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [randomPrice, setRandomPrice] = useState(99000);
  const [couponApplied, setCouponApplied] = useState(false);

  useEffect(() => {
    // Generate a random unique number between 100 and 999 for easy payment verification
    const uniqueDigits = Math.floor(Math.random() * 900) + 100;
    setRandomPrice(99000 + uniqueDigits);
  }, []);

  const activePrice = couponApplied ? randomPrice : 199000;

  const handleOpenCheckoutWithPromo = () => {
    setCouponApplied(true);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#02040e] text-white font-sans selection:bg-violet-500 selection:text-white overflow-x-hidden relative">
      
      {/* Absolute "Bombastic" Ambient Glowing Blobs & Cyber Grid */}
      <div className="absolute inset-0 cyber-grid pointer-events-none z-0 opacity-80" />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute top-[20%] right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="absolute top-[50%] left-10 w-[500px] h-[500px] bg-pink-500/5 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-20 right-10 w-[600px] h-[600px] bg-cyan-600/8 rounded-full blur-[160px] pointer-events-none z-0" />
      
      {/* Floating Spark of Conversion Badge */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-center py-2 px-4 text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 border-b border-zinc-800/20">
        <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
        <span>Gunakan Kupon LAUNCH50 atau MIXIN9: Hanya {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(randomPrice)} khusus untuk 10 pembeli pertama hari ini!</span>
        <button 
          onClick={handleOpenCheckoutWithPromo}
          className="underline text-white font-black hover:text-cyan-200 transition pl-1"
        >
          Klaim Promo →
        </button>
      </div>

      {/* Main Glassmorphic Navigation Header */}
      <Header 
        onOpenCheckout={() => setCheckoutOpen(true)} 
      />

      {/* Hero Section */}
      <Hero onOpenCheckout={() => setCheckoutOpen(true)} />

      {/* Pain Points (Masalah) Section */}
      <PainPoints />

      {/* Solusi Section */}
      <Solution />

      {/* Interactive Audio Mixer Playground Section */}
      <section id="mixer-playground-section" className="py-16 md:py-24 bg-gradient-to-b from-[#020512] via-[#040822]/45 to-[#020410] border-t border-cyan-500/20 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-radial-at-t from-cyan-900/10 via-zinc-950/0 to-zinc-950/0 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-3xl mx-auto mb-12">
            <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-mono block">
              💻 DESAIN ANTARMUKA & SIMULASI WORKFLOW ASLI
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Eksplorasi Detail Software Desktop MIXIN9
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-semibold">
              Berikut adalah penjelajahan interaktif desain asli dari software desktop MIXIN9 (Windows/macOS). Klik bagian penting atau hotspot pada tangkapan layar di bawah ini untuk melihat detail modul, mengaktifkan fader pencerah gambar agar lebih terang, serta memahami kurva frekuensi preset andalan Anda!
            </p>
          </div>

          {/* Core Interactive Audio Mixer */}
          <AudioMixerPlayground />

        </div>
      </section>

      {/* Features List Section */}
      <Features />

      {/* Testimonials & Guarantee Section */}
      <Testimonials />

      {/* Pricing with Scarcity Section */}
      <Pricing 
        onOpenCheckout={() => setCheckoutOpen(true)} 
        promoPrice={randomPrice}
        couponApplied={couponApplied}
        setCouponApplied={setCouponApplied}
        activePrice={activePrice}
      />

      {/* FAQ Accordion Section */}
      <FAQ />

      {/* Floating Action Buttons for quick accessibility on mobile/desktop */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2.5">
        <button
          onClick={handleOpenCheckoutWithPromo}
          className="p-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white rounded-full shadow-xl shadow-violet-600/30 hover:scale-105 transition group flex items-center justify-center relative cursor-pointer"
          title="Klaim Diskon 50%"
        >
          <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
          <span className="absolute right-14 bg-zinc-900 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg border border-zinc-800 shadow opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
            Klaim Diskon 50%
          </span>
        </button>
      </div>

      {/* Majestic Footer */}
      <footer className="bg-[#010207] border-t border-cyan-500/25 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-cyan-500/10 pb-8">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-lg text-white">
                <Sliders className="w-5 h-5 rotate-90" />
              </div>
              <span className="text-lg font-black text-white tracking-wider font-sans">
                MIXIN<span className="text-cyan-400">9</span>
              </span>
            </div>
            
            <p className="text-xs text-zinc-500 font-medium text-center md:text-right max-w-md">
              Software batch audio mixing desktop buatan anak bangsa. Mengubah workflow produksi audio yang lambat menjadi secepat kedipan mata.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <div className="space-y-1 text-center sm:text-left">
              <p>© 2026 MIXIN9. All rights reserved.</p>
              <p>Developed with passion by <a href="https://t.me/effands" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">@effands</a> • <a href="https://ziqva.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ziqva.com</a></p>
            </div>
            
            <div className="flex items-center gap-6">
              <a href="https://t.me/effands" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1">
                <Send className="w-3.5 h-3.5 text-sky-400" /> Telegram Developer
              </a>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Lisensi Lifetime Terjamin
              </span>
            </div>
          </div>

        </div>
      </footer>

      {/* Epic Popup Checkout Modal (QRIS + Telegram redirection) */}
      <CheckoutModal 
        isOpen={checkoutOpen} 
        onClose={() => setCheckoutOpen(false)} 
        price={activePrice} 
        discountedPrice={randomPrice}
        couponApplied={couponApplied}
        setCouponApplied={setCouponApplied}
      />

    </div>
  );
}
