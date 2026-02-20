<script setup lang="ts">
import ProgressBar from '@/components/ProgressBar.vue'
import { useApiStore } from '@/stores/api.store';
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import NavModal from './utils/NavModal.vue';
const router = useRouter();

const props = defineProps<{
	imageUrl?: string;
	fallbackImage?: string,
	imagePosition?: 'top' | 'center' | 'bottom';
	aspectRatio?: 'tall' | 'wide' | 'square';
	width?: number;
	height?: number;
	title?: string;
	subtitle?: string;
	progress?: any; // Progress
	overrideStartTime?: number;
	playSrc?: string;
	tvNavable?: boolean;
	action?: () => void;
	loading?: boolean;
	surprise?: {
		relativePath: string,
		until: string,
		pin?: string,
		title?: string,
	},
	navJumpRow?: string,
}>();


function playVideo() {
	if (!props.playSrc) {
		return;
	}
	router.push({
		name: 'play',
		query: {
			path: props.playSrc,
			startTime: ((props.progress?.percentage < 90 && props.progress?.time) || props.overrideStartTime) ?? undefined,
		}
	})
}

const normalAction = computed(() => {
	if (props.action) {
		return props.action;
	}
	if (props.playSrc) {
		return playVideo;
	}
	return undefined;
})
const onClick = computed(() => {
	if (hideSurprise.value && canRevealSurprise.value && !revealedSurprise.value) {
		return revealSurprise;
	}
	if (hideSurprise.value && !ignoreSurprise.value) {
		return async () => await surpriseModal.value?.open();
	}
	return normalAction.value;
});

const surpriseModal = ref<InstanceType<typeof NavModal>>();
const revealedSurprise = ref(false);
const hideSurprise = computed(() => props.surprise && !revealedSurprise.value);
const ignoreSurprise = ref(false);
const showPinInput = ref(false);
const draftPin = ref('');
function bypassSurprise() {
	if (draftPin.value === props.surprise?.pin) {
		goToSurprise();
	}
}
async function goToSurprise() {
	ignoreSurprise.value = true;
	await surpriseModal.value?.close();
	if (typeof normalAction.value === 'function') {
		normalAction.value();
	}
	ignoreSurprise.value = false;
	draftPin.value = '';
	showPinInput.value = false;
}
const canRevealSurprise = computed(() => {
	if (!props.surprise || !props.surprise.until) return;
	const revealDateStr = new Date(props.surprise.until).toISOString().slice(0, 10); // 2025-12-25
	const nowDateStr = new Date().toISOString().slice(0, 10); // 2025-12-25
	return nowDateStr >= revealDateStr;
})

async function revealSurprise() {
	if (!props.surprise) return;
	revealedSurprise.value = true;
	await useApiStore().api.post('/surprise', {
		relativePath: props.surprise.relativePath,
		record: null
	});
}
 
const imageError = ref<any>(null);

function activate() {
	const handler = onClick.value;
	if (typeof handler === 'function') {
		handler();
	}
}
</script>

<template>
	<div
		class="media-card"
		:class="{ clickable: onClick }"
		@click="onClick"
		@keydown.enter.prevent="activate"
		@keydown.space.prevent="activate"
		:tabindex="(onClick || tvNavable) ? 0 : -1"
		:role="onClick ? 'button' : undefined"
		:aria-label="onClick ? (title || subtitle || 'Open item') : undefined"
		:data-focus-priority="onClick ? 0 : undefined"
		:data-tvNavJumpRow="navJumpRow"
	>
		<div
			class="poster"
			:class="{ [aspectRatio || 'tall']: true, surprise, revealed: revealedSurprise }"
		>	
			<div class="poster-content">
				<div v-if="$slots.fallbackIcon" class="fallback-icon bg-soft">
					<slot name="fallbackIcon" />
				</div>

				<img v-if="fallbackImage" :src="useApiStore().resolve(fallbackImage)" class="poster-image" :style="{ objectPosition: imagePosition || 'center' }" />
				<img v-if="imageUrl && !imageError" :src="useApiStore().resolve(imageUrl)" class="poster-image" :style="{ objectPosition: imagePosition || 'center' }" @error="(err) => imageError = err" />
				<div v-if="$slots.poster" class="custom-poster">
					<slot name="poster" />
				</div>

				<div v-if="progress?.percentage" class="progress-bar-wrapper">
					<ProgressBar :progress="Math.max(3, progress.percentage)" />
				</div>

				<div v-if="playSrc" class="overlay">
					<div class="play-button"><i class="pi pi-play" /></div>
				</div>
			</div>

			<div v-if="surprise" class="surprise-gift flex align-items-center h-full">
				<img src="@/assets/gift.png" />
			</div>

			<Skeleton v-if="loading" width="100%" height="100%" />
		</div>
		<div v-if="title || subtitle" class="mt-1 p-1">
			<div v-if="title" class="title">{{ hideSurprise ? (surprise?.title || 'Surprise!') : title }}</div>
			<div v-if="subtitle" class="subtitle" style="opacity: .7">{{ hideSurprise ? (canRevealSurprise ? 'Open now!' : 'Coming soon') : subtitle }}</div>
		</div>
	</div>


	<NavModal
		ref="surpriseModal"
		:closeable="false"
		:width="'25rem'"
	>
		<div class="flex flex-column align-items-center gap-4">
			<img src="@/assets/gift.png" style="width: 70%; max-height: 35vh;" tabindex="0" @click="showPinInput = true" />
			<InputText v-model="draftPin" v-if="showPinInput" @keydown.enter="bypassSurprise" placeholder="Enter PIN" />
			<div>This media will open in...</div>
			<div class="text-5xl"><Countdown :endMs="new Date(surprise!.until).getTime()" /></div>
			<Button text severity="secondary" label="Come back later" @click="surpriseModal?.close" />
		</div>
	</NavModal>
</template>

<style scoped lang="scss">
.media-card {
	transition: transform 50ms ease-in-out;
	user-select: none;
	border-radius: 5px;
	overflow: hidden;

	&.clickable:hover, &.clickable:focus-visible, &[tv-focus] {
		cursor: pointer;
		background-color: var(--color-background-mute);
		border: 3px solid var(--color-background-mute);
		margin: -3px;
		outline: 1px solid var(--color-contrast);
		transform: scale(1.03);
	}

	&:not(.clickable) {
		cursor: default;
		pointer-events: none;
	}

	.overlay {
		display: none;
	}

	&:hover, &[tv-focus] {
		.overlay {
			display: flex;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.3);

			.play-button {
				margin: auto auto;
				color: white;
				zoom: 2;
			}
		}

		.fallback-icon {
			background-color: var(--color-background-mute);	
		}
	}
}

.poster-image {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center;
}

.poster {
	position: relative;
	background-position: center;
	background-size: cover;
	background-repeat: no-repeat;
	border-radius: 5px;
	overflow: hidden;

	&.tall {
		aspect-ratio: 2/3;
	}
	&.wide {
		aspect-ratio: 3/2;
	}
	&.square {
		aspect-ratio: 1/1;
	}

	.poster-content {
		position: absolute;
		width: 100%;
		height: 100%;
	}

	.custom-poster {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	.fallback-icon {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		font-size: 3rem;
	}

	.progress-bar-wrapper {
		position: absolute;
		bottom: 0;
		width: 100%;
	}



	&.surprise {
		.poster-content {
			opacity: 0;
		}

		.surprise-gift img {
			position: absolute;
			top: 50%;
			left: 50%;
			width: 100%;
			height: 100%;
			object-fit: contain;
			object-position: center center;
			max-width: 8em;
			translate: -50% -50%;
		}

		&.revealed {
			.poster-content {
				opacity: 1;
				transition: 500ms 1000ms;
			}

			.surprise-gift {
				transform: scale(1.5);
				translate: 0 -150%;
				transition: transform 1000ms, translate 500ms 1000ms;
			}
		}
	}
}

.title, .subtitle {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: .85rem;
}
</style>
