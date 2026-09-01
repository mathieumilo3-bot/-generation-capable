import { SqliteNightShiftStore } from "@gc-ai-os/runtime";
import { getRuntime } from "./runtime";

const DEFAULT_PROMPT = `Operate as JARVIS autonomous night-shift pilot. Work continuously until the deadline or until every achievable objective is verified. CODED ≠ DONE; VERIFIED = DONE. Inspect real repository state before acting. Plan work, execute with available agents/tools, run tests and builds, inspect failures, repair them, retry within bounded limits, and never claim success without executable evidence. Prioritize JARVIS, the AI video editor, Commercial Radar and Mourad. Keep changes clean, reversible and documented. Never disable tests, invent evidence, silently swallow failures, or loop forever. Critical destructive, financial, credential, irreversible production or human-approval actions must be blocked and recorded for owner review. Non-critical failures should self-heal and continue with the next safe mission. Preserve durable checkpoints so a process restart resumes rather than duplicates work.`;

const PROJECTS = ["JARVIS", "AI video editor", "Commercial Radar", "Mourad"];

declare global {
  // eslint-disable-next-line no-var
  var __gcNightShiftRun: Promise<void> | undefined;
}

function store(): SqliteNightShiftStore {
  return new SqliteNightShiftStore(getRuntime().store.connection);
}

export async function getNightShiftSnapshot() {
  const runtime = getRuntime();
  const run = store().latest();
  if (!run) return { run: null, objective: null, missions: [] };

  const objective = run.objectiveId ? await runtime.goalStore.get(run.objectiveId) : undefined;
  const missions = run.objectiveId ? await runtime.goalStore.listMissionsForObjective(run.objectiveId) : [];
  return { run, objective: objective ?? null, missions };
}

export function startNightShift(input: {
  prompt?: string;
  deadline?: string;
  projects?: string[];
}): string {
  const existing = store().resumable();
  if (existing) {
    void runNightShift(existing.id);
    return existing.id;
  }

  const deadline = input.deadline ?? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const run = store().create({
    title: "JARVIS — Autonomous Night Shift",
    prompt: input.prompt?.trim() || DEFAULT_PROMPT,
    projects: input.projects?.length ? input.projects : PROJECTS,
    deadline,
  });

  void runNightShift(run.id);
  return run.id;
}

export async function runNightShift(runId: string): Promise<void> {
  if (globalThis.__gcNightShiftRun) return globalThis.__gcNightShiftRun;

  globalThis.__gcNightShiftRun = (async () => {
    const runtime = getRuntime();
    const nightStore = new SqliteNightShiftStore(runtime.store.connection);
    const run = nightStore.get(runId);
    if (!run) return;

    nightStore.markRunning(run.id);

    try {
      if (new Date(run.deadline).getTime() <= Date.now()) {
        nightStore.finish(run.id, "stopped", "Night shift deadline already elapsed.");
        return;
      }

      let objectiveId = run.objectiveId;
      if (!objectiveId) {
        const defined = await runtime.goalEngine.defineObjective({
          title: run.title,
          statement: `${run.prompt}\n\nProjects in scope: ${run.projects.join(", ")}.\nHard deadline: ${run.deadline}.`,
          horizon: "daily",
          budgetMicros: 5_000_000,
          deadline: run.deadline,
        });
        objectiveId = defined.objective.id;
        nightStore.attachObjective(run.id, objectiveId);
      }

      const result = await runtime.goalEngine.pursue(objectiveId);
      if (result.halted) {
        nightStore.finish(run.id, "blocked", result.haltReason ?? "Execution halted by runtime safeguards.");
      } else if (result.objective.status === "achieved") {
        nightStore.finish(run.id, "completed");
      } else if (result.objective.status === "awaiting_validation") {
        nightStore.finish(run.id, "blocked", "One or more missions require human validation.");
      } else {
        nightStore.finish(run.id, "failed", "Objective did not reach an achieved state.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      nightStore.finish(run.id, "failed", message);
    }
  })().finally(() => {
    globalThis.__gcNightShiftRun = undefined;
  });

  return globalThis.__gcNightShiftRun;
}

export function resumeNightShiftOnBoot(): void {
  const resumable = store().resumable();
  if (resumable) void runNightShift(resumable.id);
}

export { DEFAULT_PROMPT, PROJECTS };
