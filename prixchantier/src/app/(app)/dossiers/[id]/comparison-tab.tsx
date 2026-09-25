import { createClient } from "@/lib/supabase/server";
import { loadComparison } from "@/lib/comparison/load";
import { EmptyState } from "@/components/page";
import { ComparisonView } from "./comparison-view";

export async function ComparisonTab({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const comparison = await loadComparison(supabase, projectId);
  if (!comparison.suppliers.length) {
    return <EmptyState title="Pas encore de comparatif" description="Le comparatif apparaît dès que vos consultations sont envoyées et que les offres arrivent." />;
  }
  return <ComparisonView projectId={projectId} comparison={comparison} />;
}
