import React, { useState, useEffect } from "react";
import { Sparkles, Clock, ShieldCheck, CheckCircle2, UserCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { COPYWRITING_STRUCTURE } from "../data";

interface PricingProps {
  onOpenCheckout: () => void;
  promoPrice: number;
  couponApplied: boolean;
  setCouponApplied: (applied: boolean) => void;
  activePrice: number;
}

export default function Pricing({ 
  onOpenCheckout, 
  promoPrice, 
  couponApplied, 
  setCouponApplied, 
  activePrice 
}: PricingProps) {
  // Countdown Timer state: e.g., 14 minutes and 32 seconds left
  const [timeLeft, setTimeLeft] = useState({ minutes: 14, seconds: 32 });
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);

  // Prefill coupon field if discount is applied elsewhere
  useEffect(() => {
    if (couponApplied) {
      setCouponInput("MIXIN9");
    } else {
      setCouponInput("");
    }
  }, [couponApplied]);
  
  // Real-time conversion ticker state
  const recentPurchases = [
    { name: "Randi (Semarang)", time: "5 menit lalu", track: "Podcaster" },
    { name: "Devi (Bandung)", time: "18 menit lalu", track: "YouTuber" },
    { name: "Asep (Jakarta)", time: "43 menit lalu", track: "Music Producer" },
    { name: "Mega (Surabaya)", time: "1 jam lalu", track: "Freelance Editor" }
  ];
  const [activePurchaseIdx, setActivePurchaseIdx] = useState(0);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = couponInput.trim().toUpperCase();
    if (cleanInput === "MIXIN9" || cleanInput === "LAUNCH50") {
      setCouponApplied(true);
      setCouponError("");
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    } else {
      setCouponError("Kode kupon salah. Coba gunakan: MIXIN9 atau LAUNCH50");
    }
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(false);
    setCouponInput("");
    setCouponError("");
  };

  // Timer countdown hook
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { minutes: prev.minutes - 1, seconds: 59 };
        } else {
          // Reset countdown or keep at 0, let's reset to 15m to maintain perpetual urgency
          return { minutes: 15, seconds: 0 };
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Purchase ticker auto-scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePurchaseIdx((prev) => (prev + 1) % recentPurchases.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const formattedNormalPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(COPYWRITING_STRUCTURE.priceSection.normalPrice);

  const formattedPromoPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(promoPrice);

  return (
    <section id="pricing" className="py-16 md:py-24 bg-gradient-to-b from-[#040822] to-[#020512] border-t border-cyan-500/20 relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto mb-12">
          <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase font-mono block">
            🏷️ PENAWARAN TERBATAS HARI INI
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {COPYWRITING_STRUCTURE.priceSection.heading}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-semibold">
            {COPYWRITING_STRUCTURE.priceSection.subheading}
          </p>
        </div>

        {/* Pricing Bento Card Card */}
        <div className="max-w-xl mx-auto relative group">
          {/* Cyber outer border glow */}
          <div className="absolute -inset-1 bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 rounded-3xl blur-xl opacity-25 group-hover:opacity-40 transition duration-1000" />

          {/* Pricing container */}
          <div className="relative bg-[#0d1633]/85 backdrop-blur-md border-2 border-cyan-500/40 rounded-3xl overflow-hidden shadow-2xl shadow-cyan-950/20">
            
            {/* Top Badge: Slots indicator */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-center flex items-center justify-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <p className="text-xs font-black text-white uppercase tracking-wider font-mono">
                Sisa 3 dari 10 Slot Promo Rp 99.000 Terbuka Hari Ini!
              </p>
            </div>

            {/* Pricing Body */}
            <div className="p-8 space-y-6">
              
              {/* Scarcity countdown ticker */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#070b1c]/90 border border-cyan-500/20 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-zinc-300 font-mono uppercase tracking-wide">
                    {COPYWRITING_STRUCTURE.priceSection.urgencyText}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xl font-bold font-mono text-white">
                  <span className="bg-[#0e173a] px-2.5 py-1 rounded-lg border border-cyan-500/20">
                    {timeLeft.minutes.toString().padStart(2, "0")}
                  </span>
                  <span className="text-cyan-600 animate-pulse">:</span>
                  <span className="bg-[#0e173a] px-2.5 py-1 rounded-lg border border-cyan-500/20 text-cyan-400">
                    {timeLeft.seconds.toString().padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 font-sans">Menit</span>
                </div>
              </div>

              {/* Price Tag Box */}
              <div className="text-center space-y-2 py-4 relative">
                <p className="text-xs font-bold font-mono text-zinc-500 uppercase tracking-wider">HARGA INVESTASI LIFETIME</p>
                
                {couponApplied ? (
                  <>
                    <div className="flex items-center justify-center gap-4">
                      <span className="text-lg text-zinc-500 line-through font-mono">
                        {formattedNormalPrice}
                      </span>
                      <span className="px-2.5 py-1 text-[10px] bg-red-950 border border-red-800/40 text-red-400 font-bold font-mono rounded-full animate-bounce">
                        DISKON 50% AKTIF
                      </span>
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-center justify-center gap-1">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-mono">
                        {formattedPromoPrice}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed max-w-sm mx-auto">
                      Khusus Hari Ini: Hanya tersisa 3 slot promo untuk mendapatkan potongan setengah harga! Begitu slot penuh, harga kembali menjadi Rp 199.000. *(Harap transfer sesuai nominal acak unik yang muncul untuk mempercepat verifikasi otomatis).*
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-center justify-center gap-1">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-300 to-zinc-100 font-mono">
                        {formattedNormalPrice}
                      </span>
                    </div>
                    <p className="text-xs text-amber-400 font-bold max-w-sm mx-auto flex items-center justify-center gap-1 bg-amber-950/40 border border-amber-900/30 p-2 rounded-xl">
                      <AlertTriangle className="w-3.5 h-3.5" /> Gunakan kupon <span className="underline font-mono font-black text-white">MIXIN9</span> untuk diskon 50%!
                    </p>
                  </>
                )}
              </div>

              {/* Coupon Input Form */}
              <form onSubmit={handleApplyCoupon} className="p-4 bg-[#05091d] border border-cyan-500/15 rounded-2xl space-y-3 relative overflow-hidden">
                {showCelebration && (
                  <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex items-center justify-center text-emerald-400 font-black text-sm animate-pulse z-10">
                    🎉 KODE KUPON BERHASIL DITERAPKAN!
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
                    🎟️ MASUKKAN KODE KUPON
                  </label>
                  {couponApplied && (
                    <span className="text-[10px] text-emerald-400 font-black uppercase font-mono animate-pulse">
                      ✓ DISKON AKTIF
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Masukkan kode kupon (misal: MIXIN9)"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      setCouponError("");
                    }}
                    disabled={couponApplied}
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs font-mono uppercase placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 transition disabled:opacity-60 disabled:text-emerald-400"
                  />
                  {couponApplied ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="px-3 py-2 bg-red-950/40 border border-red-900/50 hover:bg-red-900/40 text-red-400 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Batal
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md hover:shadow-cyan-500/10 active:scale-[0.98]"
                    >
                      Terapkan
                    </button>
                  )}
                </div>

                {couponError && (
                  <p className="text-[10px] text-rose-400 font-semibold">{couponError}</p>
                )}
                {couponApplied && (
                  <p className="text-[10px] text-emerald-400 font-semibold">
                    ✓ Selamat! Kupon berhasil diterapkan. Harga turun menjadi {formattedPromoPrice}.
                  </p>
                )}
              </form>

              {/* Features bullets inside pricing */}
              <div className="border-t border-b border-cyan-500/15 py-5 space-y-3.5">
                <div className="flex items-center gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>Lisensi Lifetime</strong>: Sekali bayar, aktif selamanya tanpa sewa.</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>Full Support</strong>: Konsultasi langsung ke pengembang @effands.</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>Gratis Update</strong>: Berhak menerima upgrade fitur v3.0 otomatis gratis.</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>Kompatibilitas Penuh</strong>: Berjalan lancar di Windows & macOS M1/M2/Intel.</span>
                </div>
              </div>

              {/* Scarcity slot meter */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold font-mono text-zinc-400">
                  <span>Slot Terisi Hari Ini: 7/10</span>
                  <span className="text-red-400 animate-pulse">SISA 3 SLOT PROMO</span>
                </div>
                <div className="h-2.5 w-full bg-[#070b1c] rounded-full overflow-hidden border border-cyan-500/10">
                  <div className="h-full w-[70%] bg-gradient-to-r from-violet-600 to-cyan-400 rounded-full" />
                </div>
              </div>

              {/* Huge glowing buy button */}
              <div className="pt-2">
                <button
                  onClick={onOpenCheckout}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-400 via-cyan-500 to-violet-600 hover:opacity-95 text-zinc-950 font-black rounded-2xl text-sm sm:text-base tracking-wide uppercase transition duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/10 hover:shadow-cyan-500/30 active:scale-[0.98]"
                >
                  <Sparkles className="w-5 h-5 text-zinc-950 fill-zinc-950" />
                  <span>AMBIL PROMO {couponApplied ? formattedPromoPrice : formattedNormalPrice} SEKARANG</span>
                  <ArrowRight className="w-4 h-4 text-zinc-950" />
                </button>
                <span className="text-[10px] text-zinc-500 text-center block mt-3 font-semibold font-mono">
                  🔒 Pembayaran Aman • Dukungan QRIS Bank/e-Wallet • Konfirmasi Telegram
                </span>
              </div>

            </div>

          </div>
        </div>

        {/* Live Recent Purchase Ticker */}
        <div className="mt-8 max-w-sm mx-auto bg-[#0f173b]/45 backdrop-blur-md border border-cyan-500/20 p-3 rounded-xl flex items-center gap-3 transition-all duration-500 animate-fade-in relative overflow-hidden shadow-lg">
          <div className="p-2 bg-cyan-950/50 border border-cyan-500/20 text-cyan-400 rounded-lg">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs">
            <p className="text-white font-bold">
              {recentPurchases[activePurchaseIdx].name}
            </p>
            <p className="text-zinc-400 text-[10px] font-semibold mt-0.5">
              Baru saja membeli software MIXIN9 ({recentPurchases[activePurchaseIdx].time})
            </p>
          </div>
          <span className="text-[9px] font-mono font-bold bg-[#070b1c] text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20">
            {recentPurchases[activePurchaseIdx].track}
          </span>
          <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-zinc-950/0 to-zinc-950/0 pointer-events-none" />
        </div>

      </div>
    </section>
  );
}
