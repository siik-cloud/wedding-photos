"use client";

import { useState } from "react";
import { ChevronDown, CalendarDays, UtensilsCrossed, MapPin } from "lucide-react";

function Section({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-sage-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left
                   hover:bg-sage-50/60 rounded-lg px-1 -mx-1 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 font-sans font-medium text-stone-800 text-sm">
          <Icon className="w-4 h-4 text-sage-500 flex-shrink-0" strokeWidth={1.5} />
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-sage-400 flex-shrink-0 transition-transform duration-200
                      ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="pb-5 text-sm text-stone-600 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

/* Vertical timeline item */
function TimelineItem({
  label,
  description,
  last = false,
}: {
  label: string;
  description?: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-sage-400 mt-1.5 flex-shrink-0" />
        {!last && <div className="w-px flex-1 bg-sage-100 mt-1 mb-0" />}
      </div>
      <div className={`${last ? "pb-0" : "pb-4"}`}>
        <p className="font-sans font-medium text-stone-800 text-sm leading-snug">{label}</p>
        {description && (
          <p className="font-sans text-stone-400 text-xs mt-0.5 leading-relaxed font-light">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* Menu course row */
function CourseRow({ course, dish }: { course: string; dish: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-sage-50 last:border-0">
      <span className="font-sans text-xs text-stone-400 w-28 flex-shrink-0 pt-0.5 font-medium uppercase tracking-wide">
        {course}
      </span>
      <span className="font-sans text-stone-700 text-sm leading-snug">{dish}</span>
    </div>
  );
}

/* Practical info row */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-sage-50 last:border-0">
      <span className="font-sans text-xs text-stone-400 w-28 flex-shrink-0 pt-0.5 font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="font-sans text-stone-700 text-sm">{value}</span>
    </div>
  );
}

export default function WeddingInfo() {
  return (
    <section
      id="wedding-info"
      className="bg-sage-50 border border-sage-200 rounded-2xl px-6 py-2
                 shadow-sm shadow-sage-900/5"
    >
      <div className="pt-4 pb-2">
        <h2 className="font-sans text-sm font-semibold text-stone-900 tracking-tight">
          Svadobné info
        </h2>
        <p className="font-sans font-light text-stone-400 text-sm mt-0.5 italic">
          Katka &amp; Šimon · 6. júna 2026
        </p>
      </div>

      {/* Harmonogram — sequence only, no times */}
      <Section icon={CalendarDays} title="Priebeh dňa" defaultOpen>
        <div className="mt-1">
          <TimelineItem label="Obrad"                description="Sobášny obrad" />
          <TimelineItem label="Gratulácie"           description="Spoločné gratulácje s rodinou a priateľmi" />
          <TimelineItem label="Spoločné fotenie" />
          <TimelineItem label="Príchod na sálu" />
          <TimelineItem label="Obed a posedenie" />
          <TimelineItem label="Svadobná torta" />
          <TimelineItem label="Prvý tanec" />
          <TimelineItem label="Večera" />
          <TimelineItem label="Voľná zábava" />
          <TimelineItem label="Polnočné občerstvenie" last />
        </div>
      </Section>

      {/* Menu */}
      <Section icon={UtensilsCrossed} title="Menu">
        <div className="mt-1">
          <CourseRow course="Predjedlo"    dish="Carpaccio z hovädzej sviečkovice, parmezán, rukola" />
          <CourseRow course="Polievka"     dish="Svadobná slepačia polievka s haluškami" />
          <CourseRow course="Hlavné jedlo" dish="Jahňacie pliecko, zemiaková kaša, grilovaná zelenina" />
          <CourseRow course="Dezert"       dish="Výber dezertov, čokoládová fontána" />
          <CourseRow course="Neskoro večer" dish="Polnočné občerstvenie" />
        </div>
      </Section>

    </section>
  );
}
