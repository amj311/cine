import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios';
import { AuthService } from '@/services/AuthService';

export type Host = {
	hostname: string;
	baseUrl: string;
	status?: 'connected' | 'failed';
	isCustom?: boolean;
}

export const useApiStore = defineStore('Api', () => {
	const standardHosts: Array<Host> = [
		...(window.location.href.includes(':5') ? [{ hostname: 'Local', baseUrl: "http://localhost:5000" }] : []),
		{ hostname: 'Remote', baseUrl: import.meta.env.VITE_REMOTE_HOST_URL },
		{ hostname: 'LAN', baseUrl: import.meta.env.VITE_LAN_HOST_URL },
	]
	const additionalHosts = ref<Array<Host>>(loadCustomHosts());
	const availableHosts = computed(() => standardHosts.concat(additionalHosts.value));

	const isInitializing = ref(true);
	const selectedHost = ref<Host | null>(null);
	const baseUrl = computed(() => selectedHost.value?.baseUrl);
	const apiUrl = computed(() => selectedHost.value?.baseUrl + '/api');

	const api = computed(() => {
		const client = axios.create({
			baseURL: apiUrl.value,
		})

		client.interceptors.request.use(async (config) => {
			const token = await AuthService.getToken();
			if (token) {
				config.headers.Authorization = token;
			}
			return config;
		});

		client.interceptors.response.use(null, (error) => {
			if (error.isAxiosError && error.response?.status === 401) {
				console.log("Received unauthenticated response. Logging out");
				AuthService.signOut();
			}

			return Promise.reject(error);
		})

		return client;
	});

	async function testConnection(host: Host): Promise<boolean> {
		try {
			const response = await axios.get(host.baseUrl + '/health');
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
		let successfulHost;
		for (const host of availableHosts.value) {
			if (host.baseUrl) {
				const success = await testConnection(host);
				if (success) {
					successfulHost = host;
					break;
				}
			}
		}
		selectedHost.value = successfulHost || null;
		isInitializing.value = false;
	}
	connectToFirstAvailableHost().catch((error) => {
		console.error('Error connecting to first available host:', error);
	});

	async function connectToHost(host: Host) {
		if (host.baseUrl) {
			const success = await testConnection(host);
			if (success) {
				selectedHost.value = host;
				return true;
			}
		}
		return false;
	}


	function loadCustomHosts(): Array<Host> {
		return JSON.parse(localStorage.getItem('customHosts') || '[]');
	}

	function saveCustomHosts() {
		localStorage.setItem('customHosts', JSON.stringify(additionalHosts.value));
	}

	function addHost(name: string, baseUrl: string) {
		const newHost: Host = {
			hostname: name,
			baseUrl: baseUrl,
			isCustom: true,
		};
		additionalHosts.value.push(newHost);
		saveCustomHosts();
		return newHost;
	}

	function updateHost(name: string, data: Partial<Host>) {
		const host = additionalHosts.value.find((host) => host.hostname === name);
		if (host && host.isCustom) {
			Object.assign(host, data);
			saveCustomHosts();
		}
	}

	function removeHost(name: string) {
		const host = additionalHosts.value.find((host) => host.hostname === name);
		if (host && host.isCustom) {
			additionalHosts.value = additionalHosts.value.filter((h) => h.hostname !== name);
			saveCustomHosts();
		}
	}

	return {
		isInitializing,
		selectedHost,
		baseUrl,
		apiUrl,
		api,
		availableHosts,
		connectToHost,
		addHost,
		updateHost,
		removeHost,

		resolve(path?: string) {
			if (!path) {
				return '';
			}
			if (!apiUrl.value) {
				throw new Error('No host selected');
			}
			let resolvedPath = path;
			if (path.startsWith('http')) {
				resolvedPath = path.replace(/\/api\//, '/');
			}
			else if (path.startsWith('/')) {
				resolvedPath = apiUrl.value + path;
			}
			else {
				resolvedPath = apiUrl.value + '/' + path;
			}
			return resolvedPath;
		}
	}
})
