import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ArrowRight } from "lucide-react";
import clerivoLogo from "@/assets/clerivo-logo.svg";

type Props = {
  id: string;
  message: string;
  ctaLabel: string;
  ctaTo?: string;
  onCtaClick?: () => void;
};

export function ClerivoBubble({ id, message, ctaLabel, ctaTo, onCtaClick }: Props) {
  const storageKey = `clerivo-bubble-dismissed:${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) {
        const t = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [storageKey]);

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
  };

  const Cta = ctaTo ? (
    <Link
      to={ctaTo}
      onClick={close}
      className="inline-flex h-8 items-center gap-1 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
    >
      {ctaLabel} <ArrowRight className="h-3 w-3" />
    </Link>
  ) : (
    <button
      onClick={() => {
        onCtaClick?.();
        close();
      }}
      className="inline-flex h-8 items-center gap-1 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
    >
      {ctaLabel} <ArrowRight className="h-3 w-3" />
    </button>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-40 flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end animate-fade-up"
    >
      <div className="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent" />
        <img
          src={clerivoLogo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg border border-primary/20"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            CLERIVO
          </p>
          <p className="mt-0.5 text-sm leading-snug text-foreground">{message}</p>
          <div className="mt-2">{Cta}</div>
        </div>
        <button
          onClick={close}
          aria-label="Cerrar"
          className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
