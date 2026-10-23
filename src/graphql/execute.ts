import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { execute } from "graphql";
import { createContext, type GraphQLContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";
import type { WizardingData } from "@/data/types";
import { createQuizServices, type QuizServices } from "@/quiz/services";

export interface ExecuteOptions {
  /** Supply data directly instead of loading it (used by tests). */
  data?: WizardingData;
  /** Quiz collaborators and client IP (used by tests); defaults to env-built services and no IP. */
  quiz?: QuizServices;
  ip?: string | null;
  /** When the request began (used by tests); defaults to now. */
  startedAt?: number;
}

/** Runs a query in-process against the schema (for Server Components). Throws on GraphQL errors. */
export async function executeQuery<TResult, TVars = Record<string, never>>(
  doc: TypedDocumentNode<TResult, TVars>,
  vars?: TVars,
  { data, quiz, ip = null, startedAt = Date.now() }: ExecuteOptions = {},
): Promise<TResult> {
  const contextValue: GraphQLContext = data
    ? { data, ip, startedAt, quiz: quiz ?? createQuizServices(data) }
    : await createContext();
  const result = await execute({
    schema,
    document: doc,
    variableValues: vars as Record<string, unknown> | undefined,
    contextValue,
  });
  if (result.errors?.length) {
    throw new AggregateError(result.errors, result.errors.map((e) => e.message).join("; "));
  }
  return result.data as TResult;
}
