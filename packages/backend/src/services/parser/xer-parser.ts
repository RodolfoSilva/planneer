import { XER } from "xer-parser";

interface ParsedActivity {
  code: string;
  name: string;
  description?: string;
  duration?: number;
  durationUnit?: string;
  wbsPath?: string;
  predecessors?: string[];
  resources?: string[];
}

interface ParsedWBS {
  code: string;
  name: string;
  level: number;
  parentCode?: string;
}

interface ParsedData {
  projectName: string;
  projectDescription?: string;
  activities: ParsedActivity[];
  wbs: ParsedWBS[];
  totalDuration?: number;
  metadata: Record<string, unknown>;
}

export async function parseXER(content: string): Promise<ParsedData> {
  try {
    // Parse XER using constructor
    const xer = new XER(content) as any;

    // Extract project info
    const projects = xer.projects || [];
    const mainProject = projects[0];

    // Extract WBS
    const wbsItems = xer.wbs || [];
    const wbsMap = new Map<string, string>();
    const parsedWBS: ParsedWBS[] = [];

    for (const wbs of wbsItems) {
      const wbsId = (wbs as any).wbsId || (wbs as any).wbs_id;
      const wbsName =
        (wbs as any).wbsName ||
        (wbs as any).wbs_name ||
        (wbs as any).wbsShortName ||
        (wbs as any).wbs_short_name ||
        "";
      const wbsShortName =
        (wbs as any).wbsShortName || (wbs as any).wbs_short_name || "";

      wbsMap.set(wbsId, wbsName);

      parsedWBS.push({
        code: wbsShortName || wbsId,
        name: wbsName,
        level: (wbs as any).level || 1,
        parentCode: (wbs as any).parentWbsId || (wbs as any).parent_wbs_id,
      });
    }

    // Extract activities/tasks
    const tasks = xer.tasks || [];
    const activities: ParsedActivity[] = [];

    for (const task of tasks) {
      const taskId = (task as any).taskId || (task as any).task_id;
      const taskCode =
        (task as any).taskCode ||
        (task as any).task_code ||
        taskId ||
        `ACT${activities.length + 1}`;
      const taskName =
        (task as any).taskName || (task as any).task_name || "Unnamed Activity";
      const wbsId = (task as any).wbsId || (task as any).wbs_id;
      const targetDuration =
        (task as any).targetDuration?.days || (task as any).target_drtn_hr_cnt;

      const activity: ParsedActivity = {
        code: taskCode,
        name: taskName,
        description: (task as any).taskNotes || (task as any).task_notes,
        duration:
          typeof targetDuration === "number"
            ? targetDuration > 100
              ? targetDuration / 8
              : targetDuration // Convert hours to days if needed
            : undefined,
        durationUnit: "days",
        wbsPath: wbsId ? wbsMap.get(wbsId) : undefined,
      };

      activities.push(activity);
    }

    // Extract predecessors
    const taskPreds = xer.taskPredecessors || [];
    const predMap = new Map<string, string[]>();

    for (const pred of taskPreds) {
      const taskId = (pred as any).taskId || (pred as any).task_id;
      const predTaskId = (pred as any).predTaskId || (pred as any).pred_task_id;

      if (!predMap.has(taskId)) {
        predMap.set(taskId, []);
      }

      // Find predecessor task code
      const predTask = tasks.find((t: any) => {
        const tId = (t as any).taskId || (t as any).task_id;
        return tId === predTaskId;
      });

      if (predTask) {
        const predCode =
          (predTask as any).taskCode ||
          (predTask as any).task_code ||
          predTaskId;
        predMap.get(taskId)!.push(predCode);
      }
    }

    // Add predecessors to activities
    for (const task of tasks) {
      const taskId = (task as any).taskId || (task as any).task_id;
      const taskCode =
        (task as any).taskCode || (task as any).task_code || taskId;
      const activity = activities.find((a) => a.code === taskCode);

      if (activity && predMap.has(taskId)) {
        activity.predecessors = predMap.get(taskId);
      }
    }

    // Extract resources
    const taskResources = xer.taskResources || [];

    for (const tr of taskResources) {
      const taskId = (tr as any).taskId || (tr as any).task_id;
      const rsrcName =
        (tr as any).resourceName ||
        (tr as any).rsrc_name ||
        (tr as any).resource?.rsrcName;

      const task = tasks.find((t: any) => {
        const tId = (t as any).taskId || (t as any).task_id;
        return tId === taskId;
      });

      if (task && rsrcName) {
        const taskCode =
          (task as any).taskCode || (task as any).task_code || taskId;
        const activity = activities.find((a) => a.code === taskCode);

        if (activity) {
          if (!activity.resources) {
            activity.resources = [];
          }
          activity.resources.push(rsrcName);
        }
      }
    }

    // Calculate total duration (sum of all durations)
    const totalDuration = activities.reduce(
      (sum, a) => sum + (a.duration || 0),
      0
    );

    // Get project name
    const projectName = mainProject
      ? (mainProject as any).projShortName ||
        (mainProject as any).proj_short_name ||
        (mainProject as any).name ||
        "Imported Project"
      : "Imported Project";

    return {
      projectName,
      projectDescription: mainProject
        ? (mainProject as any).projNotes || (mainProject as any).proj_notes
        : undefined,
      activities,
      wbs: parsedWBS,
      totalDuration,
      metadata: {
        sourceFormat: "xer",
        projectId: mainProject
          ? (mainProject as any).projId || (mainProject as any).proj_id
          : undefined,
        wbsCount: wbsItems.length,
        activityCount: activities.length,
        resourceCount: taskResources.length,
        importedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("XER parsing error:", error);
    throw new Error(`Failed to parse XER file: ${error}`);
  }
}
