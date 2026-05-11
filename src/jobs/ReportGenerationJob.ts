import { AppDataSource } from '../data-source';
import { Result } from '../models/Result';
import { Task } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';
import { Job } from './Job';

type ReportTaskEntry = {
    taskId: string;
    type: string;
    output?: unknown;
    error?: string;
};

type ReportOutput = {
    workflowId: string;
    tasks: ReportTaskEntry[];
    finalReport: string;
};

export class ReportGenerationJob implements Job {
    async run(task: Task): Promise<ReportOutput> {
        console.log(
            `Generating report for workflow ${task.workflow.workflowId}...`,
        );

        const workflowRepository = AppDataSource.getRepository(Workflow);
        const resultRepository = AppDataSource.getRepository(Result);

        const workflow = await workflowRepository.findOne({
            where: {
                workflowId: task.workflow.workflowId,
            },
            relations: ['tasks'],
        });

        //should not happen, but better have a safeguard
        if (!workflow) {
            throw new Error(`Workflow ${task.workflow.workflowId} not found`);
        }

        const siblingTasks = workflow.tasks.filter(
            (t) => t.taskId !== task.taskId,
        );

        // the requirments say to only run this job after all preceding tasks are completed, but it does not clarify about tasks which are after this one, so I interpreted like this. But if it should be run LAST, then another approach should be taken. I took this into consideration when thinking about this approach
        const taskEntries: ReportTaskEntry[] = await Promise.all(
            siblingTasks.map(async (siblingTask) => {
                if (siblingTask.status === TaskStatus.Failed)
                    return {
                        taskId: siblingTask.taskId,
                        type: siblingTask.taskType,
                        error: 'Task failed',
                    };
                if (
                    siblingTask.status !== TaskStatus.Completed ||
                    !siblingTask.resultId
                )
                    return {
                        taskId: siblingTask.taskId,
                        type: siblingTask.taskType,
                        error: `Status: ${siblingTask.status}`,
                    };
                const result = await resultRepository.findOne({
                    where: { resultId: siblingTask.resultId },
                });
                return {
                    taskId: siblingTask.taskId,
                    type: siblingTask.taskType,
                    output: result?.data ? JSON.parse(result.data) : null,
                };
            }),
        );

        return {
            workflowId: workflow.workflowId,
            tasks: taskEntries,
            finalReport: 'Aggregated data and results',
        };
    }
}
