import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";

export class GqlError extends Error {
  constructor(
    message: string,
    readonly causes: readonly unknown[] = [],
  ) {
    super(message);
    this.name = "GqlError";
  }
}

interface GqlResponse<TResult> {
  data?: TResult | null;
  errors?: readonly { message: string }[];
}

/** Browser-side typed GraphQL call to `/api/graphql`. Throws `GqlError` on network or GraphQL errors. */
export async function gqlFetch<TResult, TVars = Record<string, never>>(
  doc: TypedDocumentNode<TResult, TVars>,
  vars?: TVars,
): Promise<TResult> {
  let body: GqlResponse<TResult>;
  try {
    const response = await fetch("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: print(doc), variables: vars }),
    });
    body = (await response.json()) as GqlResponse<TResult>;
  } catch (error) {
    throw new GqlError("Network error talking to /api/graphql", [error]);
  }
  if (body.errors?.length) {
    throw new GqlError(body.errors.map((e) => e.message).join("; "), body.errors);
  }
  if (body.data == null) throw new GqlError("GraphQL response contained no data");
  return body.data;
}
