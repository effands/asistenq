import React, { useState } from "react";
import { Sliders, FileText, Sparkles, Menu, X } from "lucide-react";

interface HeaderProps {
  onOpenCheckout: () => void;
}

export default function Header({ onOpenCheckout }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Masalah", href: "#pain-points" },
    { name: "Solusi", href: "#solution" },
    { name: "Desain Antarmuka", href: "#mixer-playground-section" },
    { name: "Fitur", href: "#features" },
    { name: "Testimoni", href: "#testimonials" },
    { name: "Harga", href: "#pricing" },
    { name: "FAQ", href: "#faq" }
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0d1330]/80 backdrop-blur-md border-b border-cyan-500/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-lg text-white shadow-lg shadow-violet-600/25 group-hover:scale-105 transition">
            <Sliders className="w-5 h-5 rotate-90" />
          </div>
          <span className="text-xl font-black text-white tracking-wider font-sans group-hover:text-cyan-400 transition">
            MIXIN<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-cyan-400">9</span>
          </span>
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleLinkClick(e, link.href)}
              className="text-xs font-semibold text-zinc-400 hover:text-white transition tracking-wide"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            onClick={onOpenCheckout}
            className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-95 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span>Beli Sekarang</span>
          </button>
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-[#0d1330]/95 backdrop-blur-lg border-b border-cyan-500/25 p-5 space-y-4 animate-fade-in">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                className="text-sm font-semibold text-zinc-400 hover:text-white py-1.5 border-b border-zinc-900/40 transition"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                onOpenCheckout();
                setMobileMenuOpen(false);
              }}
              className="w-full py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>Ambil Promo Spesial Sekarang</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
