"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// ─── Accordion item ───────────────────────────────────────────────────────────

function Section({
  emoji,
  title,
  defaultOpen = false,
  children,
}: {
  emoji: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left
                   hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors"
        aria-expanded={open}
      >
        <span className="font-semibold text-gray-800 text-sm">
          {emoji}&nbsp; {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200
                      ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="pb-4 px-1 text-sm text-gray-600 leading-relaxed space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Schedule row ─────────────────────────────────────────────────────────────

function TimeRow({ time, label }: { time: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs font-bold text-sage-600 w-12 flex-shrink-0 tabular-nums">
        {time}
      </span>
      <span>{label}</span>
    </div>
  );
}

// ─── Menu row ────────────────────────────────────────────────────────────────

function MenuRow({ course, dish }: { course: string; dish: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-semibold text-gray-400 w-24 flex-shrink-0 pt-0.5">
        {course}
      </span>
      <span>{dish}</span>
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-semibold text-gray-400 w-28 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WeddingInfo() {
  return (
    <section
      id="wedding-info"
      className="bg-white rounded-2xl shadow-sm border border-sage-100 p-6"
    >
      <h2 className="text-base font-bold text-gray-800 mb-1">
        📋 Svadobné info
      </h2>
      <p className="text-xs text-gray-400 mb-4">Katka &amp; Šimon · 6. júna 2026</p>

      {/* ── Schedule ──────────────────────────────────────────────────── */}
      <Section emoji="🕙" title="Harmonogram dňa" defaultOpen>
        <TimeRow time="10:00" label="Sobáš — Kostol sv. Martina, Bratislava" />
        <TimeRow time="12:00" label="Príchod na sálu" />
        <TimeRow time="12:30" label="Obed" />
        <TimeRow time="15:00" label="Svadobná torta" />
        <TimeRow time="18:00" label="Večera" />
        <TimeRow time="20:00" label="Party 🎉" />
      </Section>

      {/* ── Menu ──────────────────────────────────────────────────────── */}
      <Section emoji="🍽" title="Menu">
        <MenuRow course="Predjedlo"    dish="Carpaccio z hovädzej sviečkovice, parmezán, rukola" />
        <MenuRow course="Polievka"     dish="Svadobná slepačia s haluškami" />
        <MenuRow course="Hlavný chod"  dish="Jahňacá pliecko, zemiaková kaša, grilovaná zelenina" />
        <MenuRow course="Dezert"       dish="Čokoládová fontána, ovocie, macarons" />
        <p className="text-xs text-gray-400 mt-2">
          Vegetariánsku alternatívu nahláste obsluhe.
        </p>
      </Section>

      {/* ── Practical info ────────────────────────────────────────────── */}
      <Section emoji="📍" title="Praktické info">
        <InfoRow
          label="Sáła"
          value={
            <a
              href="https://maps.google.com/?q=Bratislava"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sage-600 underline underline-offset-2"
            >
              Reštaurácia Záhrada, Bratislava
            </a>
          }
        />
        <InfoRow label="Parkovanie" value="Bezplatné parkovisko pri sále" />
        <InfoRow label="Dress code"  value="Elegantné — odtiene smaragdovej vítané 💚" />
        <InfoRow
          label="Kontakt"
          value={
            <a href="tel:+421900000000" className="text-sage-600 underline underline-offset-2">
              +421 900 000 000
            </a>
          }
        />
      </Section>
    </section>
  );
}
