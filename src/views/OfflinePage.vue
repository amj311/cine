<script
	setup
	lang="ts"
>
import { ref } from 'vue';
import { useToast } from "primevue/usetoast";
import { useApiStore, type Host } from '../stores/api.store';
import DropdownMenu from '@/components/utils/DropdownMenu.vue';

const apiStore = useApiStore();
const toast = useToast();

const attemptingHostConnection = ref<Host | null>(null);
async function attemptHostConnection(host: Host) {
	if (attemptingHostConnection.value) {
		return;
	}
	attemptingHostConnection.value = host;
	try {
		await new Promise((r) => setTimeout(r, 1000));
		const success = await apiStore.connectToHost(host);
		if (success) {
			toast.add({
				severity: 'success',
				summary: 'Connected',
				detail: `Connected to ${host.hostname}`,
				life: 5000,
			});
		} else {
			toast.add({
				severity: 'error',
				summary: 'Failed to connect',
				detail: `Failed to connect to ${host.hostname}`,
				life: 5000,
			});
		}
	} catch (e) {
		toast.add({
			severity: 'error',
			summary: 'Failed to connect',
			detail: `Failed to connect to ${host.hostname}`,
			life: 5000,
		});
	} finally {
		attemptingHostConnection.value = null;
	}
}

function addHost() {
	const name = prompt('Enter the name of the host');
	if (!name) {
		return;
	}
	const url = prompt('Enter the URL of the host');
	if (!url) {
		return;
	}
	const newHost = apiStore.addHost(name, url);
	attemptHostConnection(newHost).catch(console.log);
}

function changeHostUrl(host: Host) {
	const newUrl = prompt('Enter the new URL of the host', host.baseUrl);
	if (!newUrl) {
		return;
	}
	host.baseUrl = newUrl;
	apiStore.updateHost(host.hostname, { baseUrl: newUrl });
}

</script>

<template>
	<div class="flex flex-column align-items-center justify-content-center gap-5">
		<Logo class="mt-5" />
		<h3>Failed to connect to any servers!</h3>
		<div class="flex flex-column gap-2" style="width: 100%; max-width: 25rem;">
			<div
				class="host-card flex gap-3 align-items-center bg-soft p-3 w-full border-round cursor-pointer"
				v-for="host in apiStore.availableHosts"
				:key="host.hostname"
				@click="attemptHostConnection(host)"
			>
				<div class="">
					<div>{{ host.hostname }}</div>
					<div class="text-muted text-small">{{ host.baseUrl }}</div>
				</div>
				<div class="flex-grow-1"></div>
				<div>
					<DropdownMenu
						:model="[
							{
								label: 'Edit',
								icon: 'pi pi-pencil',
								command: () => changeHostUrl(host),
							},
							{
								label: 'Delete',
								icon: 'pi pi-trash',
								command: () => {
									apiStore.removeHost(host.hostname);
								}
							}
						]"
						@click.stop
					>
						<Button
							v-if="host.isCustom"
							icon="pi pi-pencil"
							text
							severity="secondary"
						/>
					</DropdownMenu>
					<Button
						:class="{ 'spin': attemptingHostConnection?.hostname === host.hostname }"
						text
						severity="secondary"
						:icon="'pi pi-sync'"
					/>
					
				</div>
			</div>
		</div>
		<Button
			:label="'Add Host'"
			:icon="'pi pi-plus'"
			text
			@click="addHost"
		/>
	</div>
</template>

<style>
</style>
