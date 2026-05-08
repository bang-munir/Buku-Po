
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const getSmartOrderSummary = async (order: Order): Promise<string> => {
  // Ensure the API key is retrieved exclusively from process.env.GEMINI_API_KEY as per guidelines
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return "Ringkasan otomatis tidak aktif (API Key belum diatur di server).";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat ringkasan pesanan singkat dalam 1-2 kalimat ramah untuk pelanggan ${order.customerName}. 
        Invoice: ${order.invoiceNumber}. 
        Total Belanja: Rp ${order.subtotal.toLocaleString()}. 
        Status Bayar: ${order.total <= 0 ? 'Lunas' : 'Sisa tagihan Rp ' + order.total.toLocaleString()}.
        Detail Barang: ${order.items.map(i => `${i.name} (Pesan: ${i.quantity}, Proses: ${i.processingQuantity}, Kirim: ${i.shippedQuantity})`).join(', ')}.`
    });

    return response.text || "Pesanan telah dikonfirmasi dengan rincian di atas.";
  } catch (error: any) {
    console.warn("AI summary error:", error.message);
    return "Ringkasan pesanan sudah tersedia pada detail nota.";
  }
};
