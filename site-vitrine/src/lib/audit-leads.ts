type RpcResponse<T> = {
  data: T | null;
  error?: string;
};

function config() {
  const url = process.env.GC_AUDIT_SUPABASE_URL || "";
  const key = process.env.GC_AUDIT_SUPABASE_KEY || "";
  const secret = process.env.GC_AUDIT_RPC_SECRET || "";
  if (!url || !key || !secret) return null;
  return { url, key, secret };
}

export async function auditRpc<T>(
  functionName: string,
  args: Record<string, unknown>
): Promise<RpcResponse<T>> {
  const cfg = config();
  if (!cfg) return { data: null, error: "audit_storage_unconfigured" };

  try {
    const response = await fetch(`${cfg.url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_secret: cfg.secret, ...args }),
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[audit/leads] RPC failed:", functionName, response.status, text.slice(0, 500));
      return { data: null, error: "audit_storage_failed" };
    }

    if (!text) return { data: null };
    return { data: JSON.parse(text) as T };
  } catch (error) {
    console.error("[audit/leads] RPC error:", functionName, error);
    return { data: null, error: "audit_storage_failed" };
  }
}

export type AuditLeadHandle = { id: string; lead_token: string };

export async function registerAuditLead(input: {
  companyName: string;
  companyCity?: string;
  siteUrl?: string;
  email: string;
  phone?: string;
  marketingConsent: boolean;
  attribution?: Record<string, unknown>;
}): Promise<AuditLeadHandle | null> {
  const result = await auditRpc<AuditLeadHandle[]>("gc_register_audit_lead", {
    p_company_name: input.companyName,
    p_company_city: input.companyCity || "",
    p_site_url: input.siteUrl || "",
    p_email: input.email,
    p_phone: input.phone || "",
    p_marketing_consent: input.marketingConsent,
    p_attribution: input.attribution || {},
  });
  return result.data?.[0] ?? null;
}

export async function attachAuditJob(input: {
  id: string;
  token: string;
  context: unknown;
  signature: string;
  jobId: string;
  jobToken: string;
}) {
  return auditRpc<boolean>("gc_attach_audit_job", {
    p_id: input.id,
    p_token: input.token,
    p_context: input.context,
    p_signature: input.signature,
    p_job_id: input.jobId,
    p_job_token: input.jobToken,
  });
}

export async function completeAuditJob(input: {
  id: string;
  token: string;
  report: unknown;
}) {
  return auditRpc<boolean>("gc_complete_audit_job", {
    p_id: input.id,
    p_token: input.token,
    p_report: input.report,
  });
}

export async function getStoredAuditResult(input: { id: string; token: string }) {
  return auditRpc<
    Array<{
      company_name: string;
      company_city: string;
      site_url: string;
      report: unknown;
      marketing_consent: boolean;
    }>
  >("gc_get_audit_result", {
    p_id: input.id,
    p_token: input.token,
  });
}
