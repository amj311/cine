<script
	setup
	lang="ts"
>
import { useApiStore } from '@/stores/api.store';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

const defaultTotal = 30;

const { mediaEl, inPlayer = false } = defineProps<{
	mediaEl?: HTMLMediaElement;
	inPlayer?: boolean;
}>();

const loading = ref(true);

const timerState = ref({
	running: false,
	timeLeft: defaultTotal,
	totalTime: defaultTotal,
});

async function fetchTimerState() {
	const { data } = await useApiStore().api.get('/timer');
	timerState.value = data.data;

	if (timerState.value.timeLeft <= 0) {
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
const hasRun = computed(() => timerState.value.totalTime !== 1);

async function restart() {
	const { data } = await useApiStore().api.put('/timer/start', { timeLeft: defaultTotal });
	timerState.value = data.data;
	mediaEl?.play();
}
async function reset() {
	const { data } = await useApiStore().api.put('/timer/reset');
	timerState.value = data.data;
}

async function start(timeLeft?: number) {
	const { data } = await useApiStore().api.put('/timer/start', { timeLeft });
	timerState.value = data.data;
	mediaEl?.play();
}

async function addTime() {
	const { data } = await useApiStore().api.put('/timer/add', { time: 5 });
	timerState.value = data.data;
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
			start();
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
});

onUnmounted(() => {
	clearInterval(interval);
});

const buttonActive = ref(false);

async function handleClick() {
	if (inPlayer && !mouseIn.value) {
		return;
	}
	
	buttonActive.value = true;
	setTimeout(() => {
		buttonActive.value = false;
	}, 150);

	if (timerState.value.running) {
		await addTime();
	}
	else if (!hasRun.value) {
		await restart();
	}
	else if (timerState.value.timeLeft) {
		await start();
	}
	else {
		await restart();
	}
}

const timerColor = computed(() => (!hasRun.value || timerState.value.timeLeft) ? '#ffffff' : 'red');
const remainingRatio = computed(() => {
	if (loading.value) {
		return 0;
	}
	if (!timerState.value.timeLeft) {
		// Show a full red circle when. no tim eis left
		return 1;
	}
	return (timerState.value.timeLeft / timerState.value.totalTime)
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
					<template v-else-if="timerState.running">+ Add Time</template>
					<template v-else-if="hasRun && timerState.timeLeft">Continue</template>
					<template v-else-if="hasRun">Restart</template>
					<template v-else>Start</template>
				</text>
			</svg>
			<!-- Small svg icons for player -->
			<!-- Can't display these icons in the svg -->
			<div class="absolute top-50 left-50" style="translate: -50% -50%; color: #fff">
				<div v-if="inPlayer && mouseIn">
					<template v-if="loading"></template>
					<template v-else-if="timerState.running"><i class="pi pi-plus" /></template>
					<template v-else-if="hasRun && timerState.timeLeft"><i class="pi pi-play" /></template>
					<template v-else-if="hasRun"><i class="pi pi-replay" /></template>
					<template v-else><i class="pi pi-play" /></template>
				</div>
				<template v-if="loading"><i class="pi pi-spin pi-spinner"></i></template>
			</div>
		</Button>

		<div class="other-buttons flex align-items-center gap-1">
			<Button v-if="inPlayer" @click="showPhoneQR = true" icon="pi pi-mobile" severity="secondary" size="large" />
			<Button v-if="hasRun && timerState.running" @click="pauseTimerOnly" icon="pi pi-pause" severity="secondary" size="large" label="Pause Timer" />
			<Button v-if="hasRun && !timerState.running && timerState.timeLeft" @click="reset" icon="pi pi-stop" severity="secondary" size="large" label="Cancel" />
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
