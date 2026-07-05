import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "./legalConfig";

/** Shared chrome for the public legal pages (privacy, terms). */
export function LegalDoc({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[#0B1020] text-slate-300">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-black uppercase tracking-widest text-[#8E9299] hover:text-white transition-colors"
        >
          ← {LEGAL.appName}
        </Link>

        <h1 className="mt-6 text-3xl sm:text-4xl font-black text-white tracking-tight">{title}</h1>
        <p className="mt-2 text-[11px] font-mono uppercase tracking-widest text-[#8E9299]">
          Effective {LEGAL.effectiveDate} · Last updated {LEGAL.lastUpdated}
        </p>

        {intro && <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300">{intro}</div>}

        <div className="mt-8 space-y-8">{children}</div>

        <footer className="mt-14 border-t border-white/10 pt-6 text-xs text-[#8E9299] space-y-2">
          <p>
            Questions about this document? Contact{" "}
            <span className="text-slate-300">{LEGAL.contactEmail}</span>.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

/** A numbered top-level section. */
export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black text-white">
        <span className="text-[#FF4E00]">{n}.</span> {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

/** Bulleted list with the house style. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[#FF4E00]" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
