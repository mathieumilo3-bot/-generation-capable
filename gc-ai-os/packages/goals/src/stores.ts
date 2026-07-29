import type {
  Deliverable,
  KeyResult,
  Mission,
  MissionStatus,
  Objective,
  ObjectiveStatus,
} from "@gc-ai-os/shared-types";

export interface ObjectiveStore {
  create(
    objective: Omit<Objective, "id" | "createdAt" | "updatedAt" | "spentMicros" | "status">,
  ): Promise<Objective>;
  get(objectiveId: string): Promise<Objective | undefined>;
  list(): Promise<Objective[]>;
  updateStatus(objectiveId: string, status: ObjectiveStatus): Promise<Objective>;
  addSpend(objectiveId: string, micros: number): Promise<Objective>;
}

export interface KeyResultStore {
  create(keyResult: Omit<KeyResult, "id">): Promise<KeyResult>;
  listForObjective(objectiveId: string): Promise<KeyResult[]>;
  updateCurrent(keyResultId: string, current: number): Promise<KeyResult>;
}

export interface MissionStore {
  create(mission: Omit<Mission, "id" | "createdAt" | "updatedAt">): Promise<Mission>;
  get(missionId: string): Promise<Mission | undefined>;
  listForObjective(objectiveId: string): Promise<Mission[]>;
  update(
    missionId: string,
    patch: Partial<Pick<Mission, "status" | "attempt" | "assignedAgentId" | "brief">>,
  ): Promise<Mission>;
  updateDependencies(missionId: string, dependsOn: string[]): Promise<Mission>;
}

export interface DeliverableStore {
  create(deliverable: Omit<Deliverable, "id" | "createdAt" | "bytes">): Promise<Deliverable>;
  get(deliverableId: string): Promise<Deliverable | undefined>;
  listForObjective(objectiveId: string): Promise<Deliverable[]>;
}

export type { MissionStatus };
