import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type Progress = {
  milestonesTotal: number;
  milestonesCompleted: number;
  tasksTotal: number;
  tasksDone: number;
  percent: number;
};

type ProgressRow = {
  project_id: string;
  milestones_total: number;
  milestones_completed: number;
  tasks_total: number;
  tasks_done: number;
};

function toProgress(row: Omit<ProgressRow, "project_id"> | undefined): Progress {
  const milestonesTotal = Number(row?.milestones_total ?? 0);
  const milestonesCompleted = Number(row?.milestones_completed ?? 0);
  return {
    milestonesTotal,
    milestonesCompleted,
    tasksTotal: Number(row?.tasks_total ?? 0),
    tasksDone: Number(row?.tasks_done ?? 0),
    percent: milestonesTotal === 0 ? 0 : Math.round((milestonesCompleted / milestonesTotal) * 100),
  };
}

const progressSelect = Prisma.sql`
  p.id AS project_id,
  (SELECT COUNT(*)::int FROM "Milestone" m WHERE m."projectId" = p.id) AS milestones_total,
  (SELECT COUNT(*)::int FROM "Milestone" m
    WHERE m."projectId" = p.id
      AND EXISTS (SELECT 1 FROM "Task" t WHERE t."milestoneId" = m.id)
      AND NOT EXISTS (
        SELECT 1 FROM "Task" t
        WHERE t."milestoneId" = m.id AND t.status <> 'DONE'
      )
  ) AS milestones_completed,
  (SELECT COUNT(*)::int FROM "Task" t WHERE t."projectId" = p.id) AS tasks_total,
  (SELECT COUNT(*)::int FROM "Task" t WHERE t."projectId" = p.id AND t.status = 'DONE') AS tasks_done
`;

/** Milestone progress is aggregated in SQL. Zero milestones => 0%. A milestone with no tasks is not complete. */
export async function progressForProject(projectId: string): Promise<Progress> {
  const rows = await prisma.$queryRaw<ProgressRow[]>`
    SELECT ${progressSelect}
    FROM "Project" p
    WHERE p.id = ${projectId}
  `;
  return toProgress(rows[0]);
}

export async function progressForProjects(projectIds: string[]): Promise<Map<string, Progress>> {
  const map = new Map<string, Progress>();
  if (projectIds.length === 0) return map;
  const rows = await prisma.$queryRaw<ProgressRow[]>`
    SELECT ${progressSelect}
    FROM "Project" p
    WHERE p.id IN (${Prisma.join(projectIds)})
  `;
  for (const row of rows) map.set(row.project_id, toProgress(row));
  for (const id of projectIds) {
    if (!map.has(id)) map.set(id, toProgress(undefined));
  }
  return map;
}
