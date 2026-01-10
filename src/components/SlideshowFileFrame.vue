<script setup lang="ts">
import { reactive, computed, ref, watch, nextTick, defineComponent } from 'vue';
import Button from 'primevue/button';
import { useRouter } from 'vue-router';
import GalleryFileFrame, { type GalleryFile } from './GalleryFileFrame.vue';
import { focusAreaClass } from '@/stores/screen.store';
import NavTrigger from './utils/NavTrigger/NavTrigger.vue';
import { useApiStore } from '@/stores/api.store';

const { file, active } = defineProps<{
	onClose?: () => void,
	file: GalleryFile,
	active?: boolean,
	showArrows?: boolean,
	onPrev: () => void,
	onNext: () => void,
}>()

const galleryFrame = ref<InstanceType<typeof GalleryFileFrame>>();
const fileFolders = computed(() => file.relativePath.split('/').slice(1, -1));

defineExpose({
	galleryFrame,
})

const videoSeeker = ref<HTMLInputElement>();

</script>


<template>
	<div class="frame">
		<div class="blur-bg" :style="{ backgroundImage: `url(${useApiStore().apiUrl + '/thumb/' + file.relativePath})`}" />
		<div class="file-wrapper">
			<GalleryFileFrame
				ref="galleryFrame"
				:key="file.relativePath"
				:file="file"
				:loadSequence="active ? ['small', 'large'] : undefined"
				:object-fit="'contain'"
				:autoplay="active"
				:zoom="active"
				:videoBackground="'transparent'"
				:videoSeeker="videoSeeker"
			/>
		</div>
		<div class="top-bar flex justify-content-start align-items-center gap-2 flex-wrap">
			<Button text severity="contrast" @click="onClose" icon="pi pi-times" />
			<div class="flex-grow-1" />
			<Button v-if="showArrows" text severity="contrast" @click="onPrev" icon="pi pi-chevron-left" />
			<Button v-if="showArrows" text severity="contrast" @click="onNext" icon="pi pi-chevron-right" />
		</div>
		<div class="bottom-bar flex flex-column p-3 gap-3">
			<div class="flex gap-3">
				<div class="flex flex-column gap-3 flex-grow-1">
					<h4>{{ file.fileName }}</h4>
					<div v-if="file.takenAt"><i class="pi pi-calendar" /> {{ new Date(file.takenAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</div>
					<div v-if="fileFolders.length"><i class="pi pi-folder-open" /> {{ fileFolders.join(' / ') }}</div>
				</div>
				<div class="actions flex flex-column-center justify-content-end">
					<slot name="actions" />
				</div>
			</div>
			<input v-if="file.fileType === 'video'" ref="videoSeeker" type="range" step="0.01" @touchmove.stop @touchend.stop />
		</div>
	</div>
</template>

<style lang="scss" scoped>
.frame {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;

	.blur-bg {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-size: cover;
		background-position: center;
		filter: blur(25px);
		opacity: .5;
		z-index: -1;
	}

	.top-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: .5em;
		z-index: 40;
		filter: drop-shadow(0 0 5px #0005);
	}

	.bottom-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: .5em;
		z-index: 40;
		filter: drop-shadow(0 0 5px #0005);
		background-image: linear-gradient(to top, #0007, #0000);
	}

	.file-wrapper {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

}
</style>