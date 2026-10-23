/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type HouseName =
  | 'GRYFFINDOR'
  | 'HUFFLEPUFF'
  | 'RAVENCLAW'
  | 'SLYTHERIN';

export type SpellEffectKey =
  | 'ACCIO'
  | 'ALOHOMORA'
  | 'EXPELLIARMUS'
  | 'INCENDIO'
  | 'LEVIOSA'
  | 'LUMOS'
  | 'PATRONUS'
  | 'PROTEGO'
  | 'REPARO'
  | 'STUPEFY';

export type PageDataQueryVariables = Exact<{ [key: string]: never; }>;


export type PageDataQuery = { houses: Array<{ name: HouseName, displayName: string, traits: Array<string>, members: Array<{ id: string, name: string, initials: string, house: HouseName | null, alternateNames: Array<string>, ancestry: string | null, patronus: string | null, actor: string | null, dateOfBirth: string | null, alive: boolean, eyeColour: string | null, hairColour: string | null, wand: { wood: string | null, core: string | null, lengthInches: number | null } | null, portrait: { src: string } | null }> }>, spells: Array<{ id: string, name: string, description: string, colour: string, effect: SpellEffectKey }> };


export const PageDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PageData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"houses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"traits"}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"initials"}},{"kind":"Field","name":{"kind":"Name","value":"house"}},{"kind":"Field","name":{"kind":"Name","value":"alternateNames"}},{"kind":"Field","name":{"kind":"Name","value":"ancestry"}},{"kind":"Field","name":{"kind":"Name","value":"patronus"}},{"kind":"Field","name":{"kind":"Name","value":"actor"}},{"kind":"Field","name":{"kind":"Name","value":"dateOfBirth"}},{"kind":"Field","name":{"kind":"Name","value":"alive"}},{"kind":"Field","name":{"kind":"Name","value":"eyeColour"}},{"kind":"Field","name":{"kind":"Name","value":"hairColour"}},{"kind":"Field","name":{"kind":"Name","value":"wand"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wood"}},{"kind":"Field","name":{"kind":"Name","value":"core"}},{"kind":"Field","name":{"kind":"Name","value":"lengthInches"}}]}},{"kind":"Field","name":{"kind":"Name","value":"portrait"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"src"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"spells"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"colour"}},{"kind":"Field","name":{"kind":"Name","value":"effect"}}]}}]}}]} as unknown as DocumentNode<PageDataQuery, PageDataQueryVariables>;