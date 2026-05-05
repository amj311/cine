<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import { useApiStore } from '@/stores/api.store';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const browsePath = ref('');
const folders = ref<{ name: string; relativePath: string }[]>([]);
const loading = ref(false);

/** Strip (YYYY), .imdb-*, .version*, and file extensions from a raw folder segment — same logic as the nav bar. */
function cleanFolderName(segment: string): string {
	// Remove metadata suffixes that start with a dot followed by non-space chars
	const withoutMeta = segment.split(/\.[\S]{1,50}/g)[0] || segment;
	// Remove trailing year in parens
	return withoutMeta.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}

const breadcrumbs = computed(() => {
	if (!browsePath.value) return [];
	return browsePath.value.split('/').filter(Boolean).map((seg) => ({
		raw: seg,
		label: cleanFolderName(seg),
	}));
});

async function loadFolders(path: string) {
	loading.value = true;
	folders.value = [];
	try {
		const { data } = await useApiStore().api.get('/dir/', { params: { path: path || '/' } });
		// libraryItems are already parsed with clean listName and relativePath
		const items: any[] = data.directory?.libraryItems ?? [];
		folders.value = items.map((item) => ({
			name: item.listName ?? item.folderName ?? item.relativePath.split('/').pop(),
			relativePath: item.relativePath,
		}));
	} catch (e) {
		folders.value = [];
	} finally {
		loading.value = false;
	}
}

function openBrowser() {
	browsePath.value = props.modelValue || '';
	open.value = true;
	loadFolders(browsePath.value);
}

function navigateInto(folder: { name: string; relativePath: string }) {
	browsePath.value = folder.relativePath;
	loadFolders(folder.relativePath);
}

function navigateToCrumb(index: number) {
	const path = breadcrumbs.value.slice(0, index + 1).map((b) => b.raw).join('/');
	browsePath.value = path;
	loadFolders(path);
}

function navigateToRoot() {
	browsePath.value = '';
	loadFolders('');
}

function confirmSelection() {
	emit('update:modelValue', browsePath.value);
	open.value = false;
}

function cancel() {
	open.value = false;
}

const displayValue = computed(() => {
	if (!props.modelValue) return '';
	return props.modelValue.split('/').filter(Boolean).map(cleanFolderName).join(' / ');
});
</script>

<template>
	<div class="directory-picker">
		<!-- Trigger row -->
		<div class="picker-trigger" @click="openBrowser">
			<span class="picker-path" :class="{ placeholder: !modelValue }">
				{{ displayValue || 'Select directory…' }}
			</span>
			<i class="pi pi-folder-open picker-icon" />
		</div>

		<!-- Browser panel -->
		<div v-if="open" class="picker-panel">
			<!-- Breadcrumb bar -->
			<div class="breadcrumbs">
				<button class="crumb root-crumb" @click="navigateToRoot">
					<i class="pi pi-home" />
				</button>
				<template v-for="(crumb, i) in breadcrumbs" :key="i">
					<i class="pi pi-angle-right crumb-sep" />
					<button
						class="crumb"
						:class="{ 'crumb-active': i === breadcrumbs.length - 1 }"
						@click="navigateToCrumb(i)"
					>{{ crumb.label }}</button>
				</template>
			</div>

			<!-- Folder list -->
			<div class="folder-list">
				<div v-if="loading" class="folder-list-empty">
					<i class="pi pi-spinner spin" /> Loading…
				</div>
				<div v-else-if="folders.length === 0" class="folder-list-empty">
					No sub-folders
				</div>
				<button
					v-for="folder in folders"
					:key="folder.relativePath"
					class="folder-item"
					@click="navigateInto(folder)"
				>
					<i class="pi pi-folder" />
					<span>{{ folder.name }}</span>
					<i class="pi pi-angle-right folder-arrow" />
				</button>
			</div>

			<!-- Actions -->
			<div class="picker-actions">
				<Button label="Cancel" severity="secondary" variant="text" size="small" @click="cancel" />
				<Button label="Select this folder" size="small" @click="confirmSelection" />
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
.directory-picker {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	min-width: 0;
}

.picker-trigger {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.35rem 0.5rem;
	border-radius: 4px;
	background: #ffffff0a;
	border: 1px solid #ffffff18;
	cursor: pointer;
	min-width: 0;
	transition: border-color 0.15s, background 0.15s;

	&:hover {
		border-color: #ffffff35;
		background: #ffffff12;
	}
}

.picker-path {
	flex: 1;
	min-width: 0;
	font-size: 0.85rem;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	direction: rtl;
	text-align: left;

	&.placeholder {
		opacity: 0.4;
		direction: ltr;
	}
}

.picker-icon {
	font-size: 0.85rem;
	opacity: 0.6;
	flex-shrink: 0;
}

.picker-panel {
	border: 1px solid #ffffff20;
	border-radius: 6px;
	background: #1a1a2a;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	// span across all grid columns when inside a source-row grid
	grid-column: 1 / -1;
}

.breadcrumbs {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.1rem;
	padding: 0.4rem 0.6rem;
	border-bottom: 1px solid #ffffff15;
	background: #ffffff06;
	min-height: 2rem;
}

.crumb {
	background: none;
	border: none;
	color: inherit;
	font-size: 0.8rem;
	padding: 0.1rem 0.25rem;
	border-radius: 3px;
	cursor: pointer;
	opacity: 0.7;
	transition: opacity 0.1s, background 0.1s;

	&:hover {
		opacity: 1;
		background: #ffffff15;
	}

	&.crumb-active {
		opacity: 1;
		font-weight: 600;
	}
}

.root-crumb {
	display: flex;
	align-items: center;
}

.crumb-sep {
	font-size: 0.65rem;
	opacity: 0.35;
}

.folder-list {
	max-height: 14rem;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
}

.folder-list-empty {
	padding: 1rem;
	text-align: center;
	font-size: 0.85rem;
	opacity: 0.45;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.4rem;
}

.folder-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.45rem 0.75rem;
	background: none;
	border: none;
	color: inherit;
	font-size: 0.85rem;
	cursor: pointer;
	transition: background 0.1s;
	text-align: left;

	&:hover {
		background: #ffffff10;
	}

	.pi-folder {
		font-size: 0.9rem;
		opacity: 0.6;
		flex-shrink: 0;
	}

	span {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.folder-arrow {
		font-size: 0.7rem;
		opacity: 0.35;
		flex-shrink: 0;
	}
}

.picker-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
	padding: 0.4rem 0.5rem;
	border-top: 1px solid #ffffff15;
	background: #ffffff06;
}

.spin {
	animation: spin 1s linear infinite;
}

@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
</style>
