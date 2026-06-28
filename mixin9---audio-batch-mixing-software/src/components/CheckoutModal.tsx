import React, { useState, useEffect } from "react";
import { X, Send, QrCode, CheckCircle2, Sparkles, Copy, ExternalLink, HelpCircle, ShieldCheck, AlertCircle } from "lucide-react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  price: number;
  discountedPrice: number;
  couponApplied: boolean;
  setCouponApplied: (applied: boolean) => void;
}

export default function CheckoutModal({ 
  isOpen, 
  onClose, 
  price, 
  discountedPrice, 
  couponApplied, 
  setCouponApplied 
}: CheckoutModalProps) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerTelegram, setBuyerTelegram] = useState("");
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"pay" | "success">("pay");
  const [confetti, setConfetti] = useState<{ id: number; x: number; y: number; color: string; size: number }[]>([]);
  
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    if (couponApplied) {
      setCouponInput("MIXIN9");
    } else {
      setCouponInput("");
    }
  }, [couponApplied, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setStep("pay");
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const triggerConfetti = () => {
    const colors = ["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];
    const newConfetti = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20 - Math.random() * 50,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 12 + 6
    }));
    setConfetti(newConfetti);
  };

  const handleCopyPrice = () => {
    navigator.clipboard.writeText(price.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(price);

  const telegramText = encodeURIComponent(
    `Saya sudah membeli tools MIXIN9 mohon konfirmasi link nya. (Nama: ${buyerName || "User"}, Telegram: ${buyerTelegram || "@" + buyerTelegram})`
  );
  const telegramUrl = `https://t.me/effands?text=${telegramText}`;

  const handleVerifyPaymentSimulated = (e: React.FormEvent) => {
    e.preventDefault();
    triggerConfetti();
    setStep("success");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-fade-in">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/10 max-h-[90vh] flex flex-col animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-lg text-white">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Checkout Aman & Instan</h3>
              <p className="text-xs text-zinc-400">Lisensi Lifetime • Sekali beli aktif selamanya</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {step === "pay" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: QRIS Box */}
              <div className="flex flex-col items-center justify-between bg-zinc-950 p-5 rounded-xl border border-zinc-800 space-y-4">
                <div className="w-full text-center">
                  <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/30 rounded-full">
                    Scan via QRIS e-Wallet / Bank
                  </span>
                </div>
                
                {/* QRIS Code Image with pulse border */}
                <div className="relative group p-2 bg-white rounded-xl border-2 border-violet-500 shadow-lg shadow-violet-500/20 transition-all duration-300">
                  <img 
                    src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhut4hFJ1371v4Z-Xxd4_-ndcBaup55rpoiBgk066hJ-K1c5Lt9tgJIElFFdUL32KX7_2XRpZfgz8sAWNU8OEpr2dh_xYxkeL4I0ZQyTn76lBYAEdcfzp_WMQ9QkI8tYpagEqmJdGg9k8KzPMOBUgvqW_Ck9YR6RghxapNCkfcV7fUoAe_p3y_Ngg7BiWI/s735/photo_2026-06-16_07-23-26.jpg" 
                    alt="QRIS MIXIN9" 
                    className="w-48 h-48 md:w-56 md:h-56 object-cover rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 border border-white/20 rounded-lg pointer-events-none" />
                </div>

                {/* Amount Copy */}
                <div className="w-full bg-zinc-900 rounded-lg p-3 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-semibold">Nominal Transfer</p>
                    <p className="text-base font-bold text-emerald-400">{formattedPrice}</p>
                  </div>
                  <button 
                    onClick={handleCopyPrice}
                    className="p-2 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition flex items-center gap-1 text-xs"
                    title="Salin nominal transfer"
                  >
                    {copied ? (
                      <span className="text-emerald-400 text-[10px]">Tersalin!</span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Salin</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Warning Alert Banner */}
                <div className="w-full bg-red-950/40 border border-red-500/30 text-red-200 rounded-lg p-3 text-[10px] leading-relaxed">
                  <p className="font-bold flex items-center gap-1 text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" /> PENTING: TRANSFER HARUS SESUAI NOMINAL!
                  </p>
                  <p className="mt-1 font-semibold">
                    Harap transfer tepat senilai <span className="text-white bg-red-900/60 px-1 py-0.5 rounded font-mono font-bold text-[11px]">{formattedPrice}</span> (termasuk 3 digit terakhir). Jangan dibulatkan menjadi Rp 99.000 agar verifikasi pembayaran manual/otomatis Anda mudah dikenali oleh developer.
                  </p>
                </div>
              </div>

              {/* Right Column: Instructions & Confirmation Form */}
              <div className="space-y-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">Langkah Pembelian:</h4>
                  <ol className="space-y-3 text-xs text-zinc-300">
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-zinc-800 text-zinc-400 font-bold rounded-full">1</span>
                      <span>Scan QRIS di samping menggunakan GoPay, OVO, Dana, LinkAja, ShopeePay, atau m-Banking Anda.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-zinc-800 text-zinc-400 font-bold rounded-full">2</span>
                      <span>Kirim pembayaran <strong>WAJIB TEPAT PAS</strong> senilai <strong className="text-emerald-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 font-mono font-bold text-[11px]">{formattedPrice}</strong> (jangan dibulatkan).</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-zinc-800 text-zinc-400 font-bold rounded-full">3</span>
                      <span>Isi data konfirmasi di bawah ini, lalu klik tombol konfirmasi Telegram untuk mendapatkan file software dan kunci lisensi dari developer.</span>
                    </li>
                  </ol>
                </div>

                <form onSubmit={handleVerifyPaymentSimulated} className="space-y-4 border-t border-zinc-800 pt-4 mt-auto">
                  {/* Coupon section inside Checkout Modal */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">🎟️ Punya Kupon Diskon?</span>
                      {couponApplied && <span className="text-[9px] font-black text-emerald-400 font-mono animate-pulse">DISKON 50% AKTIF</span>}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Kode kupon (misal: MIXIN9)" 
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value);
                          setCouponError("");
                        }}
                        disabled={couponApplied}
                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono uppercase focus:outline-none focus:border-violet-500 disabled:opacity-60 disabled:text-emerald-400 placeholder-zinc-600"
                      />
                      {couponApplied ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCouponApplied(false);
                            setCouponInput("");
                          }}
                          className="px-2.5 py-1.5 bg-red-950/40 border border-red-900/30 text-red-400 text-[11px] font-bold rounded-lg hover:bg-red-900/30 transition cursor-pointer"
                        >
                          Batal
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const clean = couponInput.trim().toUpperCase();
                            if (clean === "MIXIN9" || clean === "LAUNCH50") {
                              setCouponApplied(true);
                              setCouponError("");
                            } else {
                              setCouponError("Kupon salah. Coba: MIXIN9");
                            }
                          }}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          Terapkan
                        </button>
                      )}
                    </div>
                    {couponError && <p className="text-[9px] text-rose-400 font-semibold">{couponError}</p>}
                    {couponApplied && <p className="text-[9px] text-emerald-400 font-semibold">✓ Kupon sukses! Harga diskon 50% aktif.</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-400 block">Nama Lengkap Anda</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Masukkan nama Anda..." 
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-400 block">Username Telegram Anda (Opsional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">@</span>
                      <input 
                        type="text" 
                        placeholder="username_kamu" 
                        value={buyerTelegram}
                        onChange={(e) => setBuyerTelegram(e.target.value.replace("@", ""))}
                        className="w-full pl-7 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 active:scale-[0.98]"
                    >
                      <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
                      Konfirmasi Pembayaran Instan (Selesai Transfer)
                    </button>
                    
                    <a 
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 border border-zinc-700/30 text-center"
                    >
                      <Send className="w-4 h-4 text-sky-400" />
                      Langsung Kirim Pesan Telegram
                    </a>
                  </div>
                </form>
              </div>

            </div>
          ) : (
            /* Success State */
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6 animate-fade-in relative">
              {/* Render confetti particles */}
              {confetti.map((particle) => (
                <div
                  key={particle.id}
                  className="absolute pointer-events-none rounded-full animate-fall"
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    backgroundColor: particle.color,
                    "--fall-delay": `${Math.random() * 2}s`,
                    "--fall-duration": `${Math.random() * 3 + 2}s`,
                  } as React.CSSProperties}
                />
              ))}

              <div className="p-4 bg-emerald-950/50 border border-emerald-500/30 rounded-full text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-2 max-w-md">
                <h4 className="text-xl font-bold text-white tracking-tight">Terima Kasih, Pembayaran Berhasil!</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Harap selesaikan langkah terakhir untuk mengunduh software <span className="text-violet-400 font-semibold">MIXIN9</span> dan mengaktifkan lisensi Anda.
                </p>
              </div>

              <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-left space-y-4">
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-cyan-400">
                    <Send className="w-3.5 h-3.5 text-cyan-400" />
                    Harap Konfirmasi ke Telegram @effands
                  </h5>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Klik tombol di bawah untuk langsung membuka profil Telegram pengembang dan mengirimkan pesan konfirmasi otomatis agar lisensi langsung dibuatkan.
                  </p>
                </div>

                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 break-all select-all flex items-start gap-2">
                  <div className="flex-1">
                    <span className="text-zinc-500">Pesan:</span> "Saya sudah membeli tools MIXIN9 mohon konfirmasi link nya."
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    <Send className="w-4 h-4 text-white" />
                    Buka Telegram & Kirim Pesan
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("Saya sudah membeli tools MIXIN9 mohon konfirmasi link nya.");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? "Tersalin!" : "Salin Pesan"}
                  </button>
                </div>

                <div className="text-center">
                  <a
                    href="https://t.me/effands"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-400 hover:underline inline-flex items-center gap-1"
                  >
                    Atau hubungi manual ke: t.me/effands
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Data Anda aman bersama pengembang ziqva.com
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure SSL Connection
          </span>
          <span className="hover:text-zinc-300 transition cursor-pointer flex items-center gap-0.5">
            Butuh Bantuan? <HelpCircle className="w-3 h-3 inline" />
          </span>
        </div>

      </div>
    </div>
  );
}
