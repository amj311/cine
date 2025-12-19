<script
	setup
	lang="ts"
>

defineProps<{
	people?: any[]; // libraryItem
	loading?: boolean;
}>();
</script>

<template>
	<Scroll>
		<div class="people-list">
			<div class="people-item" v-for="(person, index) in (loading ? Array(5).fill(null) : people)" :key="index" tabindex="0">
				<div
					class="image-wrapper"
					:style="{ backgroundImage: loading ? '' : `url(${person.photo})` }"
				>
					<Skeleton v-if="loading" shape="circle" class="w-full h-full" />
				</div>
				<div class="people-name">
					<template v-if="loading">
						<Skeleton width="100px" height="20px" />
					</template>
					<template v-else>
						{{ person.name }}
					</template>
				</div>
				<div class="people-role" :style="{ opacity: .7 }">
					<template v-if="loading">
						<Skeleton width="75px" height="20px" />
					</template>
					<template v-else>
						{{ person.role }}
					</template>
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
	
	.people-role {
		width: 6rem;
		text-align: center;
	}
}
</style>
