<script
	setup
	lang="ts"
>
import { computed } from 'vue';

const props = defineProps<{
	rating: number,
	votes?: number,
}>()

const roundedRating = computed(() => {
	return Math.round(props.rating);
});

const NUM_STARS = 5;
</script>

<template>
	<div class="star-rating">
		<div v-for="i in NUM_STARS" class="star" :class="{ filled: i <= roundedRating }" :key="i">
			{{ i <= roundedRating ? '★' : '☆' }}
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
}
</style>
