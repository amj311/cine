const MetadataTypes = ['movie', 'series', 'person'] as const;
export type MetadataType = typeof MetadataTypes[number];

const MetadataSubTypes = ['episode'];

export type MetadataSubType = typeof MetadataSubTypes[number];

export type CommonSearchKey = {
	name: string,
	year: string,
	details?: boolean,
}

export type CommonSimpleMetadata = {
	poster_thumb: string,
	name: string,
	year: string,
}

export type CommonDetailsMetadata = {
	poster_full: string,
	background: string,
	runtime: string,
	genres: string[],
	credits: Array<{
		name: string,
		role: string,
		photo: string,
	}>,
}

export type MetadataDefinition<
	Type extends MetadataType = MetadataType,
	CacheKeySource = any,
	SearchKey extends Object = {},
	Simple extends Object = {},
	Details extends Object = {},
	SubTypes extends Record<Partial<MetadataSubType>, SubMetadataDefinition> = {}
> = {
	Type: Type,
	CacheKeySource: CacheKeySource,
	SearchKey: SearchKey & { details?: boolean },
	Simple: Simple,
	Details: Details,
	SubTypes: SubTypes,
}

type SubMetadataDefinition<
	Subtype extends MetadataSubType = MetadataSubType,
	Data extends Object = {},
> = {
	Subtype: Subtype,
	Data: Data,
}

export type EitherMetadata<Type extends MetadataType = MetadataType> =
	MetadataDefinition<Type>['Simple']
	| MetadataDefinition<Type>['Details']
	| MetadataDefinition<Type>['SubTypes'][keyof MetadataDefinition<Type>['SubTypes']]['Data']
	;

export type SearchKeyWithDetails<T extends MetadataDefinition> = T['SearchKey'] & {
	details?: boolean,
}