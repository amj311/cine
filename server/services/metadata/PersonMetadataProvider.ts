import { CommonDetailsMetadata, CommonSearchKey, CommonSimpleMetadata, MetadataDefinition } from "./MetadataTypes";
import { IMetadataProvider } from "./IMetadataProvider";
import { LibraryService } from "../LibraryService";
import { TmdbApi } from "./TmdbApi";
import { ConfirmedPath } from "../DirectoryService";

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

type PersonSearchKey = { personId: string };

export type PersonMetadata = MetadataDefinition<
	'person',
	string,
	PersonSearchKey,
	PersonDetails
>;


/**
 * Responsible for reading metadata about films from a provider API
 */
export class PersonMetadataProvider extends IMetadataProvider<PersonMetadata> {
	protected createSearchKeyFromSource(personId: string) {
		return { personId };
	}

	protected async fetchMetadata({ personId }: PersonSearchKey): Promise<PersonDetails> {
		const api = new TmdbApi();
		const details = await api.getDetailsById('person/' + personId, ['combined_credits', 'images']);

		return {
			personId: details.id,
			name: details.name,
			biography: details.biography,
			birthday: details.birthday,
			deathday: details.deathday,
			known_for_department: details.known_for_department,
			place_of_birth: details.place_of_birth,
			profile_photo: api.getImageUrl(details.profile_path, 'profile', 'large'),

			credits: [
				...(details.combined_credits.cast || []).filter((c: any) => !c.adult).map((castRole: any) => ({
					department: 'Actor',
					role: castRole.character,
					media_type: castRole.media_type,
					title: castRole.title || castRole.name,
					overview: castRole.overview,
					poster: api.getImageUrl(castRole.poster_path, 'poster', 'small'),
					date: castRole.release_date || castRole.first_air_date,
					episode_count: castRole.episode_count,
				})),
				...(details.combined_credits.crew || []).filter((c: any) => !c.adult).map((castRole: any) => ({
					department: castRole.department,
					role: castRole.job,
					media_type: castRole.media_type,
					title: castRole.title || castRole.name,
					overview: castRole.overview,
					poster: api.getImageUrl(castRole.poster_path, 'poster', 'small'),
					date: castRole.release_date || castRole.first_air_date,
					episode_count: castRole.episode_count,
				}))
			],

			images: details.images.profiles.map((i: any) => api.getImageUrl(i.file_path, 'profile', 'large'))
		}
	}
}
