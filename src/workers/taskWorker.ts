import { AppDataSource } from '../data-source';
import { Task } from '../models/Task';
import { TaskRunner, TaskStatus } from './taskRunner';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        const task = await taskRepository.findOne({
            where: { status: TaskStatus.Queued },
            relations: ['workflow'], // Ensure workflow is loaded
            order: { stepNumber: 'ASC' }, // This is to make sure that the tasks are exectued in the correct order
        });

        if (task) {
            try {
                await taskRunner.run(task);
            } catch (error) {
                console.error(
                    `Task execution failed. Task status has already been updated by TaskRunner.\n`,
                    error,
                );

                // added this for readability
                console.log(`\n-----------------------\n`);
            }
        }

        // Wait before checking for the next task again
        await new Promise((resolve) => {
            setTimeout(resolve, 5000);
        });
    }
}
