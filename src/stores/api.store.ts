import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios';

type Host = {
	hostname: string;
	baseUrl: string;
	status?: 'connected' | 'failed';
}

export const useApiStore = defineStore('Api', () => {
	const standardHosts: Array<Host> = [
		...(window.location.href.includes(':5') ? [{ hostname: 'Local', baseUrl: "http://localhost:5000" }] : []),
		{ hostname: 'LAN', baseUrl: import.meta.env.VITE_LAN_HOST_URL },
		{ hostname: 'Remote', baseUrl: import.meta.env.VITE_REMOTE_HOST_URL },
	]
	const additionalHosts = ref<Array<Host>>([]);
	const availableHosts = computed(() => standardHosts.concat(additionalHosts.value));

	const isInitializing = ref(true);
	const selectedHost = ref<Host | null>(null);
	const baseUrl = computed(() => selectedHost.value?.baseUrl + '/api');

	const api = computed(() => {
		return axios.create({
			baseURL: baseUrl.value,
		})
	});


	async function testConnection(host: Host): Promise<boolean> {
		try {
			const response = await axios.get(host.baseUrl);
			const success = response.status === 200;
			host.status = success ? 'connected' : 'failed';
			return success;
		} catch (error) {
			host.status = 'failed';
			console.error(`Connection failed for ${host.hostname}:`, error);
			return false;
		}
	}

	async function connectToFirstAvailableHost() {
		for (const host of availableHosts.value) {
			if (host.baseUrl) {
				const success = await testConnection(host);
				if (success) {
					selectedHost.value = host;
					break;
				}
			}
		}
		isInitializing.value = false;
	}
	connectToFirstAvailableHost().catch((error) => {
		console.error('Error connecting to first available host:', error);
	});

	return {
		isInitializing,
		selectedHost,
		baseUrl,
		api,
		availableHosts,

		resolve(path?: string) {
			if (!path) {
				return '';
			}
			if (!baseUrl.value) {
				throw new Error('No host selected');
			}
			if (path.startsWith('http')) {
				return path;
			}
			if (path.startsWith('/')) {
				return baseUrl.value + path;
			}
			return baseUrl.value + '/' + path;
		}
	}
})
