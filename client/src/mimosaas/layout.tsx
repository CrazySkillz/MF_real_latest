import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MIMOSAAS_COLORS, MIMOSAAS_NAV } from "./content";

function MimoSaaSLogo({ className = "h-9" }: { className?: string }) {
  return (
    <img
      src="/logo_fff8f3_bg_orange_fill.jpg"
      alt="mimosaas"
      className={`${className} w-auto object-contain`}
    />
  );
}

export default function MimoSaaSLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: MIMOSAAS_COLORS.bgMain, color: MIMOSAAS_COLORS.textMain }}
    >
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: MIMOSAAS_COLORS.borderSoft,
          background: "rgba(255, 248, 243, 0.92)",
        }}
      >
        <div className="mx-auto flex h-32 sm:h-36 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center no-underline">
            <MimoSaaSLogo className="h-24 sm:h-28" />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {MIMOSAAS_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium transition-colors no-underline hover:opacity-80"
                style={{ color: MIMOSAAS_COLORS.textSubtle }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a href="mailto:hello@mimosaas.com">
              <Button
                size="sm"
                className="no-underline text-white border-0"
                style={{ background: MIMOSAAS_COLORS.accent }}
              >
                Book a demo
              </Button>
            </a>
          </div>

          <button
            type="button"
            className="rounded-md p-2 md:hidden"
            style={{ color: MIMOSAAS_COLORS.textSubtle }}
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div
            className="border-t px-4 py-4 md:hidden"
            style={{ borderColor: MIMOSAAS_COLORS.borderSoft, background: MIMOSAAS_COLORS.bgCard }}
          >
            <nav className="flex flex-col gap-3">
              {MIMOSAAS_NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium no-underline"
                  style={{ color: MIMOSAAS_COLORS.textMain }}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a href="mailto:hello@mimosaas.com" onClick={() => setMobileOpen(false)}>
                <Button className="w-full mt-2 text-white" style={{ background: MIMOSAAS_COLORS.accent }}>
                  Book a demo
                </Button>
              </a>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t" style={{ borderColor: MIMOSAAS_COLORS.borderSoft, background: MIMOSAAS_COLORS.bgCard }}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <MimoSaaSLogo className="h-20 sm:h-24" />
              <p className="mt-3 max-w-md text-sm leading-relaxed" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
                Marketing analytics for growth agencies — unified reporting, client workspaces, and proactive alerts.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Get started</h4>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
                Connect your channels, onboard client workspaces, and see blended performance in minutes.
              </p>
              <a href="/sign-in" className="inline-block mt-4 no-underline">
                <Button size="sm" className="text-white" style={{ background: MIMOSAAS_COLORS.accent }}>
                  Get early access
                </Button>
              </a>
            </div>
          </div>
          <p
            className="mt-10 border-t pt-6 text-center text-xs"
            style={{ borderColor: MIMOSAAS_COLORS.borderSoft, color: MIMOSAAS_COLORS.textSubtle }}
          >
            © {new Date().getFullYear()} mimosaas. Marketing analytics overview for agencies.
          </p>
        </div>
      </footer>
    </div>
  );
}
