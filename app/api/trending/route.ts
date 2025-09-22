/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/trending/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// ключевые слова для ИИ/нейро-контента
const AI_WORDS = [
  "ai","ии","нейросет","искусствен","midjourney","chatgpt","gpt","deepfake",
  "voice clone","ai cover","cover ai","suno","sora","dalle","нейро","клон голоса"
];

const looksLikeAI = (s?: string) => {
  if (!s) return false;
  const t = s.toLowerCase();
  return AI_WORDS.some(w => t.includes(w));
};

const looksLikeMusic = (v: any) => {
  const title = (v?.snippet?.title || "").toLowerCase();
  const ch    = (v?.snippet?.channelTitle || "").toLowerCase();
  // Категория 10 — Music + типичные маркеры музыки
  return (
    v?.snippet?.categoryId === "10" ||
    /lyrics?|lyric video|visuali[sz]er|official audio|audio|instrumental|remix| - topic/i.test(title + " " + ch)
  );
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region   = (searchParams.get("region") || "US").toUpperCase();
  const pageToken = searchParams.get("pageToken") || "";
  const maxViews = Number(searchParams.get("maxViews") || "200000"); // порог
  const maxAgeDays = Number(searchParams.get("days") || "14");       // свежесть

  const key = process.env.YT_API_KEY;
  if (!key) return NextResponse.json({ error: "Server YT_API_KEY is missing" }, { status: 500 });

  const qs = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    regionCode: region,
    maxResults: "50",
    key,
  });
  if (pageToken) qs.set("pageToken", pageToken);

  const r = await fetch("https://www.googleapis.com/youtube/v3/videos?" + qs.toString(), { next: { revalidate: 0 } });
  const data = await r.json();

  let items: any[] = Array.isArray(data?.items) ? data.items : [];
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 86400000;

  // серверные фильтры
  items = items.filter((v: any) => {
    const views = Number(v?.statistics?.viewCount || 0);
    const published = Date.parse(v?.snippet?.publishedAt || "") || 0;

    if (views > maxViews) return false;                 // перегретые
    if (published && now - published > maxAgeMs) return false; // слишком старые
    if (looksLikeMusic(v)) return false;                // музло
    if (looksLikeAI(v?.snippet?.title) || looksLikeAI(v?.snippet?.description) || looksLikeAI(v?.snippet?.channelTitle)) return false; // ИИ

    return true;
  });

  // «скорость набора»: меньше — свежее/на взлёте
  const score = (v: any) => {
    const views = Number(v?.statistics?.viewCount || 0);
    const ageH  = Math.max(1, (Date.now() - Date.parse(v?.snippet?.publishedAt || "")) / 36e5);
    return views / ageH;
  };
  items.sort((a, b) => score(a) - score(b));

  return NextResponse.json({ ...data, items }, { status: r.ok ? 200 : 500 });
}
