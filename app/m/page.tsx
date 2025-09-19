'use client';
import React, { useEffect, useMemo, useState } from "react";

type YT = { id: string; snippet: any; statistics?: any; contentDetails?: any };
type Cat = { id: string; title: string };

const fmt = new Intl.NumberFormat("ru-RU");
const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const m=Math.round(diff/60000), h=Math.round(m/60), day=Math.round(h/24);
  if (m<60) return `${m} мин назад`;
  if (h<24) return `${h} ч назад`;
  if (day<7) return `${day} д назад`;
  const w=Math.round(day/7); if (w<5) return `${w} нед назад`;
  const mon=Math.round(day/30); if (mon<12) return `${mon} мес назад`;
  return `${Math.round(day/365)} г назад`;
};
const durSec=(iso:string)=>{const m=/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso||"");
  if(!m) return 0; return +(m[1]||0)*3600+ +(m[2]||0)*60+ +(m[3]||0)};
const hhmmss=(s:number)=>new Date(s*1000).toISOString().substring(s>=3600?11:14,19);

const regions=["RU","US","GB","IN","JP","KR","FR","DE","ES","IT","BR","MX","CA","AU","UA","PL","NL","TR","ID","SA","AE","EG","NG"];

export default function MobileTube(){
  const [apiKey,setApiKey]=useState("");
  const [region,setRegion]=useState("RU");
  const [category,setCategory]=useState<string>("all");
  const [cats,setCats]=useState<Cat[]>([]);

  const [videos,setVideos]=useState<YT[]>([]);
  const [pageToken,setPageToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const [q,setQ]=useState(""); const [minViews,setMinViews]=useState(0); const [hideShorts,setHideShorts]=useState(true);

  useEffect(()=>{ if(!apiKey) return; (async()=>{
    try{ const u=new URLSearchParams({part:"snippet",regionCode:region,key:apiKey});
      const r=await fetch(`https://www.googleapis.com/youtube/v3/videoCategories?${u}`);
      const d=await r.json();
      const out=(d.items||[]).map((x:any)=>({id:x.id,title:x.snippet.title})).filter((c:any)=>c.title&&c.id!=="0");
      setCats(out);
    }catch{}
  })(); },[apiKey,region]);

  const buildURL=(t?:string)=>{ const p=new URLSearchParams({
    part:"snippet,statistics,contentDetails", chart:"mostPopular", regionCode:region, maxResults:"50", key:apiKey
  }); if(category!=="all") p.set("videoCategoryId",category); if(t) p.set("pageToken",t);
  return `https://www.googleapis.com/youtube/v3/videos?${p}` };

  const load=async(fresh=false)=>{ if(!apiKey){setError("ставьте API-ключ");return;}
    setLoading(true); setError(null);
    try{ const r=await fetch(buildURL(fresh?undefined:pageToken||undefined)); const d=await r.json();
      if(d.error) setError(d.error.message||"шибка запроса");
      else { const items:YT[]=d.items||[]; setVideos(v=>fresh?items:[...v,...items]); setPageToken(d.nextPageToken||null); }
    }catch(e:any){ setError(e?.message||"е удалось загрузить"); }
    setLoading(false);
  };

  const list=useMemo(()=>{ let a=videos.slice();
    if(hideShorts) a=a.filter(v=>{const s=durSec(v.contentDetails?.duration||""); return s===0||s>=60});
    if(minViews>0) a=a.filter(v=>+(v.statistics?.viewCount||0)>=minViews);
    if(q.trim()){ const qq=q.toLowerCase(); a=a.filter(v=>(v.snippet?.title||"").toLowerCase().includes(qq)||(v.snippet?.channelTitle||"").toLowerCase().includes(qq)); }
    return a;
  },[videos,hideShorts,minViews,q]);

  const Card=({v}:{v:YT})=>{ const url=`https://www.youtube.com/watch?v=${v.id}`;
    const views=+(v.statistics?.viewCount||0); const s=durSec(v.contentDetails?.duration||"");
    const cover=v.snippet?.thumbnails?.maxres?.url||v.snippet?.thumbnails?.high?.url||v.snippet?.thumbnails?.medium?.url;
    return (<a href={url} target="_blank" rel="noreferrer" className="block">
      <div className="relative rounded-xl overflow-hidden bg-neutral-800">
        {cover?<img src={cover} alt={v.snippet?.title} className="w-full h-full object-cover aspect-video"/>:<div className="aspect-video"/>}
        <span className="absolute bottom-1 right-1 text-[11px] px-1.5 py-0.5 rounded bg-black/80">{s?hhmmss(s):""}</span>
      </div>
      <div className="mt-2">
        <div className="text-[15px] font-medium leading-tight">{v.snippet?.title}</div>
        <div className="text-[13px] text-neutral-400">{v.snippet?.channelTitle}</div>
        <div className="text-[13px] text-neutral-400">{fmt.format(views)} просмотров • {timeAgo(v.snippet?.publishedAt)}</div>
      </div>
    </a>); };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pb-16">
      {/* header */}
      <header className="sticky top-0 z-30 bg-[#0f0f0f] border-b border-white/10">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2"><RedPlay/><span className="font-semibold">AltTube</span></div>
          <button onClick={()=>load(true)} disabled={loading||!apiKey} className="h-9 px-3 rounded-full bg-[#cc0000] hover:bg-[#e81111] disabled:opacity-60 text-sm">агрузить</button>
        </div>
        <div className="px-3 pb-2 space-y-2">
          <div className="flex gap-2">
            <input className="flex-1 h-9 bg-neutral-900 border border-white/10 rounded px-3 text-sm" placeholder="оиск"
                   value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <input type="password" className="flex-1 h-9 bg-neutral-900 border border-white/10 rounded px-3 text-sm" placeholder="YouTube API Key"
                   value={apiKey} onChange={e=>setApiKey(e.target.value)} />
            <select value={region} onChange={e=>setRegion(e.target.value)}
                    className="h-9 bg-neutral-900 border border-white/10 rounded px-2 text-sm">
              {regions.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-300">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={hideShorts} onChange={e=>setHideShorts(e.target.checked)} />
              Скрывать Shorts (&lt;60с)
            </label>
            <span>ин. просмотров</span>
            <input type="number" min={0} step={50000} value={minViews} onChange={e=>setMinViews(parseInt(e.target.value||"0"))}
                   className="h-8 w-24 bg-neutral-900 border border-white/10 rounded px-2" />
            {error && <span className="text-red-400">{error}</span>}
          </div>
          <div className="overflow-x-auto whitespace-nowrap scrollbar-thin">
            <button onClick={()=>setCategory("all")} className={`px-3 h-8 rounded-full text-sm mr-2 border ${category==="all"?"bg-white text-black":"bg-neutral-900 text-neutral-200"} border-white/10`}>се</button>
            {cats.map(c=>(
              <button key={c.id} onClick={()=>setCategory(c.id)} className={`px-3 h-8 rounded-full text-sm mr-2 border ${category===c.id?"bg-white text-black":"bg-neutral-900 text-neutral-200"} border-white/10`}>{c.title}</button>
            ))}
          </div>
        </div>
      </header>

      {/* grid */}
      <main className="p-3">
        <div className="grid grid-cols-1 xxs:grid-cols-2 sm:grid-cols-2 gap-4">
          {list.map(v => <Card key={v.id} v={v} />)}
        </div>
        {!loading && list.length===0 && <div className="text-neutral-400 p-8">усто. ставьте ключ и нажмите «агрузить», либо ослабьте фильтры.</div>}
        {pageToken && <div className="flex justify-center mt-4"><button onClick={()=>load(false)} disabled={loading} className="h-10 px-5 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-white/10">{loading?"агрузка...":"оказать ещё"}</button></div>}
      </main>

      {/* bottom nav (как на моб. YouTube) */}
      <nav className="fixed bottom-0 inset-x-0 h-14 bg-[#0f0f0f] border-t border-white/10 grid grid-cols-4 text-[11px]">
        <Tab icon={<HomeIcon/>} label="лавная" active/>
        <Tab icon={<ShortsIcon/>} label="Shorts"/>
        <Tab icon={<SubIcon/>} label="одписки"/>
        <Tab icon={<LibraryIcon/>} label="иблиотека"/>
      </nav>
    </div>
  );
}

/* UI bits */
function Tab({icon,label,active=false}:{icon:React.ReactNode;label:string;active?:boolean}) {
  return <div className={`flex flex-col items-center justify-center ${active?'text-white':'text-neutral-400'}`}>{icon}<div className="mt-0.5">{label}</div></div>;
}
function RedPlay(){ return <span className="inline-flex items-center justify-center w-8 h-6 rounded-sm bg-[#ff0000]"><svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M10 8l6 4-6 4z"/></svg></span> }
function HomeIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z"/></svg> }
function ShortsIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M11 3l6 4-5 3 5 3-6 4V3zM7 5l4 3-4 2 4 2-4 3V5z"/></svg> }
function SubIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M21 8H3V6h18v2zm0 3H3v7h18v-7zM8 17v-3l5 1.5L8 17z"/></svg> }
function LibraryIcon(){ return <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/></svg> }
