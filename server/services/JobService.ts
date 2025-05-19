type JobType = string;

type JobInterface = {
	log: (...messages: Array<string>) => void;
	progress: (percentage: number, data: any) => void;
}
type JobResolution = {
	error: any;
	data: any;
}

type JobDefinition<T = JobType, D = any> = {
	type: T;
	data: D;
	handler: (jobInterFace: JobInterface) => Promise<JobResolution>;
}

enum JobStatus { 'pending', 'running', 'completed', 'failed' };
type JobId = string;
type Job = {
	id: JobId;
	type: JobType;
	definition: JobDefinition;
	status: JobStatus;
	error?: any;
	createdAt: Date;
	startedAt?: Date;
	endedAt?: Date;
	progressedAt?: Date;
	progress?: {
		percentage: number;
		data: any;
	},
	logs: Array<Array<string>>;
}

const Jobs = new Map<JobId, Job>();

const PriorityQueue: Set<JobId> = new Set();
const MainQueue: Set<JobId> = new Set();
const ActiveJobs: Set<JobId> = new Set();
const EndedJobs: Array<JobId> = [];

const MAX_ACTIVE_JOBS = 1;
const MAX_DONE_JOBS = 5; // Don't keep too many done jobs in memory
const JOB_INTERVAL = 1000;

export class JobService {
	public static addJob(job: JobDefinition, priority?: boolean): Job {
		const newJob: Job = {
			id: Math.random().toString(36).substring(2, 15),
			type: job.type,
			status: JobStatus.pending,
			definition: job,
			createdAt: new Date(),
			logs: [],
		};
		Jobs.set(newJob.id, newJob);

		if (priority) {
			PriorityQueue.add(newJob.id);
		}
		else {
			MainQueue.add(newJob.id);
		}

		JobService.startNextJobs().catch((err) => {
			console.error("Error while starting next jobs:", err);
		});

		return newJob;
	}

	public static getJob(jobId: JobId): Job | undefined {
		return Jobs.get(jobId);
	}

	public static getJobs(): Job[] {
		return Array.from(Jobs.values());
	}


	private static async startNextJobs() {
		if (ActiveJobs.size >= MAX_ACTIVE_JOBS) {
			return;
		}

		while (ActiveJobs.size < MAX_ACTIVE_JOBS && (PriorityQueue.size > 0 || MainQueue.size > 0)) {
			const queue = PriorityQueue.size > 0 ? PriorityQueue : MainQueue;
			const jobId = queue.values().next().value;
			if (queue === MainQueue) {
				await new Promise((resolve) => setTimeout(resolve, JOB_INTERVAL));
			}
			queue.delete(jobId);
			JobService.doJob(Jobs.get(jobId)!).catch((err) => {
				console.error("Error while doing job:", err);
			});
		}
	}

	private static async doJob(job: Job) {
		job.status = JobStatus.running;
		job.startedAt = new Date();
		ActiveJobs.add(job.id);

		try {
			const result = await job.definition.handler({
				log: (message) => {
					job.progressedAt = new Date();
					job.progress = {
						percentage: 0,
						data: message,
					};
				},
				progress: (percentage, data) => {
					job.progressedAt = new Date();
					job.progress = {
						percentage,
						data,
					};
				}
			});

			const error = result.error;
			if (error) {
				throw error;
			}
			job.status = JobStatus.completed;
		}
		catch (err) {
			job.status = JobStatus.failed;
			job.error = err;
		}
		finally {
			job.endedAt = new Date();
			JobService.startNextJobs();
			JobService.addDoneJob(job.id);
		}
	}

	private static addDoneJob(jobId: JobId) {
		EndedJobs.push(jobId);
		ActiveJobs.delete(jobId);
		if (EndedJobs.length > MAX_DONE_JOBS) {
			const oldJobId = EndedJobs.shift();
			if (oldJobId) {
				Jobs.delete(oldJobId);
			}
		}
	}
}
