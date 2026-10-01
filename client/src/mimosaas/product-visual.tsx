import { MIMOSAAS_COLORS } from "./content";

/** Hero product visual — cross-channel chart sample */
export default function MimoSaaSProductVisual() {
  return (
    <div
      className="rounded-3xl border p-5 sm:p-6 shadow-lg"
      style={{
        borderColor: MIMOSAAS_COLORS.borderSoft,
        background: MIMOSAAS_COLORS.bgCard,
        boxShadow: "0 18px 40px rgba(234, 88, 12, 0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: MIMOSAAS_COLORS.textMain }}>
            Cross‑Channel Performance
          </p>
          <p className="text-xs mt-0.5" style={{ color: MIMOSAAS_COLORS.textSubtle }}>
            Blended ROAS by channel · Last 90 days
          </p>
        </div>
        <span
          className="shrink-0 text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide"
          style={{ background: MIMOSAAS_COLORS.accentSoft, color: MIMOSAAS_COLORS.accent }}
        >
          All channels
        </span>
      </div>

      <div
        className="relative h-[150px] rounded-2xl border overflow-hidden"
        style={{ borderColor: "rgba(120, 116, 255, 0.35)", background: "#ffffff" }}
      >
        <div className="absolute left-[42px] right-3.5 top-[58px] h-px bg-slate-300/60" />
        <div className="absolute left-[42px] right-3.5 top-[90px] h-px bg-slate-300/60" />
        <div className="absolute left-[42px] right-3.5 top-[122px] h-px bg-slate-300/60" />

        <svg
          viewBox="0 0 260 100"
          className="absolute left-[46px] right-4 top-[26px] bottom-[26px] w-[calc(100%-62px)] h-[calc(100%-52px)]"
          aria-hidden
        >
          <polyline
            points="0,65 65,40 130,55 195,30 260,35"
            fill="none"
            stroke="#ea580c"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="0,75 65,60 130,45 195,50 260,40"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <polyline
            points="0,80 65,70 130,60 195,55 260,50"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </svg>

        <div
          className="absolute left-1.5 top-[18px] flex flex-col gap-3 text-[9px]"
          style={{ color: MIMOSAAS_COLORS.textSubtle }}
        >
          <span>8.0x</span>
          <span>5.0x</span>
          <span>2.0x</span>
          <span>0</span>
        </div>
        <div
          className="absolute bottom-1 left-[52px] right-3 flex justify-between text-[9px]"
          style={{ color: MIMOSAAS_COLORS.textSubtle }}
        >
          <span>Mar</span>
          <span>Apr</span>
          <span>May</span>
          <span>Jun</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {[
          { label: "Meta Ads", color: "#ea580c" },
          { label: "Google Ads", color: "#10b981" },
          { label: "LinkedIn Ads", color: "#0ea5e9" },
        ].map((ch) => (
          <span
            key={ch.label}
            className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border"
            style={{ borderColor: MIMOSAAS_COLORS.borderSoft, background: "rgba(255,255,255,0.9)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ch.color }} />
            {ch.label}
          </span>
        ))}
      </div>
    </div>
  );
}
