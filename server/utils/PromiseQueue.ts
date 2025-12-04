export class PromiseQueue {
	private queue: Array<() => Promise<any>> = [];

	constructor(
		private readonly props: {
			beforeEach?: () => void,
		} = {}
	) { };

	public add<T>(promiseFn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.queue.push(() => promiseFn().then(resolve).catch(reject));
			if (this.queue.length === 1) {
				this.processQueue();
			}
		});
	}

	private async processQueue() {
		while (this.queue.length > 0) {
			const next = this.queue[0];
			try {
				if (this.props.beforeEach) {
					await this.props.beforeEach();
				}
				await next();
			} catch (error) {
				console.error('Error processing queue:', error);
			}
			this.queue.shift();
		}
	}
}