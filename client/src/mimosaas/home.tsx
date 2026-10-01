import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import MimoSaaSLayout from "./layout";
import MimoSaaSProductVisual from "./product-visual";
import {
  INTEGRATIONS,
  MIMOSAAS_COLORS,
  WORKFLOW_STEPS,
} from "./content";

export default function MimoSaaSHome() {
  return (
    <MimoSaaSLayout>
      <section
        className="relative overflow-hidden border-b"
        style={{
          borderColor: MIMOSAAS_COLORS.borderSoft,
          background: `linear-gradient(180deg, ${MIMOSAAS_COLORS.bgHero} 0%, ${MIMOSAAS_COLORS.bgMain} 70%)`,
        }}
      >
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  borderColor: MIMOSAAS_COLORS.borderSoft,
                  background: MIMOSAAS_COLORS.accentSoft,
                  color: MIMOSAAS_COLORS.accent,
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                For growth & performance agencies
              </p>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl leading-[1.1]">
                Marketing analytics your clients will trust
              </h1>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
                mimosaas unifies ad spend, revenue, and funnel data across every client and channel — so your team
                spends less time reporting and more time improving performance.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a href="/sign-in">
                  <Button
                    size="lg"
                    className="gap-2 px-8 text-white no-underline border-0 w-full sm:w-auto"
                    style={{ background: MIMOSAAS_COLORS.accent }}
                  >
                    Get early access
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
              <ul className="mt-8 space-y-2 text-sm" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
                {["No credit card required", "Set up in under an hour", "Cancel anytime"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: MIMOSAAS_COLORS.accent }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <MimoSaaSProductVisual />
          </div>
        </div>
      </section>

      <section
        className="border-b py-8"
        style={{ borderColor: MIMOSAAS_COLORS.borderSoft, background: MIMOSAAS_COLORS.bgCard }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm font-medium" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
            Trusted by performance teams managing paid media across retail, SaaS, finance, and e‑commerce
          </p>
        </div>
      </section>

      <section
        className="border-y py-20"
        style={{ borderColor: MIMOSAAS_COLORS.borderSoft, background: MIMOSAAS_COLORS.bgHero }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold">Up and running in three steps</h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {WORKFLOW_STEPS.map((s) => (
              <div key={s.step} className="text-center md:text-left">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white md:mx-0"
                  style={{ background: MIMOSAAS_COLORS.accent }}
                >
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="integrations"
        className="border-y py-20"
        style={{ borderColor: MIMOSAAS_COLORS.borderSoft, background: MIMOSAAS_COLORS.bgCard }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold">Works with your existing stack</h2>
          <p className="mt-4 max-w-xl mx-auto" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
            Connect the platforms you already use — ad managers, analytics, CRM, and exports.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="rounded-full border px-4 py-2 text-sm font-medium"
                style={{ borderColor: MIMOSAAS_COLORS.borderSoft, background: MIMOSAAS_COLORS.bgMain }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20" style={{ background: MIMOSAAS_COLORS.textMain, color: "#fff8f3" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to win more retainers with better reporting?</h2>
          <p className="mt-4 text-orange-100/90 leading-relaxed">
            Join agencies using mimosaas to deliver clearer insights, faster — across every client and channel.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/sign-in" className="no-underline">
              <Button
                size="lg"
                className="gap-2 px-8 text-white border-0"
                style={{ background: MIMOSAAS_COLORS.accent }}
              >
                Get early access
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>
    </MimoSaaSLayout>
  );
}
