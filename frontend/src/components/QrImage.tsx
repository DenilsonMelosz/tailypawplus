import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 180, className = "" }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: "#0B2A30", light: "#FFFFFF" } }).then(setSrc).catch(() => setSrc(""));
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt="QR Code" className={className} /> : <div style={{ width: size, height: size }} className="bg-stone-100 rounded" />;
}

export const siteUrl = (path: string) => `${window.location.origin}${path}`;
