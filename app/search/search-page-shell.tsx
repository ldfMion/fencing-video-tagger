"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  Play,
  Search,
  Swords,
  VideoOff,
  X,
} from "lucide-react";
import { AppearanceMenu } from "@/components/appearance-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TouchReplay } from "@/app/search/touch-replay";
import { ACTION_CODES, MATCH_PERIODS, STRIP_ZONES, type ActionCode, type MatchPeriod, type MistakeType, type StripZone } from "@/lib/types";
import type { CommentSearchInput, CommentSearchResult } from "@/lib/comment-search";
import { searchComments } from "@/lib/server/comment-search-service";
import { STRIP_ZONE_FLEX_WEIGHTS, STRIP_ZONE_LABELS } from "@/lib/tagging";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

interface Filters {
  fencers: string[];
  actions: ActionCode[];
  mistakes: MistakeType[];
  periods: MatchPeriod[];
  stripZones: StripZone[];
  dateFrom: string;
  dateTo: string;
  includeWithoutReplay: boolean;
}

interface SearchPageShellProps {
  initialParams: Record<string, string | string[] | undefined>;
  fencers: string[];
}

function getAll(params: SearchPageShellProps["initialParams"], key: string): string[] {
  const value = params[key];
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function getOne(params: SearchPageShellProps["initialParams"], key: string): string {
  return getAll(params, key)[0] ?? "";
}

function initialFilters(params: SearchPageShellProps["initialParams"]): Filters {
  return {
    fencers: getAll(params, "fencer"),
    actions: getAll(params, "action").filter((value): value is ActionCode => ACTION_CODES.includes(value as ActionCode)),
    mistakes: getAll(params, "mistake").filter((value): value is MistakeType => value === "tactical" || value === "execution"),
    periods: getAll(params, "period").filter((value): value is MatchPeriod => MATCH_PERIODS.includes(value as MatchPeriod)),
    stripZones: getAll(params, "zone").filter((value): value is StripZone => STRIP_ZONES.includes(value as StripZone)),
    dateFrom: getOne(params, "from"),
    dateTo: getOne(params, "to"),
    includeWithoutReplay: getOne(params, "include") === "all",
  };
}

function hasFilters(filters: Filters) {
  return filters.fencers.length > 0 || filters.actions.length > 0 || filters.mistakes.length > 0 ||
    filters.periods.length > 0 || filters.stripZones.length > 0 || Boolean(filters.dateFrom || filters.dateTo) ||
    filters.includeWithoutReplay;
}

function toSearchInput(query: string, filters: Filters, offset = 0): CommentSearchInput {
  return {
    query,
    filters: {
      fencers: filters.fencers,
      actions: filters.actions,
      mistakes: filters.mistakes,
      periods: filters.periods,
      stripZones: filters.stripZones,
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
      includeWithoutReplay: filters.includeWithoutReplay,
    },
    limit: PAGE_SIZE,
    offset,
  };
}

export function SearchPageShell({ initialParams, fencers }: SearchPageShellProps) {
  const router = useRouter();
  const initialQuery = getOne(initialParams, "q").trim();
  const startingFilters = initialFilters(initialParams);
  const initialSelectedId = getOne(initialParams, "selected");
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(startingFilters);
  const [results, setResults] = useState<CommentSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [semanticFallback, setSemanticFallback] = useState(false);
  const [hasApplied, setHasApplied] = useState(Boolean(initialQuery || hasFilters(startingFilters)));
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  const updateUrl = useCallback((query: string, nextFilters: Filters, nextSelected = selectedId) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    nextFilters.fencers.forEach((value) => params.append("fencer", value));
    nextFilters.actions.forEach((value) => params.append("action", value));
    nextFilters.mistakes.forEach((value) => params.append("mistake", value));
    nextFilters.periods.forEach((value) => params.append("period", value));
    nextFilters.stripZones.forEach((value) => params.append("zone", value));
    if (nextFilters.dateFrom) params.set("from", nextFilters.dateFrom);
    if (nextFilters.dateTo) params.set("to", nextFilters.dateTo);
    if (nextFilters.includeWithoutReplay) params.set("include", "all");
    if (nextSelected) params.set("selected", nextSelected);
    router.replace(params.size ? `/search?${params.toString()}` : "/search", { scroll: false });
  }, [router, selectedId]);

  const runSearch = useCallback((query: string, nextFilters: Filters, append = false) => {
    const currentRequest = ++requestId.current;
    const offset = append ? results.length : 0;
    setHasApplied(Boolean(query || hasFilters(nextFilters)));
    if (!append) setResults([]);
    setError(null);
    setSemanticFallback(false);
    startTransition(async () => {
      try {
        let response;
        try {
          response = await searchComments(toSearchInput(query, nextFilters, offset));
        } catch (semanticError) {
          if (!query) throw semanticError;
          response = await searchComments(toSearchInput("", nextFilters, offset));
          setSemanticFallback(true);
          setError("Semantic search is unavailable. Showing structured filter matches. Provision the local embedding model with `pnpm embeddings:provision` to enable text search.");
        }
        if (currentRequest !== requestId.current) return;
        setResults((current) => append ? [...current, ...response.results] : response.results);
        setHasMore(response.hasMore);
      } catch (searchError) {
        if (currentRequest !== requestId.current) return;
        setResults([]);
        setHasMore(false);
        setError(searchError instanceof Error ? searchError.message : "Search could not be completed.");
      }
    });
  }, [results.length]);

  useEffect(() => {
    if (initialQuery || hasFilters(startingFilters)) runSearch(initialQuery, startingFilters);
    // Initial URL state is intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (nextFilters: Filters) => {
    setFilters(nextFilters);
    setSelectedId("");
    updateUrl(submittedQuery, nextFilters, "");
    runSearch(submittedQuery, nextFilters);
  };

  const submitQuery = () => {
    const query = draftQuery.trim();
    setSubmittedQuery(query);
    setSelectedId("");
    updateUrl(query, filters, "");
    if (query || hasFilters(filters)) runSearch(query, filters);
    else {
      requestId.current += 1;
      setHasApplied(false);
      setResults([]);
      setError(null);
    }
  };

  const selected = results.find((result) => `${result.boutId}:${result.tagId}` === selectedId);
  const chooseResult = (result: CommentSearchResult) => {
    if (!result.replayAvailable) return;
    const id = `${result.boutId}:${result.tagId}`;
    setSelectedId(id);
    updateUrl(submittedQuery, filters, id);
  };
  const closeReplay = () => {
    setSelectedId("");
    updateUrl(submittedQuery, filters, "");
  };

  return (
    <div className="app-canvas min-h-screen bg-background">
      <header className="border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="brand-mark"><Swords className="h-4 w-4" /></span>
            <div><span className="block text-sm font-semibold">Piste</span><span className="block text-[10px] text-muted-foreground">Touch search</span></div>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="h-4 w-4" /> Library</Link></Button>
            <AppearanceMenu compact />
          </div>
        </div>
      </header>

      <main className={cn("mx-auto max-w-[1500px] px-4 transition-[padding] duration-300 ease-out sm:px-8", hasApplied ? "py-4" : "flex min-h-[calc(100vh-4rem)] items-start justify-center pt-[16vh]")}>
        <div className="w-full">
          <section className={cn(hasApplied && "sticky top-0 z-30 -mx-4 animate-in border-b bg-background/90 px-4 py-3 fade-in slide-in-from-top-2 duration-300 backdrop-blur-xl sm:-mx-8 sm:px-8")}>
            <div className={cn("mx-auto", hasApplied ? "max-w-[1500px]" : "max-w-3xl text-center")}>
              {!hasApplied && <div className="mb-8"><p className="eyebrow">Touch search</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Find the moment that matters.</h1><p className="mt-3 text-sm text-muted-foreground">Search your tagged touches by meaning, fencer, action, mistake, or date.</p></div>}
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); submitQuery(); }}>
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Describe a touch, tactic, or situation…" className="h-11 pl-10" /></div>
                <Button type="submit" className="h-11 px-5" disabled={isPending} aria-label="Search touches"><Search className="h-4 w-4" /><span className="hidden sm:inline">Search</span></Button>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MultiSelect label="Fencer" values={filters.fencers} options={fencers} onChange={(values) => applyFilters({ ...filters, fencers: values })} searchable />
                <MultiSelect label="Action" values={filters.actions} options={[...ACTION_CODES]} onChange={(values) => applyFilters({ ...filters, actions: values as ActionCode[] })} searchable />
                <MultiSelect label="Mistake" values={filters.mistakes} options={["tactical", "execution"]} onChange={(values) => applyFilters({ ...filters, mistakes: values as MistakeType[] })} />
                <DateFilter filters={filters} onChange={applyFilters} />
                <MoreFilters filters={filters} onChange={applyFilters} />
                <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <input type="checkbox" checked={filters.includeWithoutReplay} onChange={(event) => applyFilters({ ...filters, includeWithoutReplay: event.target.checked })} className="accent-primary" />
                  Include touches without replay
                </label>
              </div>
            </div>
          </section>

          {hasApplied && <div className={cn("grid gap-5 pt-5", selected ? "lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]" : "grid-cols-1")}>
            <section className="min-w-0">
              {error && <div className="mb-4 flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p>{error}</p></div>}
              <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">{isPending && results.length === 0 ? "Searching…" : `${results.length}${hasMore ? "+" : ""} touch${results.length === 1 ? "" : "es"}`}</p><p className="text-xs text-muted-foreground">{submittedQuery && !semanticFallback ? "Sorted by relevance" : "Newest first"}</p></div>
              {isPending && results.length === 0 ? <ResultsSkeleton /> : !isPending && results.length === 0 ? <div className="animate-in rounded-xl border border-dashed py-20 text-center fade-in duration-300"><Search className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-4 text-base font-medium">No touches found</h2><p className="mt-1 text-sm text-muted-foreground">No tagged touches match this search.</p></div> :
                <div className="animate-in overflow-hidden rounded-xl border bg-card/45 fade-in slide-in-from-bottom-3 duration-300">{results.map((result) => <ResultRow key={`${result.boutId}:${result.tagId}`} result={result} selected={`${result.boutId}:${result.tagId}` === selectedId} onClick={() => chooseResult(result)} />)}</div>}
              {hasMore && <div className="mt-5 text-center"><Button variant="outline" disabled={isPending} onClick={() => runSearch(submittedQuery, filters, true)}>Load more</Button></div>}
            </section>
            {selected && <TouchReplay result={selected} onClose={closeReplay} />}
          </div>}
        </div>
      </main>
    </div>
  );
}

function ResultsSkeleton() {
  return <div className="animate-in overflow-hidden rounded-xl border bg-card/35 fade-in duration-200">{Array.from({ length: 4 }, (_, index) => <div key={index} className="border-b p-4 last:border-b-0"><div className="h-4 w-48 animate-pulse rounded bg-muted" /><div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-muted/80" /><div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted/70" /></div>)}</div>;
}

function MultiSelect({ label, values, options, onChange, searchable = false }: { label: string; values: string[]; options: string[]; onChange: (values: string[]) => void; searchable?: boolean }) {
  const [search, setSearch] = useState("");
  const shown = searchable ? options.filter((option) => option.toLowerCase().includes(search.toLowerCase())) : options;
  return <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn(values.length > 0 && "border-primary/40 text-foreground")}>{label}{values.length > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5">{values.length}</Badge>}<ChevronDown className="h-3 w-3 opacity-50" /></Button></PopoverTrigger><PopoverContent align="start" className="w-64 p-2">{searchable && <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} aria-label={`Search ${label.toLowerCase()}`} className="mb-2 h-8" />}<div className="max-h-64 overflow-y-auto">{shown.map((option) => { const checked = values.includes(option); return <button type="button" key={option} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent" onClick={() => onChange(checked ? values.filter((value) => value !== option) : [...values, option])}><span className={cn("flex h-4 w-4 items-center justify-center rounded border", checked && "border-primary bg-primary text-primary-foreground")}>{checked && <Check className="h-3 w-3" />}</span><span className="truncate">{option}</span></button>; })}</div>{shown.length === 0 && <p className="px-2 py-6 text-center text-muted-foreground">No {label.toLowerCase()}s found</p>}{values.length > 0 && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}><X className="h-3.5 w-3.5" />Clear</Button>}</PopoverContent></Popover>;
}

function DateFilter({ filters, onChange }: { filters: Filters; onChange: (filters: Filters) => void }) {
  const active = Boolean(filters.dateFrom || filters.dateTo);
  return <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn(active && "border-primary/40")}>Date{active && <Badge variant="secondary" className="ml-1 h-5 px-1.5">1</Badge>}<ChevronDown className="h-3 w-3 opacity-50" /></Button></PopoverTrigger><PopoverContent align="start" className="w-72"><label className="grid gap-1"><span className="text-muted-foreground">From</span><Input type="date" value={filters.dateFrom} onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })} /></label><label className="grid gap-1"><span className="text-muted-foreground">To</span><Input type="date" value={filters.dateTo} onChange={(event) => onChange({ ...filters, dateTo: event.target.value })} /></label></PopoverContent></Popover>;
}

function MoreFilters({ filters, onChange }: { filters: Filters; onChange: (filters: Filters) => void }) {
  const count = filters.periods.length + filters.stripZones.length;
  return <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn(count > 0 && "border-primary/40")}>More filters{count > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{count}</Badge>}<ChevronDown className="h-3 w-3 opacity-50" /></Button></PopoverTrigger><PopoverContent align="start" className="w-80"><div><p className="mb-1.5 font-medium">Period</p><div className="flex flex-wrap gap-1">{MATCH_PERIODS.map((value) => <Button key={value} type="button" size="sm" variant={filters.periods.includes(value) ? "default" : "outline"} onClick={() => onChange({ ...filters, periods: filters.periods.includes(value) ? filters.periods.filter((item) => item !== value) : [...filters.periods, value] })}>{value === "priority" ? "Priority" : `P${value}`}</Button>)}</div></div><div className="mt-1.5 rounded-lg border bg-muted/20 p-2"><div className="mb-1.5 flex items-center justify-between gap-2"><p className="font-medium">Strip zone</p><span className="text-[11px] text-muted-foreground">Left to right</span></div><div className="overflow-hidden rounded-md border border-input bg-background"><div className="flex">{STRIP_ZONES.map((value, index) => { const selected = filters.stripZones.includes(value); return <button key={value} type="button" aria-pressed={selected} style={{ flex: STRIP_ZONE_FLEX_WEIGHTS[index] }} className={cn("flex h-11 min-w-0 items-center justify-center whitespace-normal border-r border-input px-1 text-center text-[9px] font-medium leading-tight transition-colors last:border-r-0", selected ? "bg-primary text-primary-foreground" : "hover:bg-muted")} onClick={() => onChange({ ...filters, stripZones: selected ? filters.stripZones.filter((item) => item !== value) : [...filters.stripZones, value] })}>{STRIP_ZONE_LABELS[value]}</button>; })}</div></div></div></PopoverContent></Popover>;
}

function ResultRow({ result, selected, onClick }: { result: CommentSearchResult; selected: boolean; onClick: () => void }) {
  const fencers = result.taggedFencer ? <><span className="font-medium">{result.taggedFencer}</span>{result.opponent && <span className="text-muted-foreground"> vs {result.opponent}</span>}</> : <span className="font-medium">{[result.leftFencer, result.rightFencer].filter(Boolean).join(" vs ") || "Unknown fencers"}</span>;
  return <button type="button" disabled={!result.replayAvailable} onClick={onClick} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b p-4 text-left last:border-b-0", result.replayAvailable ? "hover:bg-accent/45" : "cursor-default opacity-70", selected && "bg-accent/65")}><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">{fencers}{result.action && <Badge variant="outline">{result.action}</Badge>}{result.mistake && <Badge variant="outline" className="capitalize">{result.mistake}</Badge>}</div><p className="mt-2 truncate text-sm text-muted-foreground">{result.comment || "No comment"}</p><p className="mt-2 text-xs text-muted-foreground">{result.boutDate || "Date unknown"}{result.period && ` · Period ${result.period}`}{result.matchClock && ` · ${result.matchClock}`}</p></div><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{result.replayAvailable ? <><Play className="h-3.5 w-3.5" /> Replay</> : <><VideoOff className="h-3.5 w-3.5" /> No replay</>}</div></button>;
}
