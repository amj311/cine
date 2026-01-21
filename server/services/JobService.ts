type JobType = string;

type JobInterface = {
	log: (...messages: Array<string>) => void;
	progress: (percentage: number, data?: any) => void;
}
type JobResolution = {
	error: any;
	data: any;
}

type JobDefinition = {
	type: JobType;
	data?: any;
	priority?: boolean;
	handler: (jobInterFace: JobInterface) => Promise<JobResolution | void>;
}

const JobStatuses = ['pending', 'running', 'completed', 'failed'] as const;
type JobStatus = typeof JobStatuses[number];

type JobId = string;
type Job = {
	jobId: JobId;
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
	result?: JobResolution;
}

const Jobs = new Map<JobId, Job>();

const PriorityQueue: Set<JobId> = new Set();
const MainQueue: Set<JobId> = new Set();

const MAX_ACTIVE_JOBS = 1;
const MAX_DONE_JOBS = 5; // Don't keep too many done jobs in memory
const JOB_INTERVAL = 1000;

export class JobService {
	public static addJob(job: JobDefinition): Job {
		const newJob: Job = {
			jobId: Math.random().toString(36).substring(2, 15),
			type: job.type,
			status: 'pending',
			definition: job,
			createdAt: new Date(),
			logs: [],
		};
		Jobs.set(newJob.jobId, newJob);

		if (job.priority) {
			PriorityQueue.add(newJob.jobId);
		}
		else {
			MainQueue.add(newJob.jobId);
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

	public static get activeJobs(): Job[] {
		return Array.from(Jobs.values()).filter(job => job.status === 'running');
	}
	public static get endedJobs(): Job[] {
		return Array.from(Jobs.values()).filter(job => job.status === 'completed' || job.status === 'failed');
	}

	private static async startNextJobs() {
		if (JobService.activeJobs.length >= MAX_ACTIVE_JOBS) {
			return;
		}

		while (JobService.activeJobs.length < MAX_ACTIVE_JOBS && (PriorityQueue.size > 0 || MainQueue.size > 0)) {
			const queue = PriorityQueue.size > 0 ? PriorityQueue : MainQueue;
			const jobId = queue.values().next().value!;
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
		job.status = 'running';
		job.startedAt = new Date();

		try {
			job.result = (await job.definition.handler({
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
			})) || { error: undefined, data: undefined };

			const error = job.result.error;
			if (error) {
				throw error;
			}
			job.status = 'completed';
		}
		catch (err) {
			job.status = 'failed';
			job.error = err;
		}
		finally {
			job.endedAt = new Date();
			if (this.endedJobs.length > MAX_DONE_JOBS) {
				// delete the oldest completed job
				const oldest = this.getJobs().reduce((j, oldest) => {
					return (j?.startedAt || Infinity) < (oldest?.startedAt || Infinity) ? j : oldest;
				}, Jobs.values().next().value);
				Jobs.delete(oldest?.jobId || '');
			}
			this.startNextJobs();
		}
	}
}
