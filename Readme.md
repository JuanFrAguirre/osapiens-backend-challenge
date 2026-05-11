# Backend Coding Challenge

## Getting Started

1. Fork the Project:
   ![There is a button on the top right of you codesandbox environment after signing in](public/image.png)
2. Start Coding

This repository demonstrates a backend architecture that handles asynchronous tasks, workflows, and job execution using TypeScript, Express.js, and TypeORM. The project showcases how to:

- Define and manage entities such as `Task` and `Workflow`.
- Use a `WorkflowFactory` to create workflows from YAML configurations.
- Implement a `TaskRunner` that executes jobs associated with tasks and manages task and workflow states.
- Run tasks asynchronously using a background worker.

## Key Features

1. **Entity Modeling with TypeORM**
    - **Task Entity:** Represents an individual unit of work with attributes like `taskType`, `status`, `progress`, and references to a `Workflow`.
    - **Workflow Entity:** Groups multiple tasks into a defined sequence or steps, allowing complex multi-step processes.

2. **Workflow Creation from YAML**
    - Use `WorkflowFactory` to load workflow definitions from a YAML file.
    - Dynamically create workflows and tasks without code changes by updating YAML files.

3. **Asynchronous Task Execution**
    - A background worker (`taskWorker`) continuously polls for `queued` tasks.
    - The `TaskRunner` runs the appropriate job based on a task’s `taskType`.

4. **Robust Status Management**
    - `TaskRunner` updates the status of tasks (from `queued` to `in_progress`, `completed`, or `failed`).
    - Workflow status is evaluated after each task completes, ensuring you know when the entire workflow is `completed` or `failed`.

5. **Dependency Injection and Decoupling**
    - `TaskRunner` takes in only the `Task` and determines the correct job internally.
    - `TaskRunner` handles task state transitions, leaving the background worker clean and focused on orchestration.

## Project Structure

```
src
├─ data/
│   └─ world_data.json          # World data used for analysis
│
├─ models/
│   ├─ Result.ts                # Defines the Result entity
│   ├─ Task.ts                  # Defines the Task entity
│   └─ Workflow.ts              # Defines the Workflow entity
│
├─ jobs/
│   ├─ Job.ts                   # Job interface
│   ├─ JobFactory.ts            # getJobForTaskType function for mapping tasktype to a Job
│   ├─ DataAnalysisJob.ts       # Detects which country a polygon falls within
│   ├─ EmailNotificationJob.ts  # Notificates via email
│   ├─ PolygonAreaJob.ts        # Computes polygon area from coordenates
│   └─ ReportGenerationJob.ts   # Generates a report of the Workflow
│
├─ workflows/
│   ├─ WorkflowFactory.ts       # Creates workflows & tasks from a YAML definition
│   └─ example_workflow.yml     # An example workflow for testing purposes
│
├─ workers/
│   ├─ taskRunner.ts            # Background runner that executes the jobs of a given task
│   └─ taskWorker.ts            # Background worker that fetches queued tasks & runs them
│
├─ routes/
│   ├─ analysisRoutes.ts        # POST /analysis endpoint to create workflows
│   ├─ defaultRoute.ts          # Default root route
│   └─ workflowRoutes.ts        # POST & GET - /analysis endpoints to create and read workflows and their state
│
├─ data-source.ts               # TypeORM DataSource configuration
└─ index.ts                     # Express.js server initialization & starts the worker

requests.http                   # REST Client request collection for testing purposes
```

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm or yarn
- SQLite or another supported database

### Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/yourusername/backend-coding-challenge.git
    cd backend-coding-challenge
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Configure TypeORM:**
    - Edit `data-source.ts` to ensure the `entities` array includes `Task` and `Workflow` entities.
    - Confirm database settings (e.g. SQLite file path).

4. **Create or Update the Workflow YAML:**
    - Place a YAML file (e.g. `example_workflow.yml`) in a `workflows/` directory.
    - Define steps, for example:
        ```yaml
        name: 'example_workflow'
        steps:
            - taskType: 'analysis'
              stepNumber: 1
            - taskType: 'notification'
              stepNumber: 2
            - taskType: 'polygonArea'
              stepNumber: 3
              dependsOn: 1
            - taskType: 'reportGeneration'
              stepNumber: 4
        ```
    - The (optional) `dependsOn` field references another step's `stepNumber`. A task with `dependsOn` will not execute until the referenced step has reached a terminal stat (either `completed` or `failed`). Invalid references throw at workflow creation, before any DB writes.

### Running the Application

1. **Compile TypeScript (optional if using `ts-node`):**

    ```bash
    npx tsc
    ```

2. **Start the server:**

    ```bash
    npm start
    ```

    If using `ts-node`, this will start the Express.js server and the background worker after database initialization.

3. **Create a Workflow (e.g. via `/analysis`):**

    ```bash
    curl -X POST http://localhost:3000/analysis \
    -H "Content-Type: application/json" \
    -d '{
     "clientId": "client123",
     "geoJson": {
         "type": "Polygon",
         "coordinates": [
             [
                 [
                     -63.624885020050996,
                     -10.311050368263523
                 ],
                 [
                     -63.624885020050996,
                     -10.367865108370523
                 ],
                 [
                     -63.61278302732815,
                     -10.367865108370523
                 ],
                 [
                     -63.61278302732815,
                     -10.311050368263523
                 ],
                 [
                     -63.624885020050996,
                     -10.311050368263523
                 ]
             ]
         ]
     }
     }'
    ```

    This will read the configured workflow YAML, create a workflow and tasks, and queue them for processing.

4. **Check Logs:**
    - The worker picks up tasks from `queued` state.
    - `TaskRunner` runs the corresponding job (e.g., data analysis, email notification) and updates states.
    - Once tasks are done, the workflow is marked as `completed`.

### **Coding Challenge Tasks for the Interviewee**

The following tasks must be completed to enhance the backend system:

---

### **1. Add a New Job to Calculate Polygon Area**

**Objective:**  
Create a new job class to calculate the area of a polygon from the GeoJSON provided in the task.

#### **Steps:**

1. Create a new job file `PolygonAreaJob.ts` in the `src/jobs/` directory.
2. Implement the `Job` interface in this new class.
3. Use `@turf/area` to calculate the polygon area from the `geoJson` field in the task.
4. Save the result in the `output` field of the task.

#### **Requirements:**

- The `output` should include the calculated area in square meters.
- Ensure that the job handles invalid GeoJSON gracefully and marks the task as failed.

---

### **2. Add a Job to Generate a Report**

**Objective:**  
Create a new job class to generate a report by aggregating the outputs of multiple tasks in the workflow.

#### **Steps:**

1. Create a new job file `ReportGenerationJob.ts` in the `src/jobs/` directory.
2. Implement the `Job` interface in this new class.
3. Aggregate outputs from all preceding tasks in the workflow into a JSON report. For example:
    ```json
    {
        "workflowId": "<workflow-id>",
        "tasks": [
            {
                "taskId": "<task-1-id>",
                "type": "polygonArea",
                "output": "<area>"
            },
            {
                "taskId": "<task-2-id>",
                "type": "dataAnalysis",
                "output": "<analysis result>"
            }
        ],
        "finalReport": "Aggregated data and results"
    }
    ```
4. Save the report as the `output` of the `ReportGenerationJob`.

#### **Requirements:**

- Ensure the job runs only after all preceding tasks are complete.
- Handle cases where tasks fail, and include error information in the report.

---

### **3. Support Interdependent Tasks in Workflows**

**Objective:**  
Modify the system to support workflows with tasks that depend on the outputs of earlier tasks.

#### **Steps:**

1. Update the `Task` entity to include a `dependency` field that references another task
2. Modify the `TaskRunner` to wait for dependent tasks to complete and pass their outputs as inputs to the current task.
3. Extend the workflow YAML format to specify task dependencies (e.g., `dependsOn`).
4. Update the `WorkflowFactory` to parse dependencies and create tasks accordingly.

#### **Requirements:**

- Ensure dependent tasks do not execute until their dependencies are completed.
- Test workflows where tasks are chained through dependencies.

---

### **4. Ensure Final Workflow Results Are Properly Saved**

**Objective:**  
Save the aggregated results of all tasks in the workflow as the `finalResult` field of the `Workflow` entity.

#### **Steps:**

1. Modify the `Workflow` entity to include a `finalResult` field:
2. Aggregate the outputs of all tasks in the workflow after the last task completes.
3. Save the aggregated results in the `finalResult` field.

#### **Requirements:**

- The `finalResult` must include outputs from all completed tasks.
- Handle cases where tasks fail, and include failure information in the final result.

---

### **5. Create an Endpoint for Getting Workflow Status**

**Objective:**  
Implement an API endpoint to retrieve the current status of a workflow.

#### **Endpoint Specification:**

- **URL:** `/workflow/:id/status`
- **Method:** `GET`
- **Response Example:**
    ```json
    {
        "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
        "status": "in_progress",
        "completedTasks": 3,
        "totalTasks": 5
    }
    ```

#### **Requirements:**

- Include the number of completed tasks and the total number of tasks in the workflow.
- Return a `404` response if the workflow ID does not exist.

---

### **6. Create an Endpoint for Retrieving Workflow Results**

**Objective:**  
Implement an API endpoint to retrieve the final results of a completed workflow.

#### **Endpoint Specification:**

- **URL:** `/workflow/:id/results`
- **Method:** `GET`
- **Response Example:**
    ```json
    {
        "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
        "status": "completed",
        "finalResult": {
            "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
            "status": "completed",
            "tasks": [
                {
                    "taskId": "...",
                    "type": "polygonArea",
                    "status": "completed",
                    "output": 8363324.27
                },
                {
                    "taskId": "...",
                    "type": "notification",
                    "status": "failed",
                    "error": "Task failed"
                }
            ]
        }
    }
    ```

#### **Requirements:**

- Return the `finalResult` field of the workflow if it is in a terminal state (`completed` or `failed`).
- Return a `404` response if the workflow ID does not exist.
- Return a `400` response if the workflow is still `initial` or `in_progress`.

---

### **Deliverables**

- **Code Implementation:**
    - New jobs: `PolygonAreaJob` and `ReportGenerationJob`.
    - Enhanced workflow support for interdependent tasks.
    - Workflow final results aggregation.
    - New API endpoints for workflow status and results.

- **Documentation:**
    - Update the README file to include instructions for testing the new features.
    - Document the API endpoints with request and response examples.

---

### **Implementation Notes**

#### **Testing**

A `requests.http` file at the project root contains some pre-filled requests for every endpoint, which were orignally put there just for testing purposes, covering both happy and failure scenarios. Open it in VS Code/Cursor with a REST client extension installed and click _*Send Request*_ above any block to test them out.

Example flow:

1. click _Send Request_ above `createBrazil` (or `createPoint`) to start a workflow.
2. wait ~25 seconds for all four tasks to finish.
3. click _Send Request_ above the matching `/results` request to retrieve the aggregated output.

---

#### **Some Design Decisions**

- **StepNumber ordering**
     The worker orders queued tasks by `stepNumber ASC` and, combined with the explicit `dependency` FK from Task 3, guarantees within-workflow ordering without a heavier scheduler. `ReportGenerationJob` relies on this to know its siblings have finished before aggregating their outputs.
- **`finalResult` saved on terminal state, not on first failure.**
     The workflow may have movd to `failed` as soon as one task would fail, but `finalResult` is only computed once every task has reached `completed` or `failed`. This stops it from being overwritten on each subsequent task transition and matches the Readme's "after the last task completes" wording.
- **Failed workflows are still retrievable.**
     `GET /workflow/:id/results` returns `200` for both `completed` and `failed` instead of `400` for failed runs. One can inspect per-task failure details via the `finalResult.tasks[]` entries.
- **`WorkflowFactory` validates dependencies before saving.** Bad `dependsOn` references throw before any DB write, preventing the route from returning `500` while still queueing orphan tasks for the worker to pick up.
- **`Job.run(task, input?)` interface extension is non-breaking.** Existing jobs (analysis, notification) ignore the second argument and still satisfy the interface. Jobs that care about dependency outputs can read it directly.

---
