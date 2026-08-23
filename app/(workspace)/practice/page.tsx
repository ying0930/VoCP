import { PracticePage } from "@/components/practice/practice-page";
export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string; set?: string; start?: string }> }) { const query = await searchParams; return <PracticePage initialMode={query.mode === "questions" ? "questions" : "review"} initialSet={query.set ?? ""} initialAutoStart={query.start === "1"} />; }
