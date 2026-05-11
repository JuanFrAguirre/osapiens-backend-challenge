import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';

export enum WorkflowStatus {
    Initial = 'initial',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed',
}

interface WorkflowStep {
    taskType: string;
    stepNumber: number;
    dependsOn?: number;
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class WorkflowFactory {
    constructor(private dataSource: DataSource) {}

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     * @param filePath - Path to the YAML file.
     * @param clientId - Client identifier for the workflow.
     * @param geoJson - The geoJson data string for tasks (customize as needed).
     * @returns A promise that resolves to the created Workflow.
     */
    async createWorkflowFromYAML(
        filePath: string,
        clientId: string,
        geoJson: string,
    ): Promise<Workflow> {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const workflowDef = yaml.load(fileContent) as WorkflowDefinition;

        // this is a safeguard for cases when the YAML is not valid, I had not put this initially and I just caught it because I had a string in the dependency instead of a number
        const stepNumbers = new Set(workflowDef.steps.map((s) => s.stepNumber));
        for (const step of workflowDef.steps) {
            if (
                step.dependsOn !== undefined &&
                !stepNumbers.has(step.dependsOn)
            ) {
                throw new Error(
                    `Step ${step.stepNumber} depends on non-existent step ${step.dependsOn}`,
                );
            }
        }

        const workflowRepository = this.dataSource.getRepository(Workflow);
        const taskRepository = this.dataSource.getRepository(Task);
        const workflow = new Workflow();

        workflow.clientId = clientId;
        workflow.status = WorkflowStatus.Initial;

        const savedWorkflow = await workflowRepository.save(workflow);

        const tasks: Task[] = workflowDef.steps.map((step) => {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.workflow = savedWorkflow;
            return task;
        });

        const savedTasks = await taskRepository.save(tasks);

        const stepToTask = new Map<number, Task>(
            savedTasks.map((t) => [t.stepNumber, t]),
        );

        for (const step of workflowDef.steps) {
            if (step.dependsOn === undefined) continue;
            const dependantTask = stepToTask.get(step.stepNumber)!;
            const dependencyTask = stepToTask.get(step.dependsOn)!;
            dependantTask.dependency = dependencyTask;
        }

        await taskRepository.save(savedTasks);

        return savedWorkflow;
    }
}
