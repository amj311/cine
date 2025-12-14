<script setup lang="ts">
defineProps<{
	width?: number;
}>();
</script>

<template>
	<svg viewBox="0 0 380 30" :width="width || 200" style="aspect-ratio: 6">
		<!-- Draw the popcorn emoji image from above into this svg -->
		<image id="popcorn" href="/public/public/Popcorn-Emoji-512.png" x="0" y="-13" width="60" height="60" />
		<path id="curve" fill="transparent" d="M 75,45 C 175,35, 260,35 360,45" />
		<text fill="white" font-size="68" font-weight="bold">
			<textPath xlink:href="#curve">
				OlivePlex
			</textPath>
		</text>
	</svg>
</template>