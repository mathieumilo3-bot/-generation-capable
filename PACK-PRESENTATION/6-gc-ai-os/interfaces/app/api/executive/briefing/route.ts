import { buildDailyBriefing } from "@gc-ai-os/executive-brain";
import { getRuntime } from "@/server/runtime";

/** Télécharge le briefing exécutif du jour en Markdown. */
export async function GET() {
  const { metrics } = getRuntime();
  const briefing = await buildDailyBriefing(metrics);

  return new Response(briefing.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="briefing-executif-${briefing.date}.md"`,
    },
  });
}
