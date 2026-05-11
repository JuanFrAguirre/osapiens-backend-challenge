import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';

export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed',
}

export class TaskRunner {
    constructor(private taskRepository: Repository<Task>) {}

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);

        const job = getJobForTaskType(task.taskType);
        const resultRepository =
            this.taskRepository.manager.getRepository(Result);

        try {
            if (task.dependency?.status === TaskStatus.Failed)
                throw new Error(
                    `Dependency task ${task.dependency.taskId} failed`,
                );

            const input = await this.resolveDependencyInput(task);

            console.log(
                `Starting job ${task.taskType} for task ${task.taskId}...`,
            );
            const taskResult = await job.run(task, input);
            console.log(
                `Job ${task.taskType} for task ${task.taskId} completed successfully.\n`,
            );
            const result = new Result();
            result.taskId = task.taskId!;
            result.data = JSON.stringify(taskResult || {});
            await resultRepository.save(result);
            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);
        } catch (error: any) {
            console.error(
                `Error running job ${task.taskType} for task ${task.taskId}:`,
                error,
            );

            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);

            throw error;
        }

        const workflowRepository =
            this.taskRepository.manager.getRepository(Workflow);
        const currentWorkflow = await workflowRepository.findOne({
            where: { workflowId: task.workflow.workflowId },
            relations: ['tasks'],
        });

        if (currentWorkflow) {
            const allCompleted = currentWorkflow.tasks.every(
                (t) => t.status === TaskStatus.Completed,
            );
            const anyFailed = currentWorkflow.tasks.some(
                (t) => t.status === TaskStatus.Failed,
            );
            const allTerminal = currentWorkflow.tasks.every(
                (t) =>
                    t.status === TaskStatus.Completed ||
                    t.status === TaskStatus.Failed,
            );

            if (anyFailed) {
                currentWorkflow.status = WorkflowStatus.Failed;
            } else if (allCompleted) {
                currentWorkflow.status = WorkflowStatus.Completed;
            } else {
                currentWorkflow.status = WorkflowStatus.InProgress;
            }

            if (allTerminal) {
                // added this for readability
                console.log(`\n-----------------------\n`);
                currentWorkflow.finalResult = JSON.stringify(
                    await this.buildFinalResult(currentWorkflow),
                );
            }

            await workflowRepository.save(currentWorkflow);
        }
    }

    private async buildFinalResult(workflow: Workflow) {
        const resultRepository =
            this.taskRepository.manager.getRepository(Result);

        const tasks = await Promise.all(
            workflow.tasks.map(async (t) => {
                if (t.status === TaskStatus.Failed) {
                    return {
                        taskId: t.taskId,
                        type: t.taskType,
                        status: t.status,
                        error: 'Task failed',
                    };
                }
                const result = t.resultId
                    ? await resultRepository.findOne({
                          where: { resultId: t.resultId },
                      })
                    : null;
                return {
                    taskId: t.taskId,
                    type: t.taskType,
                    status: t.status,
                    output: result?.data ? JSON.parse(result.data) : null,
                };
            }),
        );

        return {
            workflowId: workflow.workflowId,
            status: workflow.status,
            tasks,
        };
    }

    private async resolveDependencyInput(task: Task): Promise<unknown> {
        if (!task.dependency || !task.dependency.resultId) {
            return undefined;
        }
        const resultRepository =
            this.taskRepository.manager.getRepository(Result);
        const result = await resultRepository.findOne({
            where: { resultId: task.dependency.resultId },
        });
        return result?.data ? JSON.parse(result.data) : undefined;
    }
}
