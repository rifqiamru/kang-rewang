"use client";

import { useState, useEffect, useRef } from "react";

const GREEN = "#1B6B3A";
const GOLD = "#F5A623";
const CREAM = "#FFF8EC";
const DARK = "#1a1a18";

const services = [
  {
    icon: "🛵",
    title: "Transportasi Lokal",
    subtitle: "Ojek & jasa supir",
    items: [
      { label: "0–3 km", price: "Rp10.000" },
      { label: "3–6 km", price: "Rp15.000" },
      { label: "6–10 km", price: "Rp20.000" },
      { label: ">10 km", price: "+Rp2.000/km" },
      { label: "Supir dalam kota", price: "Rp60.000" },
      { label: "Supir luar kota", price: "Rp110.000" },
    ],
  },
  {
    icon: "🛍️",
    title: "Belanja & Titip Antrian",
    subtitle: "Pasar, supermarket, puskesmas, samsat",
    items: [
      { label: "Belanja 0–5 km", price: "Rp10.000" },
      { label: "Belanja 5–10 km", price: "Rp15.000" },
      { label: ">10 barang", price: "+Rp10.000" },
      { label: "Titip antrian puskesmas", price: "Rp20.000" },
      { label: "Titip antrian samsat", price: "Rp25.000" },
      { label: "Antri >2 jam", price: "+Rp10.000" },
    ],
  },
  {
    icon: "📦",
    title: "Antar/Ambil Barang",
    subtitle: "Barang & dokumen segala ukuran",
    items: [
      { label: "Kecil (0–5 km)", price: "Rp10.000" },
      { label: "Kecil (5–10 km)", price: "Rp15.000" },
      { label: "Sedang (0–5 km)", price: "Rp15.000" },
      { label: "Sedang (5–10 km)", price: "Rp20.000" },
      { label: "Besar (0–5 km)", price: "Rp20.000" },
      { label: "Besar (5–10 km)", price: "Rp25.000" },
    ],
  },
  {
    icon: "🤝",
    title: "Pendamping & Temenin",
    subtitle: "Acara, kondangan, lansia, orang sakit",
    items: [
      { label: "Pendamping lansia/jam", price: "Rp15.000" },
      { label: "Pendamping lansia/hari", price: "Rp100.000" },
      { label: "Temenin acara 1–3 jam", price: "Rp25.000" },
      { label: "Temenin acara seharian", price: "Rp60.000" },
    ],
  },
];

const reasons = [
  { icon: "💬", title: "Respon Cepat", desc: "Chat langsung dibalas, ga dibiarkan pending berlama-lama." },
  { icon: "🕐", title: "Tepat Waktu", desc: "Amanah soal waktu — kalau bilang jam 8, ya jam 8." },
  { icon: "🤲", title: "Jujur & Amanah", desc: "Harga transparan dari awal, ora nggetok, ora nipu." },
  { icon: "😊", title: "Ramah & Ora Rewel", desc: "Gelem bantu apa wae selagi masuk akal dan halal." },
  { icon: "📍", title: "Lokal Purwokerto", desc: "Paham jalanan, paham situasi, paham kebutuhan warga lokal." },
  { icon: "💰", title: "Harga Masuk Akal", desc: "Wajar, bisa nego santai, tidak ada biaya tersembunyi." },
];

const steps = [
  { num: "01", title: "Chat WA / DM IG", desc: "Hubungi @kangrewang dan ceritakan kebutuhanmu." },
  { num: "02", title: "Sepakati detail", desc: "Konfirmasi waktu, lokasi, dan harga bersama." },
  { num: "03", title: "Kang Rewang berangkat", desc: "Tugas dikerjakan dengan amanah dan tepat waktu." },
  { num: "04", title: "Beres, bayar, happy", desc: "Bayar sesuai kesepakatan. Puas? Boleh kasih bintang 5 😄" },
];

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function FadeIn({ children, delay = 0, className = "" }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function KangRewang() {
  const [activeService, setActiveService] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const waLink = "https://wa.me/6281292923132?text=Halo%20Kang%20Rewang%2C%20saya%20mau%20pesan%20jasa...";

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: DARK, color: "#fff", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(27,107,58,0.97)", backdropFilter: "blur(12px)",
        borderBottom: `2px solid ${GOLD}`,
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="Kang Rewang" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Kang Rewang</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["layanan", "kenapa", "cara-pesan", "kontak"].map((id) => (
            <button key={id} onClick={() => scrollTo(id)} style={{
              background: "transparent", border: "none", color: "rgba(255,255,255,0.8)",
              fontSize: 13, cursor: "pointer", padding: "6px 10px", borderRadius: 6,
              textTransform: "capitalize",
            }}>
              {id === "cara-pesan" ? "Cara Pesan" : id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
          <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
            background: GOLD, color: "#412402", fontWeight: 600, fontSize: 13,
            padding: "6px 16px", borderRadius: 20, textDecoration: "none",
          }}>Hubungi ↗</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(160deg, #0d3d20 0%, ${GREEN} 60%, #0f4a28 100%)`,
        position: "relative", overflow: "hidden", paddingTop: 60,
      }}>
        {[
          { size: 400, x: "-10%", y: "-20%", op: 0.06 },
          { size: 300, x: "70%", y: "60%", op: 0.05 },
          { size: 200, x: "85%", y: "5%", op: 0.08 },
        ].map((c, i) => (
          <div key={i} style={{
            position: "absolute", width: c.size, height: c.size,
            borderRadius: "50%", border: `2px solid ${GOLD}`,
            left: c.x, top: c.y, opacity: c.op, pointerEvents: "none",
          }} />
        ))}

        <div style={{ textAlign: "center", padding: "40px 24px", maxWidth: 700, position: "relative", zIndex: 1 }}>
          <img src="/logo.png" alt="Kang Rewang Logo" style={{
            width: 120, height: 120, borderRadius: "50%", objectFit: "cover",
            border: `4px solid ${GOLD}`, marginBottom: 24,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }} />

          <div style={{
            display: "inline-block", background: GOLD, color: "#412402",
            fontSize: 12, fontWeight: 600, padding: "5px 16px", borderRadius: 20, marginBottom: 16,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Purwokerto & Sekitarnya
          </div>

          <h1 style={{
            fontSize: "clamp(42px, 10vw, 80px)", fontWeight: 800, lineHeight: 1.05,
            margin: "0 0 16px", color: "#fff",
            textShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}>
            Kang<br />
            <span style={{ color: GOLD }}>Rewang</span>
          </h1>

          <p style={{ fontSize: "clamp(16px, 3vw, 22px)", color: "rgba(255,255,255,0.85)", margin: "0 0 12px", fontStyle: "italic" }}>
            "Rewang Apa Wae, Ora Rewel"
          </p>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", margin: "0 0 40px" }}>
            Jasa asisten personal lokal — antar-jemput, belanja, titip antrian,<br />bantu pindahan, temenin acara, dan masih banyak lagi.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
              background: GOLD, color: "#412402", fontWeight: 700, fontSize: 15,
              padding: "14px 32px", borderRadius: 50, textDecoration: "none",
              transition: "transform 0.2s",
            }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
            >
              Pesan Sekarang via WA ↗
            </a>
            <button onClick={() => scrollTo("layanan")} style={{
              background: "transparent", color: "#fff", fontWeight: 600, fontSize: 15,
              padding: "14px 32px", borderRadius: 50, border: "2px solid rgba(255,255,255,0.4)",
              cursor: "pointer", transition: "border-color 0.2s",
            }}
              onMouseOver={e => e.currentTarget.style.borderColor = GOLD}
              onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"}
            >
              Lihat Layanan
            </button>
          </div>
        </div>

        <div style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.5,
        }}>
          <span style={{ fontSize: 11, color: "#fff", letterSpacing: "0.1em" }}>SCROLL</span>
          <div style={{ width: 1, height: 40, background: "#fff", animation: "pulse 2s infinite" }} />
        </div>
      </section>

      {/* LAYANAN */}
      <section id="layanan" style={{ padding: "80px 24px", background: CREAM }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: GREEN, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Daftar Layanan & Pricelist
              </span>
              <h2 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: DARK, margin: "8px 0 12px" }}>
                Gelem Rewang Apa Wae
              </h2>
              <p style={{ fontSize: 15, color: "#666", maxWidth: 480, margin: "0 auto" }}>
                Harga transparan, ora nggetok. Bisa menyesuaikan jika jarak jauh, hujan, atau tengah malam.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div style={{ display: "flex", gap: 8, marginBottom: 32, overflowX: "auto", paddingBottom: 4, flexWrap: "wrap" }}>
              {services.map((s, i) => (
                <button key={i} onClick={() => setActiveService(i)} style={{
                  padding: "10px 20px", borderRadius: 50, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
                  background: activeService === i ? GREEN : "#fff",
                  color: activeService === i ? "#fff" : DARK,
                  border: `2px solid ${activeService === i ? GREEN : "#ddd"}`,
                }}>
                  {s.icon} {s.title}
                </button>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: `2px solid ${GREEN}` }}>
              <div style={{ background: GREEN, padding: "20px 28px" }}>
                <div style={{ fontSize: 28 }}>{services[activeService].icon}</div>
                <h3 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 700, color: "#fff" }}>
                  {services[activeService].title}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  {services[activeService].subtitle}
                </p>
              </div>
              <div style={{ padding: "24px 28px" }}>
                {services[activeService].items.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 0",
                    borderBottom: i < services[activeService].items.length - 1 ? "1px solid #f0f0f0" : "none",
                  }}>
                    <span style={{ fontSize: 14, color: "#444" }}>{item.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: GREEN }}>{item.price}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#FFF8EC", padding: "14px 28px", borderTop: `1px solid ${GOLD}30` }}>
                <p style={{ margin: 0, fontSize: 12, color: "#854F0B" }}>
                  ⚡ Tarif bisa menyesuaikan jika jarak sangat jauh, hujan deras, atau tengah malam (22.00–05.00). Harga tetap wajar & transparan!
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* KENAPA KANG REWANG */}
      <section id="kenapa" style={{ padding: "80px 24px", background: DARK }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Kenapa Pilih Kang Rewang?
              </span>
              <h2 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "#fff", margin: "8px 0 0" }}>
                Bukan Sekadar Jasa,<br />
                <span style={{ color: GOLD }}>Kanca Andalan</span>
              </h2>
            </div>
          </FadeIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {reasons.map((r, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.08)", padding: "24px",
                  transition: "border-color 0.2s, transform 0.2s",
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.transform = "translateY(-4px)"; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{r.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>{r.title}</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{r.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CARA PESAN */}
      <section id="cara-pesan" style={{ padding: "80px 24px", background: GREEN }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Cara Pesan
              </span>
              <h2 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "#fff", margin: "8px 0 0" }}>
                Gampang Banget, Cuma 4 Langkah
              </h2>
            </div>
          </FadeIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div style={{ textAlign: "center", padding: "24px 16px" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: GOLD, color: "#412402",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 18, margin: "0 auto 16px",
                  }}>{s.num}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.4}>
            <div style={{ textAlign: "center", marginTop: 48 }}>
              <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
                display: "inline-block", background: GOLD, color: "#412402",
                fontWeight: 700, fontSize: 16, padding: "16px 40px",
                borderRadius: 50, textDecoration: "none", transition: "transform 0.2s",
              }}
                onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
              >
                Chat Kang Rewang Sekarang ↗
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="kontak" style={{ background: "#0d1f14", padding: "60px 24px 40px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <img src="/logo.png" alt="Kang Rewang" style={{
            width: 80, height: 80, borderRadius: "50%", objectFit: "cover",
            border: `3px solid ${GOLD}`, margin: "0 auto 20px", display: "block",
          }} />

          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Kang Rewang</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 32px", fontStyle: "italic" }}>
            "Rewang Apa Wae, Ora Rewel"
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
            {[
              { label: "WhatsApp", handle: "@kangrewang", href: waLink },
              { label: "Instagram", handle: "@kangrewang", href: "https://instagram.com/kangrewang" },
            ].map((c, i) => (
              <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "14px 24px", textDecoration: "none",
                transition: "border-color 0.2s",
              }}
                onMouseOver={e => e.currentTarget.style.borderColor = GOLD}
                onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
              >
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.label}</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: GOLD }}>{c.handle}</p>
              </a>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
              © 2025 Kang Rewang · Purwokerto, Jawa Tengah · Harga wajar, transparan, ora nggetok!
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
