export type ResearchRecommendation = {
  title: string;
  method: string;
  reason: string;
  nextStep: string;
};

type RecommendationInput = {
  topic: string;
  field?: string;
  object?: string;
  caseStudy?: string;
  problem?: string;
};

/**
 * Rekomendasi awal berbasis sinyal dari brief pengguna.
 * Ini membantu memilih titik mulai, bukan menggantikan keputusan metodologis.
 */
export function getResearchRecommendations(input: RecommendationInput): ResearchRecommendation[] {
  const text = [input.topic, input.field, input.object, input.caseStudy, input.problem]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const recommendations: ResearchRecommendation[] = [];

  if (/keputusan|spk|pemilihan|ranking|prioritas|kriteria|alternatif/.test(text)) {
    recommendations.push({
      title: "Bandingkan alternatif dengan kriteria yang jelas",
      method: "TOPSIS",
      reason: "Cocok untuk masalah pemilihan atau perangkingan dengan banyak kriteria.",
      nextStep: "Siapkan alternatif, kriteria, bobot, dan sumber data penilaian.",
    });
  }

  if (/prediksi|klasifikasi|akurasi|cnn|machine learning|deep learning|deteksi|model/.test(text)) {
    recommendations.push({
      title: "Uji model dengan data dan metrik yang terukur",
      method: "Experimental",
      reason: "Topikmu mengarah pada pengujian model, sehingga pembagian data dan metrik perlu direncanakan sejak awal.",
      nextStep: "Tentukan dataset, baseline, metrik evaluasi, dan cara validasi.",
    });
  }

  if (/survei|kepuasan|persepsi|pengaruh|hubungan|faktor|responden|kuesioner/.test(text)) {
    recommendations.push({
      title: "Ukur hubungan antarvariabel dari responden",
      method: "Quantitative",
      reason: "Sinyal topik menunjukkan kebutuhan pengukuran variabel dan analisis data responden.",
      nextStep: "Turunkan variabel, indikator, skala ukur, populasi, dan teknik sampling.",
    });
  }

  if (/wawancara|pengalaman|makna|perilaku|fenomena|kualitatif|narasumber/.test(text)) {
    recommendations.push({
      title: "Gali konteks dan pengalaman secara mendalam",
      method: "Qualitative",
      reason: "Pendekatan ini memberi ruang untuk memahami alasan, konteks, dan pola dari narasi partisipan.",
      nextStep: "Tentukan kriteria informan, panduan wawancara, dan teknik analisis tematik.",
    });
  }

  if (/aplikasi|sistem|website|perangkat lunak|rancang bangun|pengembangan|prototipe/.test(text)) {
    recommendations.push({
      title: "Bangun dan uji solusi secara bertahap",
      method: "R&D",
      reason: "Topik pengembangan membutuhkan siklus kebutuhan, rancangan, uji coba, dan revisi.",
      nextStep: "Tuliskan pengguna sasaran, kebutuhan utama, skenario uji, dan kriteria selesai.",
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: "Mulai dari studi kasus yang terukur",
      method: "Case Study",
      reason: "Detail brief belum cukup untuk mengunci metode, jadi kasus dan batasan ruang lingkup perlu dipertegas lebih dulu.",
      nextStep: "Tambahkan objek, lokasi atau konteks, data yang tersedia, dan hasil yang ingin dicapai.",
    });
  }

  return recommendations.slice(0, 3);
}
