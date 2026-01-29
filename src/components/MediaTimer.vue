<script
	setup
	lang="ts"
>
import { useApiStore } from '@/stores/api.store';
import type ToggleSwitch from 'primevue/toggleswitch';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import DurationInput from './utils/DurationInput.vue';
import { msToTimestamp } from '@/utils/miscUtils';

const { mediaEl, inPlayer = false } = defineProps<{
	mediaEl?: HTMLMediaElement;
	inPlayer?: boolean;
}>();

const loading = ref(true);

const timerState = ref({
	running: false,
	timeLeft_ms: 1,
	totalTime_ms: 1,
	config: {
		maxTime_ms: 0,
		startTime_ms: 1,
		tapValue_ms: 0,
	}
});

async function fetchTimerState() {
	const { data } = await useApiStore().api.get('/timer');
	timerState.value = data.data;

	if (timerState.value.timeLeft_ms <= 0) {
		// paused by time, NOT media
		pausedByMedia.value = false;
		await mediaEl?.pause();
	} else if (!pausedByMedia.value) {
		mediaEl?.play();
	}
}

const pausedByMedia = ref(false);
async function pause() {
	const { data } = await useApiStore().api.put('/timer/pause');
	timerState.value = data.data;
}

async function pauseTimerOnly() {
	pausedByMedia.value = false;
	await pause();
}

/** 1 Second Total time is used to indicate the timer in a neutral state */
const hasRun = computed(() => timerState.value.totalTime_ms !== 1);

async function start() {
	const { data } = await useApiStore().api.put('/timer/start', { timeLeft_ms: timerState.value.config.startTime_ms });
	timerState.value = data.data;
	mediaEl?.play();
}
async function reset() {
	const { data } = await useApiStore().api.put('/timer/reset');
	timerState.value = data.data;
}

async function updateConfig() {
	const { data } = await useApiStore().api.put('/timer/config', timerState.value.config);
	timerState.value = data.data;
}

async function unpause(timeLeft_ms?: number) {
	const { data } = await useApiStore().api.put('/timer/start', { timeLeft_ms });
	timerState.value = data.data;
	mediaEl?.play();
}

async function addTime() {
	const { data } = await useApiStore().api.put('/timer/add');
	timerState.value = data.data;
	mediaEl?.play();
}

let interval = null as any;

const timerRef = ref<HTMLElement>();
const mouseIn = ref(false);

onMounted(async () => {
	mediaEl?.addEventListener('pause', () => {
		pausedByMedia.value = true;
		pause();
	});
	mediaEl?.addEventListener('play', () => {
		if (pausedByMedia.value) {
			unpause();
		}
	});
	mediaEl?.addEventListener('ended', () => {
		pausedByMedia.value = true;
		pause();
	});

	timerRef.value?.addEventListener('mouseenter', () => nextTick(() => mouseIn.value = true));
	timerRef.value?.addEventListener('mouseleave', () => mouseIn.value = false);

	await fetchTimerState();
	loading.value = false;

	interval = setInterval(fetchTimerState, 1000);

	requestWakeLock();
});


onUnmounted(() => {
	clearInterval(interval);
	releaseWakeLock();
});


const wakeLock = ref<WakeLockSentinel | null>(null);
const isWakeLockOn = computed(() => !wakeLock.value?.released);

async function requestWakeLock() {
	if ('wakeLock' in navigator) {
		try {
			wakeLock.value = await navigator.wakeLock.request('screen');
		}
		catch (e) {
			console.error("Failed to acquire wake lock", e);
			wakeLock.value = null;
		}
	}
}
async function releaseWakeLock() {
	if (wakeLock.value) {
		await wakeLock.value.release();
		wakeLock.value = null;
	}
}
async function toggleWakeLock() {
	if (wakeLock.value) {
		await releaseWakeLock();
		console.log(wakeLock.value)
	}
	else {
		await requestWakeLock();
	}
}

const buttonActive = ref(false);


const status = computed(() => {
	if (!hasRun.value) {	
		return 'unstarted';
	}
	if (!timerState.value.running && timerState.value.timeLeft_ms) {
		return 'paused';
	}
	if (!timerState.value.timeLeft_ms) {
		return 'ended';
	}
	else {
		return 'running';
	}
});

async function handleClick() {
	if (inPlayer && !mouseIn.value) {
		return;
	}
	
	buttonActive.value = true;
	setTimeout(() => {
		buttonActive.value = false;
	}, 150);

	switch (status.value) {
		case 'paused':
			await unpause();
			break;

		case 'unstarted':
			await start();
			break;

		case 'ended':
		case 'running':
			await addTime();
			break;
	
		default:
			break;
	}
}

const timerColor = computed(() => (!hasRun.value || timerState.value.timeLeft_ms) ? '#ffffff' : 'red');
const remainingRatio = computed(() => {
	if (loading.value) {
		return 0;
	}
	if (!timerState.value.timeLeft_ms) {
		// Show a full red circle when. no time is left
		return 1;
	}
	return (timerState.value.timeLeft_ms / timerState.value.totalTime_ms)
})

const strokeWidth = computed(() => inPlayer ? 25 : 10);


const showPhoneQR = ref(false);
const remoteUrl = computed(() => location.origin + '/remote');
const qrUrl = computed(() => "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(remoteUrl.value))
</script>

<template>
	<div class="media-timer" ref="timerRef" :class="{ inPlayer, mouseIn }">
		<Button class="svg-wrapper"
			text
			:class="{ active: buttonActive }"
			@click="handleClick"
		>
			<svg viewBox="0 0 200 200"
				preserve-aspect-ratio
				:style="{
					filter: `drop-shadow(0 0 0px ${timerColor})`
				}">
				<circle cx="100"
					cy="100"
					r="80"
					fill="var(--color-background)"
					stroke-width="10" />
				<circle cx="100"
					cy="100"
					r="80"
					fill="none"
					:stroke="timerColor"
					:stroke-width="strokeWidth"
					:stroke-dasharray="2 * Math.PI * 80"
					:stroke-dashoffset="2 * Math.PI * 80 * (1 - remainingRatio)"
					transform="rotate(-90 100 100)" />
				<text
					v-if="!inPlayer"
					x="50%"
					y="51%"
					dominant-baseline="middle"
					text-anchor="middle"
					font-size="24"
					fill="var(--color-heading)"
				>
					<template v-if="loading"></template>
					<template v-else-if="status === 'unstarted'">Start</template>
					<template v-else-if="status === 'paused'">Continue</template>
					<template v-else-if="status === 'ended'">+ Add Time</template>
				</text>
				<g v-if="!inPlayer && status === 'running'">
					<text
						x="50%"
						y="50%"
						dominant-baseline="middle"
						text-anchor="middle"
						font-size="28"
						fill="var(--color-heading)"
					>
						{{ msToTimestamp(timerState.timeLeft_ms, true) }}
					</text>
					<text
						x="50%"
						y="65%"
						dominant-baseline="middle"
						text-anchor="middle"
						font-size="12"
						fill="var(--color-heading)"
					>
						+ Add Time
					</text>
				</g>
			</svg>
			<!-- Small svg icons for player -->
			<!-- Can't display these icons in the svg -->
			<div class="absolute top-50 left-50" style="translate: -50% -50%; color: #fff">
				<div v-if="inPlayer && mouseIn">
					<template v-if="loading"></template>
					<template v-else-if="status === 'running' || status === 'ended'"><i class="pi pi-plus" /></template>
					<template v-else><i class="pi pi-play" /></template>
				</div>
				<template v-if="loading"><i class="pi pi-spin pi-spinner"></i></template>
			</div>
		</Button>

		<div class="other-buttons flex align-items-center gap-1">
			<Button v-if="inPlayer" @click="showPhoneQR = true" icon="pi pi-mobile" severity="secondary" size="large" />
			<Button v-if="hasRun && timerState.running" @click="pauseTimerOnly" icon="pi pi-pause" severity="secondary" size="large" label="Pause Timer" />
			<Button v-if="hasRun" @click="reset" icon="pi pi-stop" severity="secondary" size="large" label="Cancel" />
		</div>

		<div class="non-media-buttons" v-if="!inPlayer" style="order: 3">
			<div
				style="display: grid; grid-template-columns: 1fr auto; gap: 1em; align-items: center; min-width: 20rem;"
				class="w-full mt-6"
			>
				<label>Tap value</label>
				<div>
					<DurationInput v-model="timerState.config.tapValue_ms" @change="updateConfig" :steppers="false" :units="['m', 's']" />
				</div>

				<label>Starting time</label>
				<div>
					<DurationInput v-model="timerState.config.startTime_ms" @change="updateConfig" :steppers="false" :units="['m', 's']" />
				</div>

				<label>Max time</label>
				<div>
					<DurationInput v-model="timerState.config.maxTime_ms" @change="updateConfig" :steppers="false" :units="['m', 's']" />
				</div>


				<label>Keep screen on</label>
				<div>
					<ToggleSwitch :modelValue="isWakeLockOn" @click="toggleWakeLock" />
				</div>
			</div>
		</div>
	</div>

	<Dialog v-model:visible="showPhoneQR" modal header="Remote Control" :style="{ width: '25rem' }">
		<div>Scan to open the timer controls on your phone</div>
		<div class="w-full flex justify-content-center my-3">
			<img
				:src='qrUrl'
				id="remoteQR"
				class="w-full max-w-15rem square"
			/>
		</div>
		
		<div>or visit <a :href="remoteUrl" target="_blank">{{remoteUrl}}</a></div>
	</Dialog>
</template>

<style
	lang="scss"
	scoped
>
.media-timer {
	display: flex;
	flex-direction: column;
	align-items: center;

	&.inPlayer {
		flex-direction: row;

		.svg-wrapper {
			flex: 0 0 5rem;
		}

		.other-buttons {
			order: 0;
			max-width: 0vw;
			overflow: hidden;
			white-space: nowrap;
			transition: 300ms;
		}

		&.mouseIn .other-buttons {
			max-width: 100vw;
		}
	}

	.svg-wrapper {
		order: 1;
		margin: auto;
		position: relative;
		display: flex;
		place-items: center;
		justify-content: center;
		flex-wrap: wrap;
		flex-direction: column-reverse;
		user-select: none;
		cursor: pointer;
		transition: transform 300ms;

		&.active {
			transform: scale(1.1);
		}

		svg {
			transition: 250ms;
			width: 100%;
			aspect-ratio: 1;
		}
	}

	.other-buttons {
		order: 2;
	}
}
</style>
