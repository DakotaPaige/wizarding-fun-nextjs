/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Difficulty =
  | 'HARD'
  | 'NORMAL';

export type GameStateInput = {
  mode: QuizMode;
  seed: number;
  turns: Array<TurnRecordInput>;
};

export type HouseName =
  | 'GRYFFINDOR'
  | 'HUFFLEPUFF'
  | 'RAVENCLAW'
  | 'SLYTHERIN';

export type QuizMode =
  | 'AI'
  | 'CLASSIC';

export type QuizTurnInput = {
  dared: boolean;
  state: GameStateInput;
};

export type QuizVerdictInput = {
  state: GameStateInput;
};

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

export type Topic =
  | 'ACTOR'
  | 'HOUSE'
  | 'PATRONUS'
  | 'PORTRAIT'
  | 'SPELL'
  | 'WAND';

export type TurnRecordInput = {
  correct: boolean;
  dared: boolean;
  difficulty: Difficulty;
  msToAnswer: number;
  topic: Topic;
};

export type PageDataQueryVariables = Exact<{ [key: string]: never; }>;


export type PageDataQuery = { houses: Array<{ name: HouseName, displayName: string, traits: Array<string>, members: Array<{ id: string, name: string, initials: string, house: HouseName | null, alternateNames: Array<string>, ancestry: string | null, patronus: string | null, actor: string | null, dateOfBirth: string | null, alive: boolean, eyeColour: string | null, hairColour: string | null, wand: { wood: string | null, core: string | null, lengthInches: number | null } | null, portrait: { src: string } | null }> }>, spells: Array<{ id: string, name: string, description: string, colour: string, effect: SpellEffectKey }> };

export type QuizTurnMutationVariables = Exact<{
  input: QuizTurnInput;
}>;


export type QuizTurnMutation = { quizTurn: { hatLine: string, mode: QuizMode, question: { id: string, topic: Topic, difficulty: Difficulty, prompt: string, artSlot: string | null, correctOptionId: string, options: Array<{ id: string, label: string }> } } };

export type QuizVerdictMutationVariables = Exact<{
  input: QuizVerdictInput;
}>;


export type QuizVerdictMutation = { quizVerdict: { house: HouseName, verdict: string, mode: QuizMode, scores: { gryffindor: number, slytherin: number, ravenclaw: number, hufflepuff: number } } };


export const PageDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PageData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"houses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"traits"}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"initials"}},{"kind":"Field","name":{"kind":"Name","value":"house"}},{"kind":"Field","name":{"kind":"Name","value":"alternateNames"}},{"kind":"Field","name":{"kind":"Name","value":"ancestry"}},{"kind":"Field","name":{"kind":"Name","value":"patronus"}},{"kind":"Field","name":{"kind":"Name","value":"actor"}},{"kind":"Field","name":{"kind":"Name","value":"dateOfBirth"}},{"kind":"Field","name":{"kind":"Name","value":"alive"}},{"kind":"Field","name":{"kind":"Name","value":"eyeColour"}},{"kind":"Field","name":{"kind":"Name","value":"hairColour"}},{"kind":"Field","name":{"kind":"Name","value":"wand"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wood"}},{"kind":"Field","name":{"kind":"Name","value":"core"}},{"kind":"Field","name":{"kind":"Name","value":"lengthInches"}}]}},{"kind":"Field","name":{"kind":"Name","value":"portrait"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"src"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"spells"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"colour"}},{"kind":"Field","name":{"kind":"Name","value":"effect"}}]}}]}}]} as unknown as DocumentNode<PageDataQuery, PageDataQueryVariables>;
export const QuizTurnDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"QuizTurn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"QuizTurnInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quizTurn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hatLine"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"question"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"artSlot"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuizTurnMutation, QuizTurnMutationVariables>;
export const QuizVerdictDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"QuizVerdict"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"QuizVerdictInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quizVerdict"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"house"}},{"kind":"Field","name":{"kind":"Name","value":"verdict"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"scores"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gryffindor"}},{"kind":"Field","name":{"kind":"Name","value":"slytherin"}},{"kind":"Field","name":{"kind":"Name","value":"ravenclaw"}},{"kind":"Field","name":{"kind":"Name","value":"hufflepuff"}}]}}]}}]}}]} as unknown as DocumentNode<QuizVerdictMutation, QuizVerdictMutationVariables>;