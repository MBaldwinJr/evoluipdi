import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Briefcase, MapPin, DollarSign, CheckCircle2 } from "lucide-react";

export type ArtTemplate = "corporativo" | "moderno" | "industrial" | "neon" | "minimalista";
export type ArtFormat = "feed" | "story" | "linkedin" | "facebook" | "whatsapp";

export const FORMATS: Record<ArtFormat, { w: number; h: number; label: string }> = {
  feed: { w: 1080, h: 1080, label: "Instagram Feed (1:1)" },
  story: { w: 1080, h: 1920, label: "Stories (9:16)" },
  linkedin: { w: 1200, h: 627, label: "LinkedIn (1.91:1)" },
  facebook: { w: 1200, h: 630, label: "Facebook (1.91:1)" },
  whatsapp: { w: 1080, h: 1920, label: "WhatsApp Status (9:16)" },
};

export const TEMPLATES: Record<ArtTemplate, { name: string; bg: string; fg: string; accent: string; muted: string }> = {
  corporativo: { name: "Corporativo", bg: "#0F172A", fg: "#FFFFFF", accent: "#3B82F6", muted: "#94A3B8" },
  moderno: { name: "Moderno", bg: "#FAFAFA", fg: "#111827", accent: "#F97316", muted: "#6B7280" },
  industrial: { name: "Industrial", bg: "#1F2937", fg: "#F9FAFB", accent: "#FBBF24", muted: "#D1D5DB" },
  neon: { name: "Neon", bg: "#0A0A23", fg: "#FFFFFF", accent: "#22D3EE", muted: "#A78BFA" },
  minimalista: { name: "Minimalista", bg: "#FFFFFF", fg: "#0A0A0A", accent: "#0A0A0A", muted: "#737373" },
};

type Props = {
  format: ArtFormat;
  template: ArtTemplate;
  company: string;
  headline: string;
  subhead: string;
  cta: string;
  location?: string | null;
  workModel?: string | null;
  salary?: string | null;
  benefits?: string[];
  publicUrl: string;
  logoUrl?: string | null;
};

function formatCurrency(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const f = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${f(min)} – ${f(max)}`;
  return f((min ?? max)!);
}

export { formatCurrency };

export function JobArt({
  format, template, company, headline, subhead, cta,
  location, workModel, salary, benefits = [], publicUrl, logoUrl,
}: Props) {
  const { w, h } = FORMATS[format];
  const t = TEMPLATES[template];
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(publicUrl, {
      width: 280,
      margin: 1,
      color: { dark: t.fg, light: "#00000000" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, [publicUrl, t.fg]);

  const isVertical = h > w;
  const isWide = w / h > 1.5;

  return (
    <div
      data-art-canvas
      style={{
        width: w,
        height: h,
        background: t.bg,
        color: t.fg,
        position: "relative",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Decorative accent */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 100% 0%, ${t.accent}33 0%, transparent 55%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: 12,
          background: t.accent,
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: isWide ? 40 : 60,
          left: 60,
          right: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            padding: "10px 20px",
            background: t.accent,
            color: t.bg,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: 2,
            textTransform: "uppercase",
            borderRadius: 999,
          }}
        >
          Estamos contratando
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: t.muted, textAlign: "right", maxWidth: "50%" }}>
          {company}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: isVertical ? 60 : 360,
          top: isVertical ? "30%" : "28%",
          transform: "translateY(-10%)",
        }}
      >
        <div
          style={{
            fontSize: isVertical ? 110 : 84,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: t.fg,
          }}
        >
          {headline}
        </div>
        <div style={{ marginTop: 24, fontSize: isVertical ? 38 : 30, color: t.muted, lineHeight: 1.3 }}>
          {subhead}
        </div>

        <div style={{ marginTop: 36, display: "flex", flexWrap: "wrap", gap: 18 }}>
          {location && (
            <Chip color={t.fg} bg={`${t.fg}15`} icon={<MapPin size={22} />}>{location}</Chip>
          )}
          {workModel && (
            <Chip color={t.fg} bg={`${t.fg}15`} icon={<Briefcase size={22} />}>{workModel}</Chip>
          )}
          {salary && (
            <Chip color={t.bg} bg={t.accent} icon={<DollarSign size={22} />}>{salary}</Chip>
          )}
        </div>

        {benefits.length > 0 && (
          <ul style={{ marginTop: 32, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
            {benefits.slice(0, isVertical ? 5 : 3).map((b) => (
              <li key={b} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: t.fg }}>
                <CheckCircle2 size={26} color={t.accent} /> {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer / QR */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 60,
          right: 60,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.accent, marginBottom: 8 }}>{cta}</div>
          <div style={{ fontSize: 20, color: t.muted, maxWidth: 600, wordBreak: "break-all" }}>{publicUrl}</div>
        </div>
        {qrUrl && (
          <div style={{ background: `${t.fg}10`, padding: 16, borderRadius: 16, border: `2px solid ${t.accent}` }}>
            <img src={qrUrl} alt="QR" width={160} height={160} style={{ display: "block" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  children, icon, color, bg,
}: { children: React.ReactNode; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 20px",
        background: bg,
        color,
        borderRadius: 12,
        fontSize: 24,
        fontWeight: 600,
      }}
    >
      {icon} {children}
    </span>
  );
}
