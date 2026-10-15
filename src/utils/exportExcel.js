// src/utils/exportExcel.js
// Helper untuk ekspor laporan ke file .xlsx
// Menggunakan dynamic import agar xlsx (~900KB) tidak masuk main bundle.

/**
 * downloadExcel — Ekspor array data ke file .xlsx
 *
 * @param {Object[]} rows       - Data baris (array of plain objects)
 * @param {string[]} headers    - Label kolom header (urutan sesuai keys)
 * @param {string[]} keys       - Key dari tiap row (urutan sesuai headers)
 * @param {string}   filename   - Nama file tanpa ekstensi
 * @param {string}   sheetName  - Nama sheet (default: "Laporan")
 */
export async function downloadExcel({ rows, headers, keys, filename, sheetName = "Laporan" }) {
  // Lazy-load xlsx hanya saat tombol ekspor diklik
  const XLSX = await import("xlsx");

  // Susun data: baris pertama = header, sisanya = data
  const wsData = [
    headers,
    ...rows.map((row) => keys.map((k) => row[k] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-width kolom berdasarkan konten terpanjang
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[keys[i]] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
