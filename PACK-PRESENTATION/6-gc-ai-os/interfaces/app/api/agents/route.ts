import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

/**
 * Catalogue des agents avec leurs compétences mesurées. Alimente la vue
 * Agents : niveau, fiabilité et coût viennent d'exécutions réelles, pas
 * de déclarations (voir docs/gc-ai-os/12-competences.md).
 */
export async function GET() {
  const { agents, skills, publishedAgentCount } = getRuntime();

  const catalogue = await Promise.all(
    agents.list().map(async (manifest) => ({
      id: manifest.id,
      name: manifest.name,
      domain: manifest.domain,
      role: manifest.role,
      skills: await skills.profileOf(manifest.id),
    })),
  );

  return NextResponse.json({
    agents: catalogue,
    total: catalogue.length,
    manufactured: publishedAgentCount,
  });
}
