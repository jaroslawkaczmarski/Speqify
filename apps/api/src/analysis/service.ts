/**
 * AI analysis orchestration (Phase 7 / §14). Pure: repo + LLM injected.
 * Correctness rules enforced:
 *  - single in-flight run per project (repo lock)
 *  - annotation set snapshotted at run start
 *  - zero annotations -> no-op success
 *  - structured-output validation + one repair; never persist garbage
 *  - tasks persisted FIRST, then annotations marked processed
 *  - failure leaves annotations re-analyzable; existing tasks never mutated
 */
import type { Project } from "@speqify/shared";
import type { Repository, TaskDraftInput } from "../repo/types.js";
import { buildPrompt } from "./prompt.js";
import { parseAnalysisOutput, type TaskCore } from "./schema.js";
import type { LlmProvider } from "./types.js";

export interface AnalysisDeps {
  repo: Repository;
  llm: LlmProvider;
}

export type AnalysisResult =
  | { locked: true }
  | {
      locked: false;
      runId: string;
      status: "succeeded" | "failed";
      annotations: number;
      tasksCreated: number;
      error?: string;
    };

export async function runAnalysis(deps: AnalysisDeps, project: Project): Promise<AnalysisResult> {
  const run = await deps.repo.startAnalysisRun(project.id);
  if (!run) return { locked: true };

  const snapshot = await deps.repo.listSubmittedForProject(project.id);
  const ids = snapshot.map((a) => a.id);
  if (snapshot.length === 0) {
    await deps.repo.finishAnalysisRun(run.id, "succeeded", [], null);
    return {
      locked: false,
      runId: run.id,
      status: "succeeded",
      annotations: 0,
      tasksCreated: 0,
    };
  }

  try {
    const prompt = buildPrompt(project, snapshot);
    let out = parseAnalysisOutput(await deps.llm.complete(prompt));
    if (!out) {
      out = parseAnalysisOutput(
        await deps.llm.complete({
          system: prompt.system,
          user: `${prompt.user}\n\nYour previous reply was not valid JSON for the schema. Reply with ONLY the JSON object.`,
        }),
      );
    }
    if (!out) throw new Error("LLM did not return schema-valid JSON");

    const known = new Set(ids);
    const byId = new Map(snapshot.map((a) => [a.id, a] as const));
    const shotKeys = (aIds: string[]): string[] =>
      aIds.map((id) => byId.get(id)?.screenshot?.bucketKey).filter((k): k is string => Boolean(k));

    const toDraft = (d: TaskCore, parentTaskId: string | null): TaskDraftInput => {
      const aIds = d.annotationIds.filter((x) => known.has(x));
      return {
        projectId: project.id,
        parentTaskId,
        title: d.title,
        description: d.description,
        acceptanceCriteria: d.acceptanceCriteria,
        labels: d.labels,
        component: d.component,
        version: d.version,
        priority: d.priority,
        confidence: d.confidence,
        subtaskType: d.subtaskType,
        annotationIds: aIds,
        screenshotKeys: shotKeys(aIds),
      };
    };

    const parents = await deps.repo.createTasks(out.tasks.map((d) => toDraft(d, null)));
    let tasksCreated = parents.length;
    for (let i = 0; i < out.tasks.length; i++) {
      const subs = out.tasks[i]?.subtasks ?? [];
      const parent = parents[i];
      if (subs.length > 0 && parent) {
        const children = await deps.repo.createTasks(subs.map((s) => toDraft(s, parent.id)));
        tasksCreated += children.length;
      }
    }

    await deps.repo.markAnnotationsProcessed(ids);
    await deps.repo.finishAnalysisRun(run.id, "succeeded", ids, null);
    return {
      locked: false,
      runId: run.id,
      status: "succeeded",
      annotations: ids.length,
      tasksCreated,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : "analysis failed";
    await deps.repo.finishAnalysisRun(run.id, "failed", ids, error);
    return {
      locked: false,
      runId: run.id,
      status: "failed",
      annotations: ids.length,
      tasksCreated: 0,
      error,
    };
  }
}
