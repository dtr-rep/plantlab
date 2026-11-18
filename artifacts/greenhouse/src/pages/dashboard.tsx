import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, Download, Droplets, Leaf, Printer, RotateCcw,
  Search, Sprout, Thermometer, TrendingUp, Undo2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv } from "@/lib/csv";
import {
  DAYS, ZONES, dateAt, iso, loadDataset, parseLocal, zoneName,
  type EnvReading, type Health, type PlantBatch, type ZoneId,
} from "@/lib/greenhouse-data";

const C = { deep: "#4F5E38", moss: "#6B7B4F", mid: "#7E9059", light: "#A8B889", clay: "#B9755A", clayL: "#C98A6E", ochre: "#B8944A", ink: "#3A3A32", muted: "#7A7A6E", line: "#E6E2D6" };
const SERIES = [C.deep, C.clay, C.mid, C.ochre, "#8A6E8F", "#5E8580", "#9C6B3E", "#6E8A5A", C.clayL, "#7D7556", "#A07A8E", "#4E6E62", C.light, "#C2A35E", "#8C5A4A"];
const HEALTH_META: Record<Health, { label: string; cls: string; color: string }> = {
  thriving: { label: "Thriving", cls: "bg-[#E7EDD9] text-[#4F5E38]", color: C.moss },
  watch: { label: "Watch", cls: "bg-[#FBF0D9] text-[#8A6B25]", color: C.ochre },
  stressed: { label: "Stressed", cls: "bg-[#F3E2DA] text-[#9E5640]", color: C.clay },
};
type Range = 7 | 30 | 90;
type ZoneFilter = ZoneId | "all";
const fmtDay = (s: string) => format(parseLocal(s), "MMM d");
const firstIdx = (p: PlantBatch) => p.heights.findIndex((h) => h > 0);

function growthBetween(p: PlantBatch, a: number, b: number) {
  const f = firstIdx(p);
  if (f < 0 || f > b) return 0;
  return p.heights[b] - p.heights[Math.max(a, f)];
}

const CARE_KEY = "verdant.care.v1";
function useCareLog() {
  const [log, setLog] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(CARE_KEY) || "{}"); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem(CARE_KEY, JSON.stringify(log)); }, [log]);
  return {
    log,
    complete: (id: string) => setLog((l) => ({ ...l, [id]: new Date().toISOString() })),
    undo: (id: string) => setLog((l) => { const n = { ...l }; delete n[id]; return n; }),
  };
}

function TipBox({ active, payload, label, unit = "cm" }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E6E2D6] bg-[#FCFAF4] px-3.5 py-2.5 text-[13px] shadow-[0_8px_24px_rgba(80,94,56,.14)]">
      <div className="mb-1 font-semibold text-[#3A3A32]">{label ? fmtDay(label) : ""}</div>
      {payload.map((e) => (
        <div key={e.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: e.color }} />
          <span className="text-[#7A7A6E]">{e.name}</span>
          <span className="ml-auto pl-4 font-serif font-semibold">{typeof e.value === "number" ? e.value.toFixed(1) : e.value} {unit}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ id, title, meta, actions, children, className = "" }: { id?: string; title: string; meta?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`card-earth rise flex flex-col p-5 sm:p-6 scroll-mt-24 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
          {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function CsvButton({ onClick, testId }: { onClick: () => void; testId: string }) {
  return (
    <button onClick={onClick} data-testid={testId} className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E2D6] bg-background px-3 py-1.5 text-xs font-semibold text-[#4F5E38] transition hover:-translate-y-px hover:border-[#A8B889]">
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  );
}

function Pill({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button onClick={onClick} data-testid={testId}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${active ? "border-[#6B7B4F] bg-[#6B7B4F] text-[#F4F1E6] shadow-[0_4px_12px_rgba(79,94,56,.25)]" : "border-[#E6E2D6] bg-[#FCFAF4] text-[#3A3A32] hover:border-[#A8B889]"}`}>
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-[1680px] space-y-5 px-4 py-8 sm:px-8">
      <Skeleton className="h-12 w-72 rounded-2xl bg-[#ECE7DA]" />
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-[22px] bg-[#ECE7DA]" />)}</div>
      <Skeleton className="h-96 rounded-[22px] bg-[#ECE7DA]" />
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["verdant-demo"], queryFn: loadDataset });
  const [zone, setZone] = useState<ZoneFilter>("all");
  const [range, setRange] = useState<Range>(30);
  const [search, setSearch] = useState("");
  const [healthF, setHealthF] = useState<Health | "all">("all");
  const [sort, setSort] = useState<{ key: "growth" | "height" | "count" | "name"; dir: 1 | -1 }>({ key: "growth", dir: -1 });
  const [selected, setSelected] = useState<PlantBatch | null>(null);
  const [shown, setShown] = useState<Set<string> | null>(null);
  const care = useCareLog();
  const { toast } = useToast();

  const last = DAYS - 1;
  const start = last - range;
  const plants = useMemo(() => (data?.plants ?? []).filter((p) => zone === "all" || p.zone === zone), [data, zone]);
  const env = useMemo(() => (data?.env ?? []).filter((e) => zone === "all" || e.zone === zone), [data, zone]);

  const kpi = useMemo(() => {
    const total = plants.reduce((s, p) => s + p.count, 0);
    const wavg = (fn: (p: PlantBatch) => number) => total ? plants.reduce((s, p) => s + fn(p) * p.count, 0) / total : 0;
    const growth = wavg((p) => growthBetween(p, start, last));
    const prevGrowth = start - range >= 0 ? wavg((p) => growthBetween(p, start - range, start)) : null;
    const thriving = plants.filter((p) => p.health === "thriving").reduce((s, p) => s + p.count, 0);
    const inRange = env.filter((e) => parseLocal(e.date) > dateAt(start));
    const temp = inRange.reduce((s, e) => s + e.temp, 0) / (inRange.length || 1);
    const hum = inRange.reduce((s, e) => s + e.humidity, 0) / (inRange.length || 1);
    const ok = inRange.filter((e) => { const z = ZONES.find((x) => x.id === e.zone)!; return e.temp >= z.targetTemp[0] && e.temp <= z.targetTemp[1] && e.humidity >= z.targetHumidity[0] && e.humidity <= z.targetHumidity[1]; }).length;
    return { total, growth, prevGrowth, healthPct: total ? (thriving / total) * 100 : 0, temp, hum, okPct: inRange.length ? (ok / inRange.length) * 100 : 0, batches: plants.length };
  }, [plants, env, start, last, range]);

  const species = useMemo(() => Array.from(new Set(plants.map((p) => p.species))), [plants]);
  const hidden = useMemo(() => new Set(species.filter((s, i) => (shown ? !shown.has(s) : i >= 5))), [species, shown]);
  const speciesSeries = useMemo(() => {
    const rows: Record<string, string | number>[] = [];
    for (let i = start; i <= last; i++) {
      const row: Record<string, string | number> = { date: iso(dateAt(i)) };
      for (const sp of species) {
        const group = plants.filter((p) => p.species === sp && p.heights[i] > 0);
        const n = group.reduce((s, p) => s + p.count, 0);
        if (n) row[sp] = Math.round((group.reduce((s, p) => s + p.heights[i] * p.count, 0) / n) * 10) / 10;
      }
      rows.push(row);
    }
    return rows;
  }, [plants, species, start, last]);

  const zoneBars = useMemo(() => ZONES.filter((z) => zone === "all" || z.id === zone).map((z) => {
    const g = (data?.plants ?? []).filter((p) => p.zone === z.id);
    const n = g.reduce((s, p) => s + p.count, 0);
    return { zone: z.short, name: z.name, growth: Math.round((g.reduce((s, p) => s + growthBetween(p, start, last) * p.count, 0) / (n || 1)) * 10) / 10 };
  }), [data, zone, start, last]);

  const healthMix = useMemo(() => (["thriving", "watch", "stressed"] as Health[]).map((h) => ({ key: h, name: HEALTH_META[h].label, value: plants.filter((p) => p.health === h).reduce((s, p) => s + p.count, 0) })), [plants]);

  const envSeries = useMemo(() => {
    const by = new Map<string, EnvReading[]>();
    env.forEach((e) => { if (parseLocal(e.date) > dateAt(start)) by.set(e.date, [...(by.get(e.date) ?? []), e]); });
    return Array.from(by.entries()).map(([date, rs]) => ({ date, temp: +(rs.reduce((s, r) => s + r.temp, 0) / rs.length).toFixed(1), humidity: +(rs.reduce((s, r) => s + r.humidity, 0) / rs.length).toFixed(1) }));
  }, [env, start]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const r = plants.filter((p) => (healthF === "all" || p.health === healthF) && (!q || `${p.species} ${p.variety} ${p.code} ${p.stage}`.toLowerCase().includes(q)))
      .map((p) => ({ p, growth: growthBetween(p, start, last), height: p.heights[last] }));
    const val = (x: typeof r[number]) => sort.key === "name" ? `${x.p.species} ${x.p.variety}` : sort.key === "count" ? x.p.count : x[sort.key];
    return r.sort((a, b) => { const A = val(a), B = val(b); return (A > B ? 1 : A < B ? -1 : 0) * sort.dir; });
  }, [plants, search, healthF, sort, start, last]);

  const attention = useMemo(() => {
    const items: { id: string; kind: "plant" | "env"; title: string; detail: string; action: string; severity: Health; plant?: PlantBatch }[] = [];
    plants.filter((p) => p.issue).forEach((p) => items.push({ id: `care-${p.id}`, kind: "plant", title: `${p.species} ${p.variety}`, detail: p.issue!, action: p.careAction!, severity: p.health, plant: p }));
    ZONES.filter((z) => zone === "all" || z.id === zone).forEach((z) => {
      const recent = (data?.env ?? []).filter((e) => e.zone === z.id).slice(-3);
      const hot = recent.filter((e) => e.temp > z.targetTemp[1]).length;
      const humid = recent.filter((e) => e.humidity > z.targetHumidity[1]).length;
      if (hot) items.push({ id: `env-temp-${z.id}`, kind: "env", title: z.name, detail: `Temperature above ${z.targetTemp[1]} °C on ${hot} of the last 3 days (peak ${Math.max(...recent.map((e) => e.temp))} °C)`, action: "Check shade screen and vent schedule", severity: "watch" });
      if (humid) items.push({ id: `env-hum-${z.id}`, kind: "env", title: z.name, detail: `Humidity above ${z.targetHumidity[1]}% on ${humid} of the last 3 days`, action: "Increase dusk venting, run HAF fans overnight", severity: "stressed" });
    });
    const rank = { stressed: 0, watch: 1, thriving: 2 };
    return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [plants, data, zone]);
  const openCount = attention.filter((a) => !care.log[a.id]).length;

  if (isLoading) return <LoadingState />;
  if (isError || !data) return (
    <div className="grid min-h-[100dvh] place-items-center p-6">
      <div className="card-earth max-w-sm p-8 text-center">
        <h2 className="text-xl font-semibold">The demo dataset did not load</h2>
        <p className="mt-2 text-sm text-muted-foreground">Nothing is lost. Try loading it again.</p>
        <button onClick={() => refetch()} data-testid="button-retry" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" />Retry</button>
      </div>
    </div>
  );

  const rangeLabel = `${format(dateAt(start + 1), "MMM d")} – ${format(dateAt(last), "MMM d, yyyy")}`;
  const zoneLabel = zone === "all" ? "All zones" : zoneName(zone);
  const fileTag = `${zone}-${range}d`;
  const delta = kpi.prevGrowth ? ((kpi.growth - kpi.prevGrowth) / kpi.prevGrowth) * 100 : null;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const toggleSort = (key: typeof sort.key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));

  const kpis = [
    { label: "Plants under care", value: kpi.total.toLocaleString(), sub: `${kpi.batches} batches · ${zoneLabel}`, icon: Sprout },
    { label: `Avg growth, ${range} days`, value: `${kpi.growth.toFixed(1)} cm`, sub: `${(kpi.growth / range).toFixed(2)} cm per day`, icon: TrendingUp, delta },
    { label: "Thriving share", value: `${kpi.healthPct.toFixed(1)}%`, sub: `${healthMix[1].value} watch · ${healthMix[2].value} stressed`, icon: Leaf },
    { label: "Mean conditions", value: `${kpi.temp.toFixed(1)} °C`, sub: `${kpi.hum.toFixed(0)}% RH · ${kpi.okPct.toFixed(0)}% days in target`, icon: Thermometer },
  ];

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-[#E6E2D6] bg-[#F7F4ED]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#6B7B4F] to-[#4F5E38] shadow-[0_6px_16px_rgba(79,94,56,.25)]">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#EEF0E4" strokeWidth="1.8" strokeLinecap="round"><path d="M12 21c0-6 0-9 5-12M12 21c0-5 0-8-5-10" /><path d="M17 4c-3 .5-4.5 2.5-5 6 3.2-.4 4.8-2 5-6Z" fill="#A8B889" stroke="none" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight">Greenhouse #003</h1>
                <span data-testid="badge-demo" className="rounded-full border border-[#C98A6E]/50 bg-[#F3E2DA] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#9E5640]">Demo data</span>
              </div>
              <p className="text-xs text-muted-foreground">Hollins Lane Growers · sample records, not live sensors</p>
            </div>
          </div>
          <nav className="no-print flex gap-1 overflow-x-auto text-[13px] font-semibold">
            {[["overview", "Overview"], ["growth", "Growth"], ["collection", "Collection"], ["attention", `Attention (${openCount})`]].map(([id, l]) => (
              <button key={id} onClick={() => scrollTo(id)} data-testid={`nav-${id}`} className="rounded-full px-3 py-1.5 text-[#5A5A50] transition hover:bg-[#ECE7DA] hover:text-[#3A3A32]">{l}</button>
            ))}
          </nav>
          <button onClick={() => window.print()} data-testid="button-print" className="no-print inline-flex items-center gap-2 rounded-full bg-[#4F5E38] px-4 py-2 text-[13px] font-semibold text-[#F4F1E6] transition hover:-translate-y-px">
            <Printer className="h-4 w-4" /> Print report
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] space-y-5 px-4 py-6 sm:px-8 sm:py-8">
        <div id="overview" className="flex scroll-mt-24 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="rise">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9E5640]">Growth report</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.1]">{zoneLabel}, <span className="italic text-[#6B7B4F]">last {range} days</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">{rangeLabel} · sample dataset anchored to 30 May 2025</p>
          </div>
          <div className="no-print flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-1.5">
              <Pill active={zone === "all"} onClick={() => setZone("all")} testId="filter-zone-all">All zones</Pill>
              {ZONES.map((z) => <Pill key={z.id} active={zone === z.id} onClick={() => setZone(z.id)} testId={`filter-zone-${z.id}`}>{z.name}</Pill>)}
            </div>
            <div className="flex gap-1.5">
              {([7, 30, 90] as Range[]).map((r) => <Pill key={r} active={range === r} onClick={() => setRange(r)} testId={`filter-range-${r}`}>{r} days</Pill>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 min-[900px]:grid-cols-4 sm:gap-5">
          {kpis.map((k, i) => (
            <div key={k.label} className="card-earth rise p-5" style={{ animationDelay: `${i * 60}ms` }} data-testid={`kpi-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-muted-foreground">{k.label}</span>
                <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#EEF0E4]"><k.icon className="h-[18px] w-[18px] text-[#6B7B4F]" /></span>
              </div>
              <div className="mt-3 font-serif text-[32px] font-semibold leading-none tracking-tight">{k.value}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {"delta" in k && k.delta != null && (
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${k.delta >= 0 ? "bg-[#E7EDD9] text-[#4F5E38]" : "bg-[#F3E2DA] text-[#9E5640]"}`}>
                    {k.delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(k.delta).toFixed(1)}%
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{k.sub}{"delta" in k && k.delta != null ? " · vs prior period" : ""}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
          <Card id="growth" title="Canopy height by species" meta={`Count-weighted mean height, cm · ${rangeLabel} · tap species to compare`}
            actions={<CsvButton testId="export-species" onClick={() => downloadCsv(`greenhouse-003-species-height-${fileTag}.csv`, [["date", ...species], ...speciesSeries.map((r) => [r.date, ...species.map((s) => r[s] ?? "")])])} />}>
            <div className="no-print mb-3 flex flex-wrap gap-1.5">
              {species.map((s, i) => {
                const off = hidden.has(s);
                return (
                  <button key={s} data-testid={`toggle-species-${s}`} onClick={() => setShown(() => { const n = new Set(species.filter((x) => !hidden.has(x))); if (n.has(s)) n.delete(s); else n.add(s); return n; })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${off ? "border-[#E6E2D6] text-[#A3A396]" : "border-[#D8D3C3] bg-[#F4F1E6] text-[#3A3A32]"}`}>
                    <span className="h-2 w-2 rounded-[3px] transition" style={{ background: off ? "#D8D3C3" : SERIES[i % SERIES.length] }} />{s}
                  </button>
                );
              })}
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%" debounce={0}>
                <LineChart data={speciesSeries} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 12, fill: C.muted }} stroke={C.line} minTickGap={28} />
                  <YAxis tick={{ fontSize: 12, fill: C.muted }} stroke="transparent" unit=" cm" width={64} />
                  <Tooltip content={<TipBox />} cursor={{ stroke: C.light, strokeDasharray: "3 3" }} isAnimationActive={false} />
                  {species.map((s, i) => !hidden.has(s) && (
                    <Line key={s} dataKey={s} name={s} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, stroke: "#FCFAF4", strokeWidth: 2 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1">
            <Card title="Growth by zone" meta={`Mean cm gained per plant · ${range} days`}
              actions={<CsvButton testId="export-zones" onClick={() => downloadCsv(`greenhouse-003-zone-growth-${fileTag}.csv`, [["zone", "mean_growth_cm"], ...zoneBars.map((z) => [z.name, z.growth])])} />}>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%" debounce={0}>
                  <BarChart data={zoneBars} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.mid} /><stop offset="1" stopColor={C.light} /></linearGradient></defs>
                    <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="zone" tick={{ fontSize: 12, fill: C.muted }} stroke={C.line} />
                    <YAxis tick={{ fontSize: 12, fill: C.muted }} stroke="transparent" />
                    <Tooltip cursor={false} isAnimationActive={false} formatter={(v: number) => [`${v} cm`, "Growth"]} labelFormatter={(l, p) => p?.[0]?.payload?.name ?? l} contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, background: "#FCFAF4", fontSize: 13 }} />
                    <Bar dataKey="growth" fill="url(#bar)" radius={[9, 9, 9, 9]} maxBarSize={44} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Health mix" meta="Plants by current assessment"
              actions={<CsvButton testId="export-health" onClick={() => downloadCsv(`greenhouse-003-health-${zone}.csv`, [["status", "plants"], ...healthMix.map((h) => [h.name, h.value])])} />}>
              <div className="flex flex-col items-center gap-4 min-[480px]:flex-row">
                <div className="relative h-[150px] w-[150px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <PieChart>
                      <Pie data={healthMix} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} cornerRadius={4} stroke="none" isAnimationActive={false}>
                        {healthMix.map((h) => <Cell key={h.key} fill={HEALTH_META[h.key].color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div><div className="font-serif text-xl font-semibold">{kpi.total.toLocaleString()}</div><div className="text-[10px] text-muted-foreground">plants</div></div>
                  </div>
                </div>
                <ul className="w-full flex-1 space-y-2 text-sm">
                  {healthMix.map((h) => (
                    <li key={h.key}>
                      <button onClick={() => { setHealthF(h.key); scrollTo("collection"); }} data-testid={`link-health-${h.key}`} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-muted-foreground transition hover:bg-[#F1EDE2]">
                        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: HEALTH_META[h.key].color }} />{h.name}
                        <b className="ml-auto font-serif font-semibold text-foreground">{h.value}</b>
                        <span className="w-12 text-right text-xs">{kpi.total ? ((h.value / kpi.total) * 100).toFixed(1) : 0}%</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
          <Card title="Environmental conditions" meta={`Daily mean, ${zoneLabel.toLowerCase()} · sample readings`}
            actions={<CsvButton testId="export-env" onClick={() => downloadCsv(`greenhouse-003-environment-${fileTag}.csv`, [["date", "temp_c", "humidity_pct"], ...envSeries.map((e) => [e.date, e.temp, e.humidity])])} />}>
            <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Thermometer className="h-3.5 w-3.5 text-[#B9755A]" />Temperature °C</span>
              <span className="flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 text-[#6B7B4F]" />Relative humidity %</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {([["temp", C.clay, "°C", "envT"], ["humidity", C.moss, "%", "envH"]] as const).map(([k, col, u, gid]) => (
                <div key={k} className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <AreaChart data={envSeries} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity={0.35} /><stop offset="1" stopColor={col} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 12, fill: C.muted }} stroke={C.line} minTickGap={30} />
                      <YAxis domain={["dataMin - 2", "dataMax + 2"]} tickFormatter={(v: number) => v.toFixed(0)} tick={{ fontSize: 12, fill: C.muted }} stroke="transparent" />
                      <Tooltip content={<TipBox unit={u} />} cursor={{ stroke: C.light, strokeDasharray: "3 3" }} isAnimationActive={false} />
                      <Area dataKey={k} name={k === "temp" ? "Temperature" : "Humidity"} stroke={col} strokeWidth={1.8} fill={`url(#${gid})`} fillOpacity={1} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </Card>

          <Card id="attention" title="Needs attention" meta={`${openCount} open · completions saved on this device`}>
            {attention.length === 0 ? (
              <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-[#D8D3C3] p-8 text-center">
                <div><Leaf className="mx-auto h-6 w-6 text-[#A8B889]" /><p className="mt-2 font-serif text-lg">Nothing flagged here</p><p className="text-sm text-muted-foreground">Every batch in {zoneLabel.toLowerCase()} is on track.</p></div>
              </div>
            ) : (
              <ul className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
                {attention.map((a) => {
                  const done = care.log[a.id];
                  return (
                    <li key={a.id} data-testid={`attention-${a.id}`} className={`rounded-2xl border p-3.5 transition-all duration-300 ${done ? "border-[#E6E2D6] bg-[#F4F1E6] opacity-70" : a.severity === "stressed" ? "border-[#E8CDBF] bg-[#FBF3EE]" : "border-[#EADFC2] bg-[#FCF7EA]"}`}>
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? "bg-[#E7EDD9] text-[#4F5E38]" : a.severity === "stressed" ? "bg-[#F3E2DA] text-[#9E5640]" : "bg-[#FBF0D9] text-[#8A6B25]"}`}>
                          {done ? <Check className="h-4 w-4" /> : a.kind === "env" ? <Thermometer className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          {a.plant ? (
                            <button onClick={() => setSelected(a.plant!)} className="text-left text-sm font-bold hover:underline" data-testid={`open-attention-${a.id}`}>{a.title}</button>
                          ) : <p className="text-sm font-bold">{a.title}</p>}
                          <p className={`text-[13px] text-[#5A5A50] ${done ? "line-through" : ""}`}>{a.detail}</p>
                          <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-[#6B7B4F]">Care:</span> {a.action}</p>
                          {done && <p className="mt-1 text-xs text-[#4F5E38]">Done {format(new Date(done), "MMM d, HH:mm")}</p>}
                        </div>
                        {done ? (
                          <button onClick={() => care.undo(a.id)} data-testid={`undo-${a.id}`} className="no-print inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-[#ECE7DA]"><Undo2 className="h-3.5 w-3.5" />Undo</button>
                        ) : (
                          <button onClick={() => { care.complete(a.id); toast({ title: "Care logged", description: `${a.title}: ${a.action}` }); }} data-testid={`complete-${a.id}`} className="no-print shrink-0 rounded-full bg-[#6B7B4F] px-3 py-1.5 text-xs font-semibold text-[#F4F1E6] transition hover:-translate-y-px hover:bg-[#4F5E38]">Mark done</button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card id="collection" title="Plant collection" meta={`${rows.length} of ${plants.length} batches · growth over last ${range} days`}
          actions={<>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search variety, code, stage" data-testid="input-search"
                className="w-56 rounded-full border border-[#E6E2D6] bg-background py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#A8B889] focus:ring-2 focus:ring-[#A8B889]/30" />
            </div>
            <select value={healthF} onChange={(e) => setHealthF(e.target.value as Health | "all")} data-testid="select-health" className="rounded-full border border-[#E6E2D6] bg-background px-3 py-1.5 text-sm font-semibold outline-none focus:border-[#A8B889]">
              <option value="all">All health</option><option value="thriving">Thriving</option><option value="watch">Watch</option><option value="stressed">Stressed</option>
            </select>
            <CsvButton testId="export-table" onClick={() => downloadCsv(`greenhouse-003-collection-${fileTag}.csv`, [["code", "species", "variety", "zone", "stage", "plants", "sown", "height_cm", `growth_${range}d_cm`, "health", "issue"], ...rows.map(({ p, growth, height }) => [p.code, p.species, p.variety, zoneName(p.zone), p.stage, p.count, p.sownOn, height, growth.toFixed(1), HEALTH_META[p.health].label, p.issue ?? ""])])} />
          </>}>
          <div className="fade-x overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                  {([["name", "Batch"], [null, "Zone"], [null, "Stage"], ["count", "Plants"], ["height", "Height"], ["growth", `Growth ${range}d`], [null, "Trend"], [null, "Health"]] as const).map(([k, l]) => (
                    <th key={l} className="border-b border-[#E6E2D6] px-3 py-2.5 font-bold">
                      {k ? <button onClick={() => toggleSort(k)} data-testid={`sort-${k}`} className="inline-flex items-center gap-1 uppercase hover:text-foreground">{l}{sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button> : l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, growth, height }) => (
                  <tr key={p.id} onClick={() => setSelected(p)} data-testid={`row-plant-${p.id}`} className="group cursor-pointer border-b border-[#F0EDE2] transition-colors last:border-0 hover:bg-[#F4F1E6]">
                    <td className="px-3 py-2.5"><div className="font-semibold group-hover:text-[#4F5E38]">{p.species} <span className="font-normal text-muted-foreground">{p.variety}</span></div><div className="font-mono text-[11px] text-muted-foreground">{p.code}</div></td>
                    <td className="px-3 py-2.5 text-[#5A5A50]">{zoneName(p.zone)}</td>
                    <td className="px-3 py-2.5 text-[#5A5A50]">{p.stage}</td>
                    <td className="px-3 py-2.5 font-serif font-semibold">{p.count}</td>
                    <td className="px-3 py-2.5 font-serif font-semibold">{height.toFixed(1)} cm</td>
                    <td className="px-3 py-2.5 font-bold text-[#4F5E38]">+{growth.toFixed(1)} cm</td>
                    <td className="w-28 px-3 py-1">
                      <div className="h-8 w-24"><ResponsiveContainer width="100%" height="100%" debounce={0}><LineChart data={p.heights.slice(start).map((v) => ({ v }))}><Line dataKey="v" stroke={HEALTH_META[p.health].color} strokeWidth={1.6} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
                    </td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${HEALTH_META[p.health].cls}`}>{HEALTH_META[p.health].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-serif text-lg">No batches match</p>
                <button onClick={() => { setSearch(""); setHealthF("all"); }} data-testid="button-clear-filters" className="mt-2 text-sm font-semibold text-[#6B7B4F] underline-offset-4 hover:underline">Clear search and health filter</button>
              </div>
            )}
          </div>
        </Card>
        <p className="pb-4 text-center text-xs text-muted-foreground">Greenhouse #003 demo · all figures generated from a fixed sample collection of {data.plants.length} batches. No sensors are connected.</p>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-[22px] border-[#E6E2D6] bg-[#FCFAF4]">
          {selected && (() => {
            const p = selected;
            const f = Math.max(firstIdx(p), 0);
            const series = p.heights.slice(f).map((h, i) => ({ date: iso(dateAt(f + i)), height: h }));
            const rangeStart = iso(dateAt(Math.max(start, f)));
            return (
              <>
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{p.code}</span><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${HEALTH_META[p.health].cls}`}>{HEALTH_META[p.health].label}</span><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#9E5640]">Demo</span></div>
                  <DialogTitle className="font-serif text-2xl font-semibold">{p.species} <span className="italic text-[#6B7B4F]">{p.variety}</span></DialogTitle>
                  <DialogDescription>{zoneName(p.zone)} · {p.stage} · {p.count} plants · sown {format(parseLocal(p.sownOn), "MMM d, yyyy")}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-2">
                  {[["Height today", `${p.heights[last].toFixed(1)} cm`], [`Growth ${range}d`, `+${growthBetween(p, start, last).toFixed(1)} cm`], ["Last 7d rate", `${(growthBetween(p, last - 7, last) / 7).toFixed(2)} cm/d`]].map(([l, v]) => (
                    <div key={l} className="rounded-2xl bg-[#F1EDE2] p-3"><div className="text-[11px] font-semibold text-muted-foreground">{l}</div><div className="font-serif text-lg font-semibold">{v}</div></div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold">Growth history</h4>
                  <CsvButton testId="export-plant" onClick={() => downloadCsv(`greenhouse-003-${p.code}-history.csv`, [["date", "height_cm"], ...series.map((s) => [s.date, s.height])])} />
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <defs><linearGradient id="pd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.light} stopOpacity={0.55} /><stop offset="1" stopColor={C.light} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false} />
                      <ReferenceArea x1={rangeStart} x2={series[series.length - 1].date} fill="#EEF0E4" fillOpacity={0.6} />
                      <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 12, fill: C.muted }} stroke={C.line} minTickGap={30} />
                      <YAxis tick={{ fontSize: 12, fill: C.muted }} stroke="transparent" />
                      <Tooltip content={<TipBox />} cursor={{ stroke: C.light, strokeDasharray: "3 3" }} isAnimationActive={false} />
                      <Area dataKey="height" name="Height" stroke={C.moss} strokeWidth={2} fill="url(#pd)" fillOpacity={1} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="-mt-2 text-[11px] text-muted-foreground">Shaded band marks the selected {range}-day window.</p>
                {p.issue && (
                  <div className="rounded-2xl border border-[#E8CDBF] bg-[#FBF3EE] p-3 text-sm">
                    <p className="font-bold text-[#9E5640]">{p.issue}</p>
                    <p className="text-[#5A5A50]">{p.careAction}</p>
                    {care.log[`care-${p.id}`] ? (
                      <button onClick={() => care.undo(`care-${p.id}`)} data-testid="dialog-undo-care" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#4F5E38]"><Check className="h-3.5 w-3.5" />Done {format(new Date(care.log[`care-${p.id}`]), "MMM d, HH:mm")} · undo</button>
                    ) : (
                      <button onClick={() => { care.complete(`care-${p.id}`); toast({ title: "Care logged", description: p.careAction }); }} data-testid="dialog-complete-care" className="mt-2 rounded-full bg-[#6B7B4F] px-3 py-1.5 text-xs font-semibold text-[#F4F1E6]">Mark care done</button>
                    )}
                  </div>
                )}
                <div>
                  <h4 className="mb-2 text-sm font-bold">Observations</h4>
                  <ol className="relative space-y-2 border-l border-[#D8D3C3] pl-4">
                    {p.observations.map((o) => (
                      <li key={o.date} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#A8B889]" /><span className="mr-2 font-mono text-xs text-muted-foreground">{format(parseLocal(o.date), "MMM d")}</span>{o.note}</li>
                    ))}
                  </ol>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
