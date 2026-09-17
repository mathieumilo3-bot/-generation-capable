import { notFound } from "next/navigation";
import { CASE_STUDIES } from "@/lib/data/case-studies";

type Props = { params: Promise<{ client: string }> };

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ client: c.slug }));
}

/**
 * No case studies exist yet (see /lib/data/case-studies.ts) — this route is
 * scaffolding for when real, verifiable client work is ready to publish.
 */
export default async function CaseStudyPage({ params }: Props) {
  const { client } = await params;
  const study = CASE_STUDIES.find((c) => c.slug === client);
  if (!study) notFound();
  return null;
}
