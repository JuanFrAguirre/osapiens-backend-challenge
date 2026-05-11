import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { TaskStatus } from '../workers/taskRunner';

const router = Router();

router
    // created this just for QoL when testing
    .get('/', async (req, res) => {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflows = await workflowRepository.find();
        res.json(workflows);
    })
    .get('/:id/status', async (req, res) => {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: req.params.id },
            relations: ['tasks'],
        });

        if (!workflow) {
            res.status(404).json({ message: 'Workflow not found' });
            return;
        }

        const totalTasks = workflow.tasks.length;
        const completedTasks = workflow.tasks.filter(
            (t) => t.status === TaskStatus.Completed,
        ).length;

        res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            completedTasks,
            totalTasks,
        });
    })
    .get('/:id/results', async (req, res) => {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: req.params.id },
        });

        if (!workflow) {
            res.status(404).json({ message: 'Workflow not found' });
            return;
        }

        const isTerminal =
            workflow.status === WorkflowStatus.Completed ||
            workflow.status === WorkflowStatus.Failed;

        if (!isTerminal) {
            res.status(400).json({
                message: `Workflow is not yet completed (status: ${workflow.status})`,
            });
            return;
        }

        res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult
                ? JSON.parse(workflow.finalResult)
                : null,
        });
    });

export default router;
