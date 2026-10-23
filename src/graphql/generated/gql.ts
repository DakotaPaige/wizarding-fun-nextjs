/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query PageData {\n    houses {\n      name\n      displayName\n      traits\n      members {\n        id\n        name\n        initials\n        house\n        alternateNames\n        ancestry\n        patronus\n        actor\n        dateOfBirth\n        alive\n        eyeColour\n        hairColour\n        wand {\n          wood\n          core\n          lengthInches\n        }\n        portrait {\n          src\n        }\n      }\n    }\n    spells {\n      id\n      name\n      description\n      colour\n      effect\n    }\n  }\n": typeof types.PageDataDocument,
    "\n  mutation QuizTurn($input: QuizTurnInput!) {\n    quizTurn(input: $input) {\n      hatLine\n      mode\n      question {\n        id\n        topic\n        difficulty\n        prompt\n        artSlot\n        correctOptionId\n        options {\n          id\n          label\n        }\n      }\n    }\n  }\n": typeof types.QuizTurnDocument,
    "\n  mutation QuizVerdict($input: QuizVerdictInput!) {\n    quizVerdict(input: $input) {\n      house\n      verdict\n      mode\n      scores {\n        gryffindor\n        slytherin\n        ravenclaw\n        hufflepuff\n      }\n    }\n  }\n": typeof types.QuizVerdictDocument,
};
const documents: Documents = {
    "\n  query PageData {\n    houses {\n      name\n      displayName\n      traits\n      members {\n        id\n        name\n        initials\n        house\n        alternateNames\n        ancestry\n        patronus\n        actor\n        dateOfBirth\n        alive\n        eyeColour\n        hairColour\n        wand {\n          wood\n          core\n          lengthInches\n        }\n        portrait {\n          src\n        }\n      }\n    }\n    spells {\n      id\n      name\n      description\n      colour\n      effect\n    }\n  }\n": types.PageDataDocument,
    "\n  mutation QuizTurn($input: QuizTurnInput!) {\n    quizTurn(input: $input) {\n      hatLine\n      mode\n      question {\n        id\n        topic\n        difficulty\n        prompt\n        artSlot\n        correctOptionId\n        options {\n          id\n          label\n        }\n      }\n    }\n  }\n": types.QuizTurnDocument,
    "\n  mutation QuizVerdict($input: QuizVerdictInput!) {\n    quizVerdict(input: $input) {\n      house\n      verdict\n      mode\n      scores {\n        gryffindor\n        slytherin\n        ravenclaw\n        hufflepuff\n      }\n    }\n  }\n": types.QuizVerdictDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PageData {\n    houses {\n      name\n      displayName\n      traits\n      members {\n        id\n        name\n        initials\n        house\n        alternateNames\n        ancestry\n        patronus\n        actor\n        dateOfBirth\n        alive\n        eyeColour\n        hairColour\n        wand {\n          wood\n          core\n          lengthInches\n        }\n        portrait {\n          src\n        }\n      }\n    }\n    spells {\n      id\n      name\n      description\n      colour\n      effect\n    }\n  }\n"): (typeof documents)["\n  query PageData {\n    houses {\n      name\n      displayName\n      traits\n      members {\n        id\n        name\n        initials\n        house\n        alternateNames\n        ancestry\n        patronus\n        actor\n        dateOfBirth\n        alive\n        eyeColour\n        hairColour\n        wand {\n          wood\n          core\n          lengthInches\n        }\n        portrait {\n          src\n        }\n      }\n    }\n    spells {\n      id\n      name\n      description\n      colour\n      effect\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation QuizTurn($input: QuizTurnInput!) {\n    quizTurn(input: $input) {\n      hatLine\n      mode\n      question {\n        id\n        topic\n        difficulty\n        prompt\n        artSlot\n        correctOptionId\n        options {\n          id\n          label\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation QuizTurn($input: QuizTurnInput!) {\n    quizTurn(input: $input) {\n      hatLine\n      mode\n      question {\n        id\n        topic\n        difficulty\n        prompt\n        artSlot\n        correctOptionId\n        options {\n          id\n          label\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation QuizVerdict($input: QuizVerdictInput!) {\n    quizVerdict(input: $input) {\n      house\n      verdict\n      mode\n      scores {\n        gryffindor\n        slytherin\n        ravenclaw\n        hufflepuff\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation QuizVerdict($input: QuizVerdictInput!) {\n    quizVerdict(input: $input) {\n      house\n      verdict\n      mode\n      scores {\n        gryffindor\n        slytherin\n        ravenclaw\n        hufflepuff\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;