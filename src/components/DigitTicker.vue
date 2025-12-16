<script
	setup
	lang="ts"
>
import { computed, defineComponent, ref } from 'vue';

const { direction = 'up', ...props } = defineProps<{
	qty: number | string,
	pad?: number,
	direction?: 'up' | 'down'
}>()

const digits = computed(() => (Array.from(String(props.qty).padStart(props.pad || 1, '0')).map(d => parseInt(d))));

const DigitItem = computed(() => defineComponent({
	name: 'DigitItem',
	props: {
		digit: {
			type: Number,
			required: true,
		}
	},
	data: () => ({
		oldDigit: 0,
		animateFromOld: false,
		showQty: false,
	}),
	mounted() {
		setTimeout(() => {
			this.showQty = true;
			this.animateFromOld = true;
		}, 0)
	},
	computed: {
		digitsTrack() {
			return Array(20).fill(0).map((_, i) => direction === 'up' ? (i) % 10 : 9 - ((i) % 10));
		},
		currentTrackIdx() {
			return this.digitsTrack.indexOf(this.digit);
		},
		oldTrackIdx() {
			return this.oldDigit === null ? null : this.digitsTrack.indexOf(this.oldDigit);
		},
		movingToTrackIdx() {
			return this.oldTrackIdx === null ? null : this.digitsTrack.indexOf(this.digit, this.oldTrackIdx + 1);
		},
		useIdx() {
			return this.animateFromOld ? this.movingToTrackIdx : this.currentTrackIdx;
		}
	},
	watch: {
		digit(current, old) {
			this.oldDigit = old;
			this.animateFromOld = true;
			setTimeout(() => {
				this.animateFromOld = false;
			}, 500);
		}
	},

	template: /* html */ `
	<div class="digit-wrapper">
		<div
			class="digit-track"
			:class="{ animating: animateFromOld }"
			:style="{ top: !showQty ? '1em' : -useIdx + 'em' }"
		>
			<div
				class="digit"
				v-for="digit, i in digitsTrack"
				:key="i"
			>
				{{ digit }}
			</div>
		</div>
	</div>`,
}))
</script>

<template>
	<div class="digit-ticker">
		<div
			class="digit-item-wrapper"
			v-for="digit, i in digits"
			:key="10 ** (digits.length - i - 1)"
			:id="'dig_' + 10 ** (digits.length - i - 1)"
		>
			<DigitItem :digit="digit" />
		</div>
	</div>
</template>

<style lang="scss">
.digit-ticker {
	display: inline-flex;
	justify-content: center;
	align-items: center;
	font-family: sans-serif;
}

.digit-item-wrapper {
	display: inline-flex;
	align-items: center;

	&#dig_1000,
	&#dig_1000000 {
		padding-right: 2px;

		&::after {
			content: ',';
			right: 2px;
		}
	}
}

.digit-wrapper {
	position: relative;
	overflow: hidden;
	width: .6em;
	height: 1em;
	line-height: 1em;
	text-align: right;
}

.digit-track {
	position: absolute;
	top: 0;

	&.animating {
		transition: 500ms ease-out;
	}
}

.digit {
	font-size: 0.9em;
}
</style>
