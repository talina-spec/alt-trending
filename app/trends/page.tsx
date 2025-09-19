"use client";
import React, { useEffect, useState } from "react";

type YT = { id: string; snippet: any; statistics?: any; contentDetails?: any };
const durSec = (iso: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0);
};

export default function TrendsScreen() {
  const [region] = useState("RU");
  const [videos, setVideos] = useState<YT[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [likes, setLikes] = useState<Record<string, boolean>>({});
  useEffect(() => { try { const raw = localStorage.getItem("yt_likes"); if (raw) setLikes(JSON.parse(raw)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("yt_likes", JSON.stringify(likes)); } catch {} }, [likes]);

  const buildURL = (t?: string) => {
    const p = new URLSearchParams({ region });
    if (t) p.set("pageToken", t);
    return `/api/trending?` + p.toString();
  };

  const fetchBatch = async (fresh = false) => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(buildURL(fresh ? undefined : token || undefined));
      const data = await res.json();
      if (!res.ok || data.error) setErr((data?.error?.message || data?.error || "Ошибка запроса").toString());
      else {
        const items: YT[] = (data.items || []).map((v: any) => ({
          id: v.id, snippet: v.snippet, statistics: v.statistics, contentDetails: v.contentDetails,
        })).filter((v: any) => {
          const s = durSec(v.contentDetails?.duration || ""); return s === 0 || s >= 60;
        });
        setVideos(prev => fresh ? items : [...prev, ...items]);
        setToken(data.nextPageToken || null);
        if (fresh) setI(0);
      }
    } catch (e: any) { setErr(e?.message || "Не удалось загрузить"); }
    setLoading(false);
  };

  useEffect(() => { if (videos.length === 0) fetchBatch(true); /* eslint-disable-line */ }, []);
  const current = videos[i];
  const nextVideo = async () => {
    if (i < videos.length - 1) { setI(i + 1); return; }
    if (token) { await fetchBatch(false); setI(prev => Math.min(prev + 1, videos.length)); }
  };
  const toggleLike = () => { if (!current) return; setLikes(l => ({ ...l, [current.id]: !l[current.id] })); };

  return (
    <div className="min-h-[100svh] relative overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(60% 40% at 0% 20%, rgba(255,200,210,.9), transparent 60%)," +
          "radial-gradient(70% 60% at 100% 10%, rgba(30,70,200,1), rgba(9,9,18,.95) 70%)," +
          "radial-gradient(60% 50% at 20% 100%, rgba(120,60,180,.9), transparent 60%)",
        backgroundColor: "#0a0a12",
      }}>
      <div className="pt-6 text-center select-none">
        <div className="text-5xl tracking-widest font-black mx-auto"
          style={{background:"linear-gradient(180deg,#fff,#dcdcdc 30%,#9aa1a6 60%,#fff 85%)",
                  WebkitBackgroundClip:"text",color:"transparent",
                  textShadow:"0 2px 0 rgba(0,0,0,.25),0 0 8px rgba(255,255,255,.35)"}}>
          TRENDS
        </div>
      </div>

      <div className="mx-5 mt-6 rounded-[28px] bg-white/90 text-black p-3 shadow-2xl"
           style={{ height:"70vh", backdropFilter:"saturate(1.1) blur(2px)" }}>
        {!current ? (
          <div className="w-full h-full flex items-center justify-center">
            <button onClick={()=>fetchBatch(true)} disabled={loading}
              className="h-11 px-6 rounded-xl bg-black text-white">
              {loading ? "Загрузка…" : "Загрузить тренды"}
            </button>
            {err && <div className="absolute bottom-4 left-0 right-0 text-center text-red-600 text-sm">{err}</div>}
          </div>
        ) : (
          <a href={`https://www.youtube.com/watch?v=${current.id}`} target="_blank" rel="noreferrer"
             className="block w-full h-full rounded-[22px] overflow-hidden relative">
            <img src={current.snippet?.thumbnails?.maxres?.url
                        || current.snippet?.thumbnails?.high?.url
                        || current.snippet?.thumbnails?.medium?.url}
                 alt={current.snippet?.title} className="w-full h-3/5 object-cover"/>
            <div className="p-4">
              <div className="text-lg font-semibold leading-tight line-clamp-3">{current.snippet?.title}</div>
              <div className="text-sm text-neutral-600 mt-1">{current.snippet?.channelTitle}</div>
            </div>
            <div className="absolute inset-0 rounded-[22px] ring-1 ring-black/5 pointer-events-none" />
          </a>
        )}
      </div>

      <button onClick={toggleLike} className="absolute left-10 bottom-24 active:scale-95 transition-transform" aria-label="Лайк">
        <svg viewBox="0 0 100 100" width="84" height="84">
          <defs>
            <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff"/><stop offset="40%" stopColor="#cfd3d6"/>
              <stop offset="70%" stopColor="#8f969c"/><stop offset="100%" stopColor="#fff"/>
            </linearGradient>
            <filter id="glow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,.35)"/></filter>
          </defs>
          <path d="M50 6 L58 36 L92 50 L58 64 L50 94 L42 64 L8 50 L42 36 Z"
                fill="url(#metal)" filter="url(#glow)"
                stroke={likes[current?.id || ""] ? "#00ff7f" : "#b6bcc1"} strokeWidth="2"/>
        </svg>
      </button>

      <button onClick={async()=>{document.getElementById("dice")?.animate(
                [{transform:"rotate(0deg)"},{transform:"rotate(360deg)"}],{duration:350}); await nextVideo();}}
              className="absolute right-10 bottom-16 active:scale-95 transition-transform" aria-label="Следующее видео">
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
        ⭐ лайк • 🎲 следующее • тап по «экрану» — открыть видео
      </div>
    </div>
  );
}
