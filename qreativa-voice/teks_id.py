"""Normalisasi teks bahasa Indonesia sebelum dibacakan TTS.

Mengubah angka, rupiah, persen, jam, tanggal, dan singkatan umum menjadi
kata-kata supaya pengucapannya natural (bukan dibaca digit per digit).
"""
import re

_SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh",
           "delapan", "sembilan", "sepuluh", "sebelas"]

_BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
          "Agustus", "September", "Oktober", "November", "Desember"]


def terbilang(n: int) -> str:
    """1250000 -> 'satu juta dua ratus lima puluh ribu'."""
    if n < 0:
        return "minus " + terbilang(-n)
    if n == 0:
        return "nol"
    if n < 12:
        return _SATUAN[n]
    if n < 20:
        return _SATUAN[n - 10] + " belas"
    if n < 100:
        sisa = n % 10
        return _SATUAN[n // 10] + " puluh" + (" " + _SATUAN[sisa] if sisa else "")
    if n < 200:
        return "seratus" + (" " + terbilang(n - 100) if n > 100 else "")
    if n < 1000:
        sisa = n % 100
        return _SATUAN[n // 100] + " ratus" + (" " + terbilang(sisa) if sisa else "")
    if n < 2000:
        return "seribu" + (" " + terbilang(n - 1000) if n > 1000 else "")
    for nilai, nama in ((10**12, "triliun"), (10**9, "miliar"),
                        (10**6, "juta"), (10**3, "ribu")):
        if n >= nilai:
            depan, sisa = divmod(n, nilai)
            return terbilang(depan) + " " + nama + (" " + terbilang(sisa) if sisa else "")
    return str(n)


def _digit_per_digit(s: str) -> str:
    return " ".join("nol" if c == "0" else _SATUAN[int(c)] for c in s if c.isdigit())


def _angka(s: str) -> str:
    """'1.250.000' / '2,5' / '08123' -> kata."""
    s = s.strip()
    if re.fullmatch(r"0\d{3,}", s):            # nomor HP / kode: baca per digit
        return _digit_per_digit(s)
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", s):  # pemisah ribuan gaya Indonesia
        s = s.replace(".", "")
    if "," in s:                                # desimal: 2,5 -> dua koma lima
        bulat, pecahan = s.split(",", 1)
        bulat = bulat.replace(".", "") or "0"
        return terbilang(int(bulat)) + " koma " + _digit_per_digit(pecahan)
    s = s.replace(".", "")
    return terbilang(int(s)) if s.isdigit() else s


# Singkatan umum dalam tulisan sehari-hari / caption / naskah iklan
_SINGKATAN = {
    "yg": "yang", "dgn": "dengan", "dg": "dengan", "utk": "untuk", "tdk": "tidak",
    "gak": "nggak", "krn": "karena", "karna": "karena", "sdh": "sudah",
    "blm": "belum", "jg": "juga", "dll": "dan lain-lain", "dsb": "dan sebagainya",
    "dst": "dan seterusnya", "tsb": "tersebut", "spt": "seperti", "sbg": "sebagai",
    "bpk": "bapak", "ibu2": "ibu-ibu", "kak": "kak", "min": "min",
    "wa": "WhatsApp", "ig": "Instagram", "jl": "jalan", "jln": "jalan",
    "no": "nomor", "tlp": "telepon", "telp": "telepon", "hp": "HP",
    "kg": "kilogram", "km": "kilometer", "cm": "sentimeter", "gr": "gram",
    "pcs": "pieces", "org": "orang", "pax": "pax", "hr": "hari", "mlm": "malam",
    "wib": "WIB", "sd": "sampai", "s/d": "sampai dengan",
    "tgl": "tanggal", "bln": "bulan", "thn": "tahun", "lbh": "lebih",
    "kpd": "kepada", "pd": "pada", "bs": "bisa", "bgt": "banget",
}


def normalisasi(teks: str) -> str:
    t = teks

    # Rp 1.500.000 / Rp1,5 juta / 1,5jt
    t = re.sub(r"[Rr]p\.?\s?([\d.,]+)\s?(rb|ribu|jt|juta|m|miliar)?\b",
               lambda m: _angka(m.group(1)) + " " +
               ({"rb": "ribu", "jt": "juta", "m": "miliar"}.get((m.group(2) or "").lower(),
                                                                m.group(2) or "") + " rupiah").strip(),
               t)
    t = re.sub(r"\b([\d.,]+)\s?(rb|jt)\b",
               lambda m: _angka(m.group(1)) + (" ribu" if m.group(2) == "rb" else " juta"), t)

    # Satuan "per": /org, /pax, /malam
    t = re.sub(r"/\s?(org|orang|pax|pcs|malam|mlm|hari|hr|bulan|bln|kg)\b",
               lambda m: " per " + _SINGKATAN.get(m.group(1).lower(), m.group(1)), t)

    # Persen
    t = re.sub(r"([\d.,]+)\s?%", lambda m: _angka(m.group(1)) + " persen", t)

    # Jam 08.30 / 14:00
    def _jam(m):
        h, mnt = int(m.group(1)), int(m.group(2))
        return "pukul " + terbilang(h) + ("" if mnt == 0 else " lewat " + terbilang(mnt) + " menit")
    t = re.sub(r"\b(?:[Jj]am|[Pp]ukul)\s+(\d{1,2})[.:](\d{2})\b", _jam, t)
    t = re.sub(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", _jam, t)

    # Tanggal 17/08/2026 atau 17-08-2026
    def _tgl(m):
        d, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if not (1 <= b <= 12):
            return m.group(0)
        return f"{terbilang(d)} {_BULAN[b]} {terbilang(y)}"
    t = re.sub(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", _tgl, t)

    # Ke-2, ke 3 -> kedua, ketiga
    t = re.sub(r"\b[Kk]e-?\s?(\d+)\b",
               lambda m: "pertama" if m.group(1) == "1" else "ke" + terbilang(int(m.group(1))), t)

    # Kata ulang angka: anak2 -> anak-anak
    t = re.sub(r"\b([A-Za-z]{2,})2\b", r"\1-\1", t)

    # Singkatan (case-insensitive, utuh per kata)
    def _singk(m):
        kata = m.group(0)
        return _SINGKATAN.get(kata.lower(), kata)
    t = re.sub(r"(?<![\w/])[A-Za-z/]+\d?(?![\w/])", _singk, t)

    # Sisa angka
    t = re.sub(r"\d[\d.,]*\d|\d", lambda m: _angka(m.group(0)), t)

    # Rapikan spasi
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" +([,.!?])", r"\1", t)
    return t.strip()


if __name__ == "__main__":
    contoh = [
        "Harga paket tour Rp 1.250.000/org, DP 30% ya kak.",
        "Berangkat tgl 17/08/2026 jam 05.30 WIB dari Purwokerto.",
        "Hubungi WA 081234567890 utk info lbh lanjut.",
        "Diskon 2,5jt khusus pemesan ke-3, anak2 gratis.",
        "Tahun 2026 ada 150 peserta, dll.",
    ]
    for c in contoh:
        print(c, "\n  ->", normalisasi(c))
