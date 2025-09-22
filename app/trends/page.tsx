/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useMemo, useState } from "react";

type YT = { id: string; snippet: any; statistics?: any; contentDetails?: any };

const dur = (iso?: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  return (+(m?.[1] || 0)) * 3600 + (+(m?.[2] || 0)) * 60 + (+(m?.[3] || 0));
};

const guessRegion = () => {
  try {
    const lang = navigator.language || (Intl as any)?.DateTimeFormat?.().resolvedOptions?.().locale || "en-US";
    const code = String(lang).split(/[-_]/).pop() || "US";
    return code.toUpperCase();
  } catch { return "US"; }
};

function useSeen() {
  const key = "yt_seen_v1";
  const [seen, setSeen] = useState<Record<string, true>>({});
  useEffect(() => { try { const r = localStorage.getItem(key); if (r) setSeen(JSON.parse(r)); } catch {} }, []);
  const mark = (id: string) => setSeen(s => {
    if (s[id]) return s;
    const n = { ...s, [id]: true }; try { localStorage.setItem(key, JSON.stringify(n)); } catch {} return n;
  });
  const reset = () => { setSeen({}); try { localStorage.removeItem(key); } catch {} };
  return { seen, mark, reset };
}

export default function TrendsPage() {
  const initialRegion = useMemo(() => {
    const urlRegion = new URLSearchParams(window.location.search).get("region");
    if (urlRegion) return urlRegion.toUpperCase();
    const ls = localStorage.getItem("tr_region");
    if (ls) return ls.toUpperCase();
    return guessRegion();
  }, []);

  const [region, setRegion] = useState(initialRegion);
  const [videos, setVideos] = useState<YT[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [loading, setL] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { seen, mark, reset } = useSeen();

  const api = (t?: string) => {
    const p = new URLSearchParams({ region, days: "14", maxViews: "200000" });
    if (t) p.set("pageToken", t);
    return "/api/trending?" + p.toString();
  };

  const filterClient = (arr: YT[]) =>
    arr.filter(v => {
      if (seen[v.id]) return false;                 // уже просмотренные
      const s = dur(v.contentDetails?.duration || ""); // шорты
      return s === 0 || s >= 60;
    });

  const fetchBatch = async (fresh = false) => {
    setL(true); setErr(null);
    try {
      const r = await fetch(api(fresh ? undefined : token || undefined), { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || d.error) setErr((d?.error?.message || d?.error || "Ошибка запроса").toString());
      else {
        const items: YT[] = (d.items || []).map((v: any) => ({
          id: v.id, snippet: v.snippet, statistics: v.statistics, contentDetails: v.contentDetails
        }));
        const cleaned = filterClient(items);
        setVideos(prev => fresh ? cleaned : [...prev, ...cleaned]);
        setToken(d.nextPageToken || null);
        if (fresh) setI(0);
      }
    } catch (e: any) { setErr(e?.message || "Не удалось загрузить"); }
    setL(false);
  };

  useEffect(() => { if (videos.length === 0) fetchBatch(true); /* eslint-disable-line */ }, [region]);

  useEffect(() => {  // если текущий внезапно оказался скрытым — пролистываем
    if (videos[i] && seen[videos[i].id]) setI(prev => Math.min(prev + 1, videos.length - 1));
  }, [seen, videos, i]);

  const cur = videos[i];

  const next = async () => {
    if (i < videos.length - 1) { setI(i + 1); return; }
    if (token) { await fetchBatch(false); setI(prev => Math.min(prev + 1, videos.length)); }
  };

  const changeRegion = async () => {
    const r = prompt("Регион (две буквы ISO 3166-1: US, RU, DE…):", region);
    if (!r) return;
    const nr = r.trim().toUpperCase();
    setRegion(nr);
    localStorage.setItem("tr_region", nr);
    setVideos([]); setToken(null); setI(0);
    await fetchBatch(true);
  };

  const openVideo = () => { if (cur) mark(cur.id); };

  return (
    <div className="min-h-[100svh] relative overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(60% 40% at 0% 20%, rgba(255,200,210,.9), transparent 60%)," +
          "radial-gradient(70% 60% at 100% 10%, rgba(30,70,200,1), rgba(9,9,18,.95) 70%)," +
          "radial-gradient(60% 50% at 20% 100%, rgba(120,60,180,.9), transparent 60%)",
        backgroundColor: "#0a0a12",
      }}>
      {/* Шапка */}
      <div className="pt-6 text-center select-none">
        <div className="text-5xl tracking-widest font-black mx-auto"
          style={{background:"linear-gradient(180deg,#fff,#dcdcdc 30%,#9aa1a6 60%,#fff 85%)",
                  WebkitBackgroundClip:"text",color:"transparent",
                  textShadow:"0 2px 0 rgba(0,0,0,.25),0 0 8px rgba(255,255,255,.35)"}}>
          TRENDS
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs">
          <button onClick={changeRegion} className="px-3 py-1.5 rounded-full bg-white/15 ring-1 ring-white/25">
            REGION: <b>{region}</b> ✎
          </button>
          <button onClick={reset} className="px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/20">
            Сбросить скрытые
          </button>
        </div>
      </div>

      {/* Карточка видео */}
      <div className="mx-5 mt-6 rounded-[28px] bg-white/90 text-black p-3 shadow-2xl"
           style={{ height:"70vh", backdropFilter:"saturate(1.1) blur(2px)" }}>
        {!cur ? (
          <div className="w-full h-full flex items-center justify-center">
            <button onClick={()=>fetchBatch(true)} disabled={loading} className="h-11 px-6 rounded-xl bg-black text-white">
              {loading ? "Загрузка…" : "Загрузить тренды"}
            </button>
            {err && <div className="absolute bottom-4 left-0 right-0 text-center text-red-600 text-sm">{err}</div>}
          </div>
        ) : (
          <a href={`https://www.youtube.com/watch?v=${cur.id}`} target="_blank" rel="noreferrer"
             onClick={openVideo}
             className="block w-full h-full rounded-[22px] overflow-hidden relative">
            <img
              src={cur.snippet?.thumbnails?.maxres?.url
                    || cur.snippet?.thumbnails?.high?.url
                    || cur.snippet?.thumbnails?.medium?.url}
              alt={cur.snippet?.title}
              className="w-full h-3/5 object-cover" />
            <div className="p-4">
              <div className="text-lg font-semibold leading-tight">{cur.snippet?.title}</div>
              <div className="text-sm text-neutral-600 mt-1">{cur.snippet?.channelTitle}</div>
            </div>
            <div className="absolute inset-0 rounded-[22px] ring-1 ring-black/5 pointer-events-none" />
          </a>
        )}
      </div>

      {/* Управление */}
      <button onClick={async()=>{document.getElementById("dice")?.animate(
               [{transform:"rotate(0deg)"},{transform:"rotate(360deg)"}],{duration:350}); await next();}}
              className="absolute right-10 bottom-16 active:scale-95 transition-transform" aria-label="Следующее">
        <svg id="dice" viewBox="0 0 100 100" width="110" height="110">
          <defs>
            <linearGradient id="red" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff4d4d"/><stop offset="70%" stopColor="#a40000"/><stop offset="100%" stopColor="#6e0000"/>
            </linearGradient>
            <filter id="dshadow"><feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="rgba(0,0,0,.45)"/></filter>
          </defs>
          <rect x="15" y="15" width="70" height="70" rx="10" fill="url(#red)" filter="url(#dshadow)" stroke="#3b0000" strokeWidth="2"/>
          {[[30,30],[50,30],[70,30],[30,50],[50,50],[70,50]].map(([x,y],k)=>(<circle key={k} cx={x} cy={y} r="5.5" fill="#fff"/>))}
        </svg>
      </button>

      <div className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-xs">
        ⭐ уже просмотренные скрываются • 🎲 следующее • REGON — смена страны
      </div>
    </div>
  );
}
