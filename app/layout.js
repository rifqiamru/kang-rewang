export const metadata = {
  title: "Kang Rewang — Jasa Asisten Personal Purwokerto",
  description: "Melayani jasa apapun area Purwokerto & sekitarnya. Antar-jemput, belanja, titip antrian, bantu pindahan, temenin acara. Rewang Apa Wae, Ora Rewel!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
