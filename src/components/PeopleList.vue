<script
	setup
	lang="ts"
>

defineProps<{
	people: any[]; // libraryItem
}>();
</script>

<template>
	<Scroll>
		<div class="people-list">
			<div class="people-item" v-for="(person, index) in people" :key="index" tabindex="0">
				<div
					class="image-wrapper"
					:style="{ backgroundImage: `url(${person.photo})` }"
				></div>
				<div class="people-name">
					{{ person.name }}
				</div>
				<div class="people-role" :style="{ opacity: .7 }">
					{{ person.role }}
				</div>
			</div>
		</div>
	</Scroll>
</template>

<style
	lang="scss"
	scoped
>
.people-list {
	display: flex;
	gap: 20px;
	margin-top: 10px;
	width: 100%;
	white-space: nowrap;
}

.people-item {
	display: flex;
	flex-direction: column;
	align-items: center;

	.image-wrapper {
		width: 80px;
		height: 80px;
		background-color: var(--color-background-mute);
		background-size: cover;
		background-position: center;
		border-radius: 50%;
		margin-bottom: 5px;
	}
}
</style>
