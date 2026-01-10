<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import SelectButton from 'primevue/selectbutton';
import InputText from 'primevue/inputtext';
import type InputGroup from 'primevue/inputgroup';
import type InputGroupAddon from 'primevue/inputgroupaddon';

const { items } = defineProps<{
	items: Array<any>;
}>();

const filterMode = ref<string>('Categories');
// Don't allow removing the option by clicking it agian
watch(filterMode, (newVal, oldVal) => {
	if (!newVal) {
		nextTick(() => {
			filterMode.value = oldVal;
		});
	}
});

const cinemaItems = computed(() => items.filter(i => ['cinema','collection'].includes(i.type)).sort((a) => a.surprise ? -1 : 0));

const cinemaType = ref<'all' | 'movie' | 'series'>('all');
const searchTerm = ref<string>('');

const filteredItems = computed(() => {
	let filtered = cinemaItems.value;

	const filterTypes = {
		'movie': ['movie', 'collection'],
		'series': ['series'],
	}

	filtered = cinemaType.value === 'all' ? filtered : filtered.filter(item =>  !item.surprise && filterTypes[cinemaType.value]!.includes(item.cinemaType) || filterTypes[cinemaType.value]!.includes(item.type));
	filtered = !searchTerm.value ? filtered : filtered.filter(item => !item.surprise && item.name.toLowerCase().replaceAll(/[^\d\w\s]/g, '').includes(searchTerm.value.toLowerCase().replaceAll(/[^\d\w\s]/g, '')));
	return filtered;
});

defineExpose({
	filteredItems,
})
</script>

<template>
	<span class="filters flex-row-center inline-flex gap-2">
		<span>
			<template v-if="cinemaItems.length > filteredItems.length">
				{{ filteredItems.length }} of
			</template>
			{{ cinemaItems.length }}
		</span>
		<SelectButton v-model="cinemaType" :options="['all', 'movie', 'series']" class="text-cap" />
		<span class="search-container relative">
			<i class="pi pi-search" />
			<InputText v-model="searchTerm" placeholder="Search" name="search" class="pl-5 w-6rem h-full" :class="{ data: searchTerm }" />
		</span>
		<!-- </SelectButton> -->
	</span>
</template>

<style scoped lang="scss">

.card-wrapper {
	width: min(min(7rem, 19vh), 20vw);
	min-width: min(min(7rem, 19vh), 20vw);
}

.categories-row {
	--padding: 15px;

	.categories-scroll-wrapper {
		margin: 0 calc(-1 * var(--padding));
		width: 100%;
	}

	.categories-row-items-list {
		padding: 10px var(--padding);
		padding-right: 0;
		display: flex;
		gap: 15px;
	}
}


.search-container {
	i {
		position: absolute;
		top: 50%;
		translate:  .7rem -50%;
	}
	input {
		transition: 300ms;
	    border-color: var(--p-togglebutton-border-color);

		&:not(.data) {
			background: var(--p-togglebutton-background);
		}

		&.data {
			width: 10rem !important;
		}
	}
}

</style>
