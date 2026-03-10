import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, BarChart3, Zap, Clock, Newspaper } from "lucide-react";

// ─── Mock Marketing News ────────────────────────────────────────────
const MOCK_NEWS = [
  {
    id: 1,
    title: "Google's AI Overviews Are Reshaping Organic Click-Through Rates",
    summary: "New data shows AI-generated search summaries are reducing organic CTR by up to 18% for informational queries. Marketers are pivoting toward bottom-of-funnel content and brand-building strategies to maintain visibility.",
    category: "SEO",
    date: "Mar 10, 2026",
    readTime: "5 min",
    featured: true,
  },
  {
    id: 2,
    title: "Meta Launches Advantage+ Creative AI for Dynamic Ad Generation",
    summary: "Meta's latest AI tool automatically generates ad variations across formats, promising 30% faster creative production and improved personalization at scale.",
    category: "Social",
    date: "Mar 9, 2026",
    readTime: "4 min",
  },
  {
    id: 3,
    title: "The Rise of Zero-Click Marketing: What It Means for Your Funnel",
    summary: "With users getting answers directly in search results and social feeds, smart brands are rethinking attribution and embracing impression-based brand metrics.",
    category: "Analytics",
    date: "Mar 8, 2026",
    readTime: "6 min",
  },
  {
    id: 4,
    title: "LinkedIn B2B Benchmarks Report: CPL Down 12% YoY",
    summary: "LinkedIn's 2026 benchmark data reveals cost-per-lead is trending downward as advertisers adopt smarter audience targeting and document ads gain traction.",
    category: "PPC",
    date: "Mar 7, 2026",
    readTime: "3 min",
  },
  {
    id: 5,
    title: "Why First-Party Data Strategies Are No Longer Optional",
    summary: "As third-party cookies phase out fully this year, brands investing in CDPs and server-side tracking are seeing 2-3x better attribution accuracy.",
    category: "Analytics",
    date: "Mar 6, 2026",
    readTime: "5 min",
  },
  {
    id: 6,
    title: "TikTok Shop Revenue Surges 140% — Should Your Brand Be There?",
    summary: "Social commerce on TikTok is booming. Early adopters report ROAS of 4-6x, but creative authenticity remains the biggest success factor.",
    category: "Social",
    date: "Mar 5, 2026",
    readTime: "4 min",
  },
  {
    id: 7,
    title: "Predictive Analytics in Marketing: From Hype to Must-Have",
    summary: "ML-powered forecasting tools are helping marketing teams predict campaign performance before launch, reducing wasted spend by an average of 22%.",
    category: "AI",
    date: "Mar 4, 2026",
    readTime: "7 min",
  },
  {
    id: 8,
    title: "Google Ads Performance Max: Best Practices for 2026",
    summary: "Performance Max campaigns now account for 45% of Google Ads spend. Here are the targeting and creative strategies that top performers are using.",
    category: "PPC",
    date: "Mar 3, 2026",
    readTime: "5 min",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  SEO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Social: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Analytics: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PPC: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  AI: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

export default function HomePage() {
  const featured = MOCK_NEWS.find((n) => n.featured);
  const rest = MOCK_NEWS.filter((n) => !n.featured);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8 fade-in">
          {/* ─── Hero Section ─── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(221, 83%, 53%), hsl(260, 70%, 55%))' }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Welcome to MimoSaaS
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Your marketing command center
                </p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed max-w-3xl">
              Track campaigns across every platform, uncover insights with AI-powered analytics,
              and make data-driven decisions that move the needle. All your marketing performance — one dashboard.
            </p>

            {/* Quick stats strip */}
            <div className="flex gap-6 mt-6">
              {[
                { icon: BarChart3, label: "Cross-Platform Analytics", desc: "GA4, LinkedIn, Meta, Google Ads" },
                { icon: TrendingUp, label: "Real-Time KPIs", desc: "Automated tracking & alerts" },
                { icon: Zap, label: "AI-Powered Insights", desc: "Anomaly detection & recommendations" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Marketing News ─── */}
          <div className="mb-6 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Marketing Pulse</h2>
            <Badge variant="outline" className="text-xs">Latest</Badge>
          </div>

          {/* Featured + Side stack */}
          <div className="grid grid-cols-3 gap-5 mb-5">
            {/* Featured article */}
            {featured && (
              <Card className="col-span-2 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                <div
                  className="h-48 flex items-end p-6"
                  style={{ background: 'linear-gradient(135deg, hsl(221, 83%, 30%), hsl(260, 70%, 35%))' }}
                >
                  <div>
                    <Badge className={CATEGORY_COLORS[featured.category] || ""}>{featured.category}</Badge>
                    <h3 className="text-xl font-bold text-white mt-2 group-hover:underline decoration-2 underline-offset-2">
                      {featured.title}
                    </h3>
                  </div>
                </div>
                <CardContent className="p-5">
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{featured.summary}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span>{featured.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{featured.readTime} read</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Side stack — 2 articles */}
            <div className="flex flex-col gap-5">
              {rest.slice(0, 2).map((article) => (
                <Card key={article.id} className="flex-1 hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-5 flex flex-col h-full">
                    <Badge className={`w-fit ${CATEGORY_COLORS[article.category] || ""}`}>{article.category}</Badge>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-2 group-hover:underline decoration-1 underline-offset-2 line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 flex-1">{article.summary}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                      <span>{article.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{article.readTime}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Remaining articles — 3 column grid */}
          <div className="grid grid-cols-3 gap-5">
            {rest.slice(2).map((article) => (
              <Card key={article.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardContent className="p-5">
                  <Badge className={`w-fit ${CATEGORY_COLORS[article.category] || ""}`}>{article.category}</Badge>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-2 group-hover:underline decoration-1 underline-offset-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-3">{article.summary}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span>{article.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{article.readTime}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
