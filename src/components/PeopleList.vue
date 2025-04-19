<script
	setup
	lang="ts"
>
defineProps<{
	people: any[]; // libraryItem
}>();
</script>

<template>
	<div class="hide-scrollbar">
		<div class="people-list">
			<div class="people-item" v-for="(person, index) in people" :key="index">
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
	</div>
</template>

<style
	lang="scss"
	scoped
>
.people-list {
	display: flex;
	gap: 20px;
	padding: 10px;
	width: 100%;
	overflow-x: auto;
	white-space: nowrap;
}

.people-item {
	display: flex;
	flex-direction: column;
	align-items: center;

	.image-wrapper {
		width: 100px;
		height: 100px;
		background-color: var(--color-background-mute);
		background-size: cover;
		background-position: center;
		border-radius: 50%;
		margin-bottom: 5px;
	}
}
</style>
