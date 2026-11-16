// src/components/StructuredData.jsx
//
// JSON-LD schema.org/Restaurant untuk mesin pencari (Google, dll. menjalankan JS).
// Sumber data: src/config/storeInfo.js. Tidak menampilkan apa pun sampai alamat
// diisi — data tempat usaha yang tidak lengkap/palsu lebih merugikan daripada tidak ada.
import { useEffect } from "react";
import { STORE_INFO } from "../config/storeInfo";

const IMAGE_PATH = "/og-image.jpg"; // public/og-image.jpg

export default function StructuredData() {
  const { name, address, whatsapp, instagram } = STORE_INFO;

  useEffect(() => {
    if (!address) return;

    const data = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name,
      url: window.location.origin,
      image: new URL(IMAGE_PATH, window.location.origin).href,
      servesCuisine: "Taiwanese",
      address: { "@type": "PostalAddress", streetAddress: address, addressCountry: "ID" },
      ...(whatsapp ? { telephone: `+${whatsapp}` } : {}),
      ...(instagram ? { sameAs: [`https://instagram.com/${instagram}`] } : {}),
    };

    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
    return () => el.remove();
  }, [name, address, whatsapp, instagram]);

  return null;
}
