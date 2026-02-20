<script
	setup
	lang="ts"
>
import { computed, ref } from 'vue';
import PersonModal from './PersonModal.vue';


const props = defineProps<{
	credits?: {
		cast: any[],
		guest_stars: any[],
		crew: any[],
	}
	loading?: boolean;
}>();

const personModal = ref<InstanceType<typeof PersonModal>>();
function openPersonModal(person) {
	personModal.value?.open(person.personId);
}

const people = computed(() => {
	return props.loading ? Array(5).fill(null) : [
		...(props.credits?.cast || []),
		...(props.credits?.guest_stars || []),
		...(props.credits?.crew || []),
	]
})

</script>

<template>
	<Scroll>
		<div class="people-list">
			<div class="people-item" v-for="(person, index) in people" :key="index" tabindex="0" @click="openPersonModal(person)">
				<div
					class="image-wrapper"
					:style="{ backgroundImage: loading ? '' : `url(${person.photo})` }"
				>
					<Skeleton v-if="loading" shape="circle" class="w-full h-full" />
					<div v-else-if="!person.photo" class="w-full h-full flex-center-all border-circle bg-soft text-2xl"><i class="material-symbols-outlined">person</i></div>
				</div>
				<div class="people-name">
					<template v-if="loading">
						<Skeleton width="100px" height="20px" />
					</template>
					<template v-else>
						{{ person.name }}
					</template>
				</div>
				<div class="people-role text-ellipsis" :style="{ opacity: .7 }">
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

	<PersonModal ref="personModal" />
</template>

<style
	lang="scss"
	scoped
>
.people-list {
	display: flex;
	margin-top: 10px;
	width: 100%;
	white-space: nowrap;
}

.people-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	cursor: pointer;

	padding: .75em;
	border-radius: .5rem;


	&:hover, &[tv-focus] {
		background: rgba(0, 0, 0, 0.3);
	}

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
		width: 7rem;
		text-align: center;
	}
}
</style>
