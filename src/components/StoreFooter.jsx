// src/components/StoreFooter.jsx
import { MapPin, Clock, MessageCircle, AtSign } from "lucide-react";
import { STORE_INFO, whatsappLink } from "../config/storeInfo";

export default function StoreFooter() {
  const { name, address, mapsUrl, openingHours, whatsapp, instagram } = STORE_INFO;
  const hasInfo = address || openingHours || whatsapp || instagram;

  return (
    <footer className="mt-8 border-t border-neutral-200 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="font-display text-lg font-extrabold text-primary">
          Clucky<span className="text-secondary">Taiwan</span>
        </p>

        {hasInfo && (
          <ul className="mt-4 grid gap-3 font-body text-sm text-neutral-600 sm:grid-cols-2 lg:grid-cols-4">
            {address && (
              <li className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary underline-offset-2 hover:underline">
                    {address}
                  </a>
                ) : (
                  <span>{address}</span>
                )}
              </li>
            )}
            {openingHours && (
              <li className="flex items-start gap-2">
                <Clock size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>{openingHours}</span>
              </li>
            )}
            {whatsapp && (
              <li className="flex items-start gap-2">
                <MessageCircle size={16} className="mt-0.5 shrink-0 text-primary" />
                <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="hover:text-primary underline-offset-2 hover:underline">
                  Chat WhatsApp
                </a>
              </li>
            )}
            {instagram && (
              <li className="flex items-start gap-2">
                <AtSign size={16} className="mt-0.5 shrink-0 text-primary" />
                <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary underline-offset-2 hover:underline">
                  @{instagram}
                </a>
              </li>
            )}
          </ul>
        )}

        <p className="mt-6 font-body text-xs text-neutral-400">
          © {new Date().getFullYear()} {name}
        </p>
      </div>
    </footer>
  );
}
