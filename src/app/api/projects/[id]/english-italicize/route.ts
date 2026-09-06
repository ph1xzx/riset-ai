import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject } from "@/lib/api";
import { nowIso } from "@/lib/util";

const COMMON_ID = new Set([
  "yang","dan","atau","dalam","pada","dari","untuk","dengan","tidak","juga","ini","itu","ada","sudah","akan","bisa","jika","karena","sebagai","terhadap","antara","kepada","oleh","saat","setelah","sebelum","sebagai","antara","menurut","serta","yaitu","yakni","adalah","terdapat","dapat","perlu","agar","supaya","bahwa","hanya","lebih","paling","banyak","sedikit","suatu","semua","beberapa","masing","tiap","setiap","kita","mereka","penelitian","metode","data","sistem","digunakan","menggunakan","dilakukan","melakukan","berdasarkan","misalnya","contoh","seperti","karenanya","olehnya","demikian","selain","melalui","tanpa","hingga","sampai","mulai","awal","akhir","bagian","halaman","bab","sub","kriteria","alternatif","pengadaan","barang","jasa","prioritas","pengambilan","keputusan","berbasis","web","aplikasi","perangkat","lunak","keras","pengujian","hasil","analisis","analisa","perancangan","implementasi","kesimpulan","saran","tujuan","manfaat","rumusan","identifikasi","batasan","metodologi","landasan","teori","pendahuluan","penutup","abstrak","kata","pengantar","daftar","isi","gambar","tabel","lampiran","pustaka","penulis","peneliti","dosen","pembimbing","universitas","fakultas","prodi","studi","program","tahun","bulan","hari","tanggal","alamat","no","nomor","nama","judul","judul","isi","teks","huruf","angka","nilai","skala","skor","bobot","rata","selisih","perhitungan","matriks","indeks","preferensi","net","flow","leaving","entering","pasangan","alternatif","kriteria","arah","benefit","cost","maksimasi","minimasi","normalisasi","persentase","desimal","desimal",
]);

/**
 * Italicize standalone English words/phrases in the Indonesian text (campus
 * convention: istilah asing dicetak miring). Conservative: only words not in
 * the common Indonesian list and made of a-z, optionally with spaces (2-4
 * words of ASCII).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* no body */
  }
  const term: string = (body.term || "").trim();
  const fn = term ? (html: string) => italicizeTerm(html, term) : (html: string) => italicizeEnglish(html);

  const sections = db.prepare("SELECT * FROM sections WHERE project_id = ? AND content != ''").all(id) as any[];
  let changed = 0;
  for (const s of sections) {
    const after = fn(s.content);
    if (after !== s.content) {
      db.prepare("UPDATE sections SET content = ?, updated_at = ? WHERE id = ?").run(after, nowIso(), s.id);
      changed++;
    }
  }
  return NextResponse.json({ sectionsChanged: changed, term: term || null });
}

/** Italicize every text-node occurrence of the user-supplied term (may be a
 *  multi-word phrase). Skips text inside tags and already-italicized spans. */
function italicizeTerm(html: string, term: string): string {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // (?![^<]*>)  -> we are not inside an HTML tag (no ">" before the next "<")
  // (?<!<em>)   -> not already inside an <em> (idempotent re-runs)
  const re = new RegExp(`(?![^<]*>)(?<!<em>)(?<![A-Za-z0-9])(${esc})(?![A-Za-z0-9])`, "gi");
  return html.replace(re, (_m, t: string) => `<em>${t}</em>`);
}

/** Fallback (no term given): italicize standalone ASCII words of 3+ letters
 *  that are not in the common-Indonesian list and are not all-caps acronyms.
 *  Single words only — phrase-level guessing italicizes Indonesian by mistake.
 */
function italicizeEnglish(html: string): string {
  return html.replace(
    />([^<>]*[A-Za-z][^<>]*)</g,
    (match, text: string) => {
      const out = text.replace(/\b([A-Za-z]{3,})\b/g, (word: string) => {
        const w = word.toLowerCase();
        if (COMMON_ID.has(w)) return word;
        // skip all-caps acronyms (keep them)
        if (word === word.toUpperCase() && word.length <= 6) return word;
        return `<em>${word}</em>`;
      });
      return `>${out}<`;
    }
  );
}
