import { area } from '@turf/turf';
import { Task } from '../models/Task';
import { Job } from './Job';

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<number> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        const polygonArea = area(JSON.parse(task.geoJson));

        // the readme mentioned saving it to the output field of the task, but there is no output column, so I am assuming something like this is expected
        if (polygonArea) {
            console.log(
                `Polygon area calculated successfully: ${polygonArea.toFixed(2)} m²`,
            );
            return polygonArea;
        }

        console.log('Failed to calculate polygon area');
        throw new Error('Failed to calculate polygon area');
    }
}
