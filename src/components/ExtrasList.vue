<script
	setup
	lang="ts"
>
import { useRouter } from 'vue-router';
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { MetadataService } from '@/services/metadataService';
import { useBackgroundStore } from '@/stores/background.store';
import Scroll from '@/components/Scroll.vue';
import { useApiStore } from '@/stores/api.store';

const props = defineProps<{
	extras: any[]; // extras
}>();


const extraTypeLabels = {
	'trailer': 'Trailer',
	'featurette': 'Featurette',
	'behindthescenes': 'Behind the Scenes',
	'deleted': 'Deleted',
}
const sortedExtras = computed(() => {
	return props.extras.sort((a, b) => {
		if (a.extraType === b.extraType) {
			return a.name?.localeCompare(b.name);
		}
		return a.extraType?.localeCompare(b?.extraType);
	});
});

</script>

<template>
	<div style="margin-left: -10px;">
		<Scroll>
			<div class="extras-list">
				<div class="extra-item" v-for="extra in sortedExtras" :key="extra.relativePath">
					<div class="extra-poster-wrapper">
						<MediaCard
							:progress="extra.watchProgress"
							:aspectRatio="'wide'"
							:imageUrl="extra.still_thumb"
							:title="extra.name"
							:subtitle="extraTypeLabels[extra.extraType]"
							:playSrc="extra.relativePath"
						>
							<template #fallbackIcon>🎬</template>
						</MediaCard>
					</div>
				</div>
			</div>
		</Scroll>
	</div>
	
</template>

<style
	lang="scss"
	scoped
>

.extras-list {
	display: flex;
	gap: 15px;
	padding: 10px;
}

.extra-poster-wrapper {
	width: min(250px, 30vw);
}

</style>
