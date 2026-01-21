import { useApiStore } from "@/stores/api.store";
import { computed, ref } from "vue";

export class JobPinger {
	job = ref<any | null>(null);
	private pingTimeout = ref(0);
	private startedAt = 0;

	private promiseRes = (job: any) => { };
	private promiseRej = (e: any) => { };
	private onCompleted = () => { };
	private onFailure = () => { };

	constructor(
		readonly jobId: string,
		readonly interval_ms: number = 5000,
		readonly timeout: number = 1000 * 60 * 5,
	) { }

	get isPinging() {
		return computed(() => this.pingTimeout.value !== 0);
	}

	private async fetchJob() {
		const { data } = await useApiStore().api.get('/job/' + this.jobId);
		return data.data;
	}

	private async ping() {
		try {
			if (Date.now() > this.startedAt + this.timeout) {
				throw new Error("Timeout after " + (Date.now() - this.startedAt));
			}

			this.job.value = await this.fetchJob();
			if (['pending', 'running'].includes(this.job.value.status)) {
				this.schedulePing();
				return;
			}
			if (this.job.value.status === 'completed') {
				this.onCompleted();
			}
			if (this.job.value.status === 'failed') {
				this.onFailure();
			}
			this.promiseRes(this.job);
		}
		catch (e) {
			console.error("Error pinging job", e);
			this.promiseRej(e);
		}
	}

	private schedulePing() {
		this.pingTimeout.value = setTimeout(this.ping.bind(this), this.interval_ms);
	}

	private cancelPing() {
		clearTimeout(this.pingTimeout.value);
		this.pingTimeout.value = 0;
	}

	start() {
		// if (props.onCompleted) {
		// 	this.onCompleted = props.onCompleted;
		// }
		// if (onFailure) {
		// 	this.onFailure = onFailure;
		// }

		this.startedAt = Date.now();

		const newPromise = new Promise<any>((res, rej) => {
			this.promiseRes = res;
			this.promiseRej = rej;
		});
		this.ping();
		return newPromise;
	}

	stop() {
		this.cancelPing();
	}
}