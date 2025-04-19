<script
	setup
	lang="ts"
>

defineProps<{
	rating: number,
	votes?: number,
}>()

const NUM_STARS = 5;
</script>

<template>
	<div class="star-rating">
		<div v-for="i in NUM_STARS" class="star" :class="{ filled: i <= rating }" :key="i">
			{{ i <= rating ? '★' : '☆' }}
		</div>
		<small v-if="votes" class="votes">
			&nbsp;
			({{ votes.toLocaleString() }})
		</small>
	</div>
</template>

<style lang="scss">
.star-rating {
	display: flex;
	align-items: center;
}
.star {
	font-size: 1.25rem;

	&.filled {
		color: #FFD700; /* Gold color */
	}
	&.empty {
		color: #ccc; /* Gray color */
	}
}
</style>
