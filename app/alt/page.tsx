"use client";
import React, { useEffect, useMemo, useState } from "react";

/** helpers **/
const fmt = new Intl.NumberFormat("ru-RU");
const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.round(diff/60000), h=Math.round(m/60), day=Math.round(h/24);
  if (m<60) return `${m} мин назад`;
  if (h<24) return `${h} ч назад`;
  if (day<7) return `${day} д назад`;
  const w=Math.round(day/7); if (w<5) return `${w} нед назад`;
  const mon=Math.round(day/30); if (mon<12) return `${mon} мес назад`;
  return `${Math.round(day/365)} г назад`;
};
const durSec = (iso:string) => {
  const m=/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso||""); if(!m) return 0;
  return +(m[1]||0)*3600+ +(m[2]||0)*60+ +(m[3]||0);
};
const hhmmss = (s:number)=> new Date(s*1000).toISOString().substring(s>=3600?11:14,19);

type YT = { id: string; snippet: any; statistics?: any; contentDetails?: any };
type Cat = { id: string; title: string };

const regions = ["RU","US","GB","IN","JP","KR","FR","DE","ES","IT","BR","MX","CA","AU","UA","PL","NL","TR","ID","SA","AE","EG","NG"];

export default function YouTubeStyle() {
  const [apiKey,setApiKey]=useState("");
  const [region,setRegion]=useState("RU");
  const [category,setCategory]=useState<string>("all");
  const [cats,setCats]=useState<Cat[]>([]);

  const [videos,setVideos]=useState<YT[]>([]);
  const [pageToken,setPageToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const [q, setQ]=useState(""); 
  const [minViews,setMinViews]=useState(0); 
  const [hideShorts,setHideShorts]=useState(true);

  // fetch categories when key/region set
  useEffect(()=>{ 
    if(!apiKey) return;
    (async()=>{
      try{
        const u=new URLSearchParams({ part:"snippet", regionCode:region, key:apiKey });
        const r=await fetch(`https://www.googleapis.com/youtube/v3/videoCategories?${u}`);
        const d=await r.json();
        const out=(d.items||[]).map((x:any)=>({id:x.id, title:x.snippet.title})).filter((c:any)=>c.title && c.id!=="0");
        setCats(out);
      }catch{}
    })();
  },[apiKey, region]);

  const buildURL=(t?:string)=>{ 
    const p=new URLSearchParams({
      part:"snippet,statistics,contentDetails",
      chart:"mostPopular",
      regionCode:region,
      maxResults:"50",
      key:apiKey
    });
    if(category!=="all") p.set("videoCategoryId", category);
    if(t) p.set("pageToken",t);
    return `https://www.googleapis.com/youtube/v3/videos?${p}`;
  };

  const load=async(fresh=false)=>{ 
    if(!apiKey){setError("ставьте API-ключ");return;}
    setLoading(true); setError(null);
    try{
      const r=await fetch(buildURL(fresh?undefined:pageToken||undefined));
      const d=await r.json();
      if(d.error) setError(d.error.message||"шибка запроса");
      else{
        const items:YT[]=d.items||[];
        setVideos(v=>fresh?items:[...v,...items]);
        setPageToken(d.nextPageToken||null);
      }
    }catch(e:any){ setError(e?.message||"е удалось загрузить"); }
    setLoading(false);
  };

  const list = useMemo(()=>{
    let a = videos.slice();
    if(hideShorts) a=a.filter(v=>{ const s=durSec(v.contentDetails?.duration||""); return s===0||s>=60; });
    if(minViews>0) a=a.filter(v => +(v.statistics?.viewCount||0)>=minViews);
    if(q.trim()){ const qq=q.toLowerCase(); a=a.filter(v=>(v.snippet?.title||"").toLowerCase().includes(qq) || (v.snippet?.channelTitle||"").toLowerCase().includes(qq)); }
    return a;
  },[videos,hideShorts,minViews,q]);

  const Card = ({v}:{v:YT})=>{
    const url=`https://www.youtube.com/watch?v=${v.id}`;
    const views=+(v.statistics?.viewCount||0);
    const s=durSec(v.contentDetails?.duration||"");
    const cover=v.snippet?.thumbnails?.maxres?.url || v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url;
    const initial=(v.snippet?.channelTitle||"?").slice(0,1).toUpperCase();
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <div className="relative rounded-xl overflow-hidden bg-neutral-800">
          {cover ? <img src={cover} alt={v.snippet?.title} className="w-full h-full object-cover aspect-video"/> :
            <div className="aspect-video" />}
          <span className="absolute bottom-1 right-1 text-[11px] px-1.5 py-0.5 rounded bg-black/80">
            {s?hhmmss(s):""}
          </span>
        </div>
        <div className="flex gap-3 mt-3">
          <div className="w-9 h-9 rounded-full bg-neutral-700 flex items-center justify-center text-sm">{initial}</div>
          <div className="min-w-0">
            <div className="text-[15px] font-medium leading-tight line-clamp-2">{v.snippet?.title}</div>
            <div className="text-[13px] text-neutral-400">{v.snippet?.channelTitle}</div>
            <div className="text-[13px] text-neutral-400">{fmt.format(views)} просмотров • {timeAgo(v.snippet?.publishedAt)}</div>
          </div>
        </div>
      </a>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#0f0f0f] text-white">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-white/10 pt-3">
        <NavItem icon={<HomeIcon/>} text="лавная" active/>
        <NavItem icon={<FireIcon/>} text=" тренде"/>
        <NavItem icon={<SubIcon/>} text="одписки"/>
        <NavItem icon={<LibraryIcon/>} text="иблиотека"/>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#0f0f0f] border-b border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2 mr-2">
              <RedPlay/> <span className="font-semibold tracking-tight">AltTube</span>
            </div>

            {/* Search */}
            <div className="flex-1 flex items-center gap-2 max-w-3xl">
              <input
                value={q} onChange={e=>setQ(e.target.value)}
                placeholder="оиск"
                className="flex-1 h-10 px-4 rounded-l-full bg-neutral-900 border border-white/10 outline-none text-sm"
              />
              <button className="h-10 px-4 rounded-r-full border border-white/10 bg-neutral-800 hover:bg-neutral-700">
                <SearchIcon/>
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <select value={region} onChange={e=>setRegion(e.target.value)}
                      className="h-9 bg-neutral-900 border border-white/10 rounded px-2 text-sm">
                {regions.map(r=> <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={()=>load(true)} disabled={loading||!apiKey}
                      className="h-9 rounded px-3 text-sm font-medium bg-[#cc0000] hover:bg-[#e81111] disabled:opacity-60">
                {loading? "агрузка..." : "агрузить"}
              </button>
            </div>
          </div>

          {/* Key + quick toggles */}
          <div className="px-4 pb-3 flex flex-wrap items-center gap-2 text-sm">
            <input type="password" placeholder="YouTube API Key"
                   value={apiKey} onChange={e=>setApiKey(e.target.value)}
                   className="h-9 bg-neutral-900 border border-white/10 rounded px-3 w-72"/>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={hideShorts} onChange={e=>setHideShorts(e.target.checked)} />
              <span className="text-neutral-300">Скрывать Shorts (&lt;60с)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-neutral-300">ин. просмотров</span>
              <input type="number" min={0} step={50000} value={minViews}
                     onChange={e=>setMinViews(parseInt(e.target.value||"0"))}
                     className="h-9 w-28 bg-neutral-900 border border-white/10 rounded px-2"/>
            </div>
            {error && <span className="text-red-400">{error}</span>}
          </div>

          {/* Category chips (scrollable) */}
          <div className="px-4 pb-3 overflow-x-auto whitespace-nowrap scrollbar-thin">
            <button onClick={()=>setCategory("all")} className={`px-3 h-8 rounded-full text-sm mr-2 border ${category==="all"?"bg-white text-black":"bg-neutral-900 text-neutral-200"} border-white/10`}>се</button>
            {cats.map(c=>(
              <button key={c.id} onClick={()=>setCategory(c.id)} className={`px-3 h-8 rounded-full text-sm mr-2 border ${category===c.id?"bg-white text-black":"bg-neutral-900 text-neutral-200"} border-white/10`}>{c.title}</button>
            ))}
          </div>
        </header>

        {/* Grid */}
        <main className="p-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map(v=> <Card key={v.id} v={v}/>)}
          </div>

          {!loading && list.length===0 && (
            <div className="text-neutral-400 p-8">усто. ставьте ключ и нажмите «агрузить», либо ослабьте фильтры.</div>
          )}
          {pageToken && (
            <div className="flex justify-center mt-6">
              <button onClick={()=>load(false)} disabled={loading}
                      className="h-10 px-5 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10">
                {loading? "агрузка..." : "оказать ещё"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/*** simple icons to avoid extra deps ***/
function RedPlay(){ return <span className="inline-flex items-center justify-center w-8 h-6 rounded-sm bg-[#ff0000]"><svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M10 8l6 4-6 4z"/></svg></span> }
function SearchIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white/80"><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 10-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1114 9.5 4.5 4.5 0 019.5 14z"/></svg>}
function HomeIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z"/></svg> }
function FireIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M12 2s1.5 2 1.5 4.5S12 10 12 10s2-1 3.5-3.5S18 2 18 2s2 3 2 6.5C20 14 16 22 12 22S4 14 4 8.5C4 5 6 2 6 2s.5 2 2 4.5S12 10 12 10"/></svg>}
function SubIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M21 8H3V6h18v2zm0 3H3v7h18v-7zM8 17v-3l5 1.5L8 17z"/></svg> }
function LibraryIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/></svg> }
function NavItem({icon,text,active=false}:{icon:React.ReactNode;text:string;active?:boolean}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 cursor-default ${active?'bg-white/5':''}`}>
      <span className="text-white">{icon}</span>
      <span className="text-sm text-neutral-200">{text}</span>
    </div>
  );
}
