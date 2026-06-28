export interface EQPreset {
  name: string;
  description: string;
  values: number[]; // 15 values for 15-band EQ (-12 to +12 dB)
}

export interface PainPoint {
  id: string;
  icon: string;
  title: string;
  description: string;
  badge: string;
}

export interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  tag: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  text: string;
  verified: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export const EQ_PRESETS: EQPreset[] = [
  {
    name: "Dangdut Koplo",
    description: "Bass mantap berdentum, vokal jernih, kendang gurih menonjol",
    values: [6, 8, 5, 2, -1, -3, -2, 0, 2, 4, 6, 8, 9, 7, 5]
  },
  {
    name: "Pop Sweet",
    description: "Vokal hangat dan instrumen akustik yang lembut berkilau",
    values: [2, 3, 2, 1, 0, 1, 2, 3, 2, 3, 4, 5, 4, 3, 2]
  },
  {
    name: "Rock Solid",
    description: "Gitar elektrik gahar, mid-range tebal, kick drum bertenaga",
    values: [5, 4, 3, 1, -1, -2, -1, 0, 2, 3, 4, 5, 4, 3, 4]
  },
  {
    name: "Acoustic Warmth",
    description: "Kehangatan kayu gitar akustik, vokal intim sedekat bisikan",
    values: [4, 5, 4, 2, 1, 0, 1, 1, 2, 2, 3, 3, 4, 3, 2]
  },
  {
    name: "Podcast / Voice Clear",
    description: "Pembersih vokal instan, hilangkan dengung low, dongkrak artikulasi",
    values: [-8, -6, -4, -2, 1, 3, 4, 5, 4, 3, 3, 4, 5, 4, 2]
  },
  {
    name: "Lo-Fi Chill",
    description: "Nuansa hangat retro, high-end dipotong lembut untuk vibe santai",
    values: [3, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -5, -4, -3]
  }
];

export const PAIN_POINTS: PainPoint[] = [
  {
    id: "pain-1",
    icon: "Clock",
    title: "Waktu Habis Sia-Sia di DAW",
    description: "Capek mixing file audio satu per satu di software berat? Butuh berjam-jam hanya untuk menyamakan karakter suara puluhan rekaman podcast atau voiceover Anda.",
    badge: "Bikin Stress"
  },
  {
    id: "pain-2",
    icon: "Sliders",
    title: "Volume Naik-Turun (Tidak Konsisten)",
    description: "Hasil rekaman Anda levelnya tidak rata. Kadang kekecilan, kadang pecah (clipping). Pendengar terpaksa menaikkan dan menurunkan volume HP mereka secara manual.",
    badge: "Merusak Mood"
  },
  {
    id: "pain-3",
    icon: "AlertTriangle",
    title: "Ditolak Platform / Terdengar Pelan",
    description: "Audio Anda terdengar loyo saat diunggah ke Spotify atau YouTube karena tidak memenuhi standar Loudness industri global yang mewajibkan target mutlak -14 LUFS.",
    badge: "Tidak Profesional"
  },
  {
    id: "pain-4",
    icon: "CreditCard",
    title: "Terjebak Biaya Langganan Bulanan",
    description: "Software mixing audio modern di luar sana memaksa Anda membayar sistem sewa bulanan yang mahal. Begitu berhenti langganan, software Anda langsung tidak bisa dipakai.",
    badge: "Rugi Bandar"
  }
];

export const FEATURES: Feature[] = [
  {
    id: "feat-1",
    icon: "Zap",
    title: "Batch Processing Kilat",
    description: "Tarik ratusan file audio sekaligus, klik satu tombol, dan biarkan MIXIN9 memproses semuanya dalam hitungan detik. Menghemat 90% waktu kerja Anda.",
    tag: "Paling Populer"
  },
  {
    id: "feat-2",
    icon: "Activity",
    title: "15-Band Graphic Equalizer",
    description: "Kontrol frekuensi audio super presisi. Mulai dari sub-bass terdalam hingga air-treble yang berkilau, semua bisa diatur dengan presisi tinggi dan sangat responsif.",
    tag: "Pro Level"
  },
  {
    id: "feat-3",
    icon: "Sparkles",
    title: "Auto-Genre EQ Presets",
    description: "Dilengkapi ratusan preset bawaan siap pakai (Dangdut Koplo, Pop Sweet, Rock, Podcast, dll). Klik preset favorit Anda, dan slider EQ akan bergeser otomatis dengan transisi mulus.",
    tag: "Pintar"
  },
  {
    id: "feat-4",
    icon: "BarChart3",
    title: "Real-Time Spectrum Analyzer",
    description: "Gaya visualizer FFT yang informatif. Pantau Source Peak, Master Peak, korelasi Phase, serta level Loudness secara visual untuk mencegah distorsi dan ketidakseimbangan frekuensi.",
    tag: "Akurat"
  },
  {
    id: "feat-5",
    icon: "Award",
    title: "Standar Industri Otomatis",
    description: "Algoritma cerdas MIXIN9 akan mengalkulasi dan memproses audio Anda agar tepat berada pada target -14 LUFS (standar Spotify, Apple Music, dan YouTube) tanpa merusak dinamika suara.",
    tag: "Efisien"
  },
  {
    id: "feat-6",
    icon: "Gauge",
    title: "Pitch & Speed Control",
    description: "Ubah nada (pitch) atau kecepatan (tempo) audio Anda secara real-time saat ekspor. Sangat cocok untuk pembuatan konten variatif, DJ, maupun remix kilat.",
    tag: "Kreatif"
  },
  {
    id: "feat-7",
    icon: "Cpu",
    title: "Dukungan VST Plugin Eksternal",
    description: "Integrasikan VST/VST3 favorit Anda dari pihak ketiga langsung di dalam alur kerja batch. Dapatkan sentuhan analog hangat atau modulasi modern secara instan.",
    tag: "Tanpa Batas"
  },
  {
    id: "feat-8",
    icon: "Download",
    title: "Export Fleksibel & Auto ZIP",
    description: "Simpan hasil mixing langsung ke format MP3, WAV, FLAC, OGG, M4A dengan kualitas bitrate tinggi. Nikmati juga fitur kemas otomatis dalam satu file ZIP yang rapi.",
    tag: "Praktis"
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "test-1",
    name: "Rian Pramana",
    role: "Youtuber & Podcaster (150k+ Subs)",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    rating: 5,
    text: "Gila! Biasanya saya butuh 2 jam buat mixing 10 episode podcast mingguan. Pakai MIXIN9, tinggal apply preset 'Podcast Clear', masukin semua file, klik export, beres dalam 2 menit! Penyelamat hidup saya.",
    verified: true
  },
  {
    id: "test-2",
    name: "Yogi Prasetyo",
    role: "Studio Producer (Koplo Specialist)",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    rating: 5,
    text: "Preset 'Dangdut Koplo' bawaannya gurih bertenaga! Bass gembrotnya kerasa tapi tetep bulet, kendangnya renyah di telinga. Kemudahan VST routingnya bikin saya bisa pasang compressor luar favorit saya dengan gampang.",
    verified: true
  },
  {
    id: "test-3",
    name: "Siti Rahma",
    role: "Freelance Audio Editor on Fiverr",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    rating: 5,
    text: "Fitur auto target -14 LUFS ini ngebantu banget biar orderan klien langsung keterima Spotify tanpa direject. Kerja batch-nya juga stabil, ratusan gigabyte file audio kelar tanpa crash sama sekali.",
    verified: true
  }
];

export const FAQS: FAQItem[] = [
  {
    question: "Apakah software MIXIN9 ini sekali beli atau langganan?",
    answer: "Sistem lisensi MIXIN9 adalah SEKALI BELI (Lifetime License). Anda cukup membayar satu kali di awal, dan Anda berhak mendapatkan semua update fitur masa depan secara GRATIS selamanya tanpa biaya bulanan atau tahunan tersembunyi!"
  },
  {
    question: "Bagaimana cara konfirmasi setelah saya membayar via QRIS?",
    answer: "Setelah Anda memindai QRIS dan melakukan transfer sebesar Rp 99.000, silakan ambil tangkapan layar (screenshot) bukti bayar. Klik tombol 'Konfirmasi via Telegram' di website ini untuk otomatis terhubung dengan pengembang @effands di Telegram dengan pesan konfirmasi yang sudah disiapkan."
  },
  {
    question: "Apakah saya bisa memasukkan VST plugin eksternal buatan saya sendiri?",
    answer: "Ya, tentu saja! MIXIN9 mendukung penuh integrasi VST dan VST3 64-bit eksternal. Anda bisa memuat plugin andalan seperti FabFilter, Waves, iZotope, dll, untuk dikombinasikan dengan alur kerja pemrosesan batch yang cepat."
  },
  {
    question: "Format audio apa saja yang didukung oleh MIXIN9?",
    answer: "Untuk import dan export, MIXIN9 mendukung hampir semua format audio standar industri, termasuk WAV (16/24/32-bit), MP3 (hingga 320kbps), FLAC, OGG, M4A, dan AAC. Anda juga dapat memilih opsi kompresi file ZIP otomatis setelah selesai ekspor."
  },
  {
    question: "Apakah pemula bisa menggunakannya tanpa dasar audio engineering?",
    answer: "Sangat bisa! Antarmuka MIXIN9 dirancang se-intuitif mungkin. Anda cukup drag-and-drop file Anda, memilih salah satu dari ratusan preset cerdas bawaan seperti 'Pop Sweet' atau 'Voice Clear', lalu menekan tombol Export. Tidak perlu paham frekuensi rumit, sistem otomatis menyesuaikan semuanya."
  },
  {
    question: "Apakah software ini memerlukan spesifikasi komputer yang tinggi?",
    answer: "Tidak. MIXIN9 dioptimalkan dengan bahasa pemrograman native yang ringan di CPU dan RAM. Bisa berjalan lancar di PC Windows 10/11 maupun macOS (termasuk chip Intel dan Apple Silicon M1/M2/M3) dengan RAM minimal 4GB."
  }
];

export const COPYWRITING_STRUCTURE = {
  headline: {
    title: "Pangkas Waktu Mixing Hingga 90%. Hasil Pro dalam Sekali Klik!",
    subtitle: "MIXIN9: All In Batch Audio Mixing"
  },
  subHeadline: {
    text: "Satu-satunya software batch audio mixing desktop yang menghemat waktu Anda untuk merilis podcast, voiceover, lagu, dan konten harian. Dapatkan kualitas audio standar industri (-14 LUFS) secara instan!"
  },
  painPoints: {
    heading: "Masalah Klasik Kreator & Audio Engineer",
    text: "Apakah Anda juga sering mengalami rasa frustrasi berikut ini saat memproses audio?",
    items: PAIN_POINTS
  },
  solution: {
    heading: "Kenalkan MIXIN9: Solusi Batch Mixing Tercepat & Tercerdas",
    text: "Kami merancang MIXIN9 khusus untuk memangkas jam kerja Anda yang membosankan di DAW tradisional menjadi hitungan detik. Dengan antarmuka modern yang futuristik, performa real-time berlatensi ultra-rendah, serta jaminan sekali beli aktif selamanya.",
    benefits: [
      "Pemrosesan Batch 100x Lebih Cepat dibanding DAW biasa.",
      "Algoritma penyelarasan volume instan tanpa distorsi.",
      "Siap rilis ke Spotify & YouTube dengan standar -14 LUFS global.",
      "Beli sekali, miliki selamanya, gratis update tanpa sewa bulanan."
    ]
  },
  features: {
    heading: "Fitur Monster untuk Alur Kerja Profesional Anda",
    text: "MIXIN9 memadukan kemudahan penggunaan bagi pemula dengan kedalaman kontrol yang didambakan oleh profesional senior.",
    items: FEATURES
  },
  testimonials: {
    heading: "Apa Kata Mereka yang Sudah Menghemat Jam Kerja?",
    text: "Ratusan audio creator, podcaster, dan produser musik telah mempercayakan alur kerja audio mereka pada MIXIN9.",
    items: TESTIMONIALS
  },
  priceSection: {
    heading: "Miliki MIXIN9 Hari Ini Dengan Diskon Gila 50%!",
    subheading: "Investasi Sekali Seumur Hidup Untuk Produktivitas Tanpa Batas",
    normalPrice: 199000,
    promoPrice: 99000,
    scarcityText: "Khusus Hari Ini: Hanya tersisa 3 slot pembeli pertama untuk mendapatkan potongan harga setengahnya! Begitu slot penuh, harga akan otomatis kembali menjadi Rp 199.000 selamanya.",
    urgencyText: "Penawaran promo spesial ini akan ditutup dalam waktu:"
  },
  faq: {
    heading: "Pertanyaan yang Sering Diajukan (FAQ)",
    text: "Butuh info lebih lanjut? Temukan jawaban lengkap seputar lisensi, fitur, dan penggunaan MIXIN9 di bawah ini.",
    items: FAQS
  }
};
