<script
	setup
	lang="ts"
>
import { computed, ref } from 'vue';
import NavModal from './utils/NavModal.vue';
import { useApiStore } from '@/stores/api.store';
import { useToast } from 'primevue/usetoast';
import Scroll from './Scroll.vue';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import type AccordionContent from 'primevue/accordioncontent';
import MediaCard from './MediaCard.vue';

const toast = useToast();
const props = defineProps<{
}>();

const modal = ref<InstanceType<typeof NavModal>>();

export type PersonDetails = {
	personId: string,
	name: string,
	biography: string,
	birthday: string,
	deathday: string | null,
	known_for_department: string,
	place_of_birth: string,
	profile_photo: string,
	images: Array<string>,
	credits: Array<{
		// role details
		department: string, // cast, sound, production, writing, etc
		role: string // character name, director, writer, etc
		episode_count?: number, // in how many episodes

		// media details
		media_type: string,
		title: string,
		overview: string,
		poster: string,
		date: string,
	}>,
}

const loadingPerson = ref(false);
let personId: number = 0;
const personDetails = ref<null | PersonDetails>(null);
const loadError = ref('');

defineExpose({
	open: (id) => {
		personId = id;
		personDetails.value = null;
		// start loading person
		fetchPersonDetails().catch(console.error);
		modal.value?.open();
	},
})

async function fetchPersonDetails() {
	if (!personId) return;

	try {
		loadError.value = '';
		loadingPerson.value = true;
		const { data } = await useApiStore().api.get('/metadata/person/' + personId);
		personDetails.value = data.data;
	}
	catch (e) {
		loadError.value = 'Could not load person details';
	}
	finally {
		loadingPerson.value = false;
	}
}

const creditsByTitle = computed(() => {
	if (!personDetails.value) return;
	const groups = personDetails.value.credits.reduce((groups, c) => {
		let titleLabel = c.title;
		if (c.media_type !== 'tv') {
			titleLabel += ` (${c.date?.slice(0,4) || 'No date'})`;
		}
		const group = groups[titleLabel] || {
			media_type: c.media_type,
			name: titleLabel,
			title: c.title,
			overview: c.overview,
			poster: c.poster,
			date: c.date,

			credits: []
		};
		group.credits.push(c);
		groups[titleLabel] = group;
		return groups;
	}, {} as Record<string, any>);

	return Array.from(Object.values(groups)).sort((a, b) => b.date < a.date ? -1 : 1);
})

</script>

<template>
	<NavModal
		ref="modal"
		width="40rem"
	>
		<template v-if="loadingPerson">
			Loading...
		</template>
		<template v-else-if="loadError">
			{{ loadError }}
		</template>
		<template v-else-if="personDetails">
			<div>
				<div class="card-wrapper"
					style="width: min(25vw, 10rem); float: right; margin: 0 0 2rem 2rem;"
				>

				<MediaCard
					:imageUrl="personDetails.profile_photo"
					aspectRatio="square"
				/>
				</div>

				<h2>{{ personDetails.name }}</h2>
				<div v-if="personDetails.birthday">{{ personDetails.birthday?.slice(0,4) || 'Unknown' }} - {{ personDetails.deathday?.slice(0,4) || 'Present' }}</div>
				<br />
				<div v-if="personDetails.known_for_department">Known for: {{ personDetails.known_for_department }}</div>
				<div v-if="personDetails.place_of_birth">Birthplace: {{ personDetails.place_of_birth }}</div>
				
				<br/>
				<h3>Bio</h3>
				<div>{{ personDetails.biography }}</div>

				<br/>
				<h3>Images</h3>
				<div style="max-width: 89vw;">
					<Scroll>
						<div class="flex gap-3 mt-2">
							<img v-for="image of personDetails.images" height="200rem" :src="image" class="border-round" tabindex="0" />
						</div>
					</Scroll>
				</div>

				<br/>
				<h3>Credits</h3>
				<div class="mt-2">
					<Accordion>
						<AccordionPanel v-for="title of creditsByTitle" :value="title.name">
							<AccordionHeader>{{ title.name }}
							</AccordionHeader>
							<AccordionContent>
								<div class="flex flex-column gap-3">
									<div class="flex gap-3">
										<div style="width: 5rem">
											<MediaCard
												:imageUrl="title.poster"
											>
												<template #fallbackIcon>
													{{ title.media_type === 'movie' ? '🎞️' : '📺' }}
												</template>
											</MediaCard>
										</div>

										<div>
											<h3>{{ title.title }}</h3>
											<div>{{ title.media_type === 'tv' ? 'TV' : title.date }}</div>
											<br />
											<div v-for="credit of title.credits">
												{{ credit.role }}
												<template v-if="credit.episode_count"> - {{ credit.episode_count }} episode{{credit.episode_count > 1 ? 's' : ''}}</template>
											</div>
										</div>
									</div>

									{{ title.overview }}

								</div>
							</AccordionContent>
						</AccordionPanel>
					</Accordion>
				</div>
			</div>
		</template>
	</NavModal>
</template>

<style
	lang="scss"
	scoped
>
.grid-row {
	display: contents;

	&[disabled="true"] * {
		pointer-events: none;
		opacity: .5;
	}
}
</style>
