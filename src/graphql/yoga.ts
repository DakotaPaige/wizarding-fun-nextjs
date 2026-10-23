import { createYoga } from "graphql-yoga";
import { createContext, type GraphQLContext } from "@/graphql/context";
import { oneQuizMutationPlugin } from "@/graphql/one-quiz-mutation";
import { schema } from "@/graphql/schema";

export const GRAPHQL_ENDPOINT = "/api/graphql";

/** The HTTP GraphQL server. Tests pass their own context factory. */
export function createGraphQLServer(
  opts: { context?: (request: Request) => Promise<GraphQLContext>; graphiql?: boolean } = {},
) {
  const { context = createContext, graphiql = process.env.NODE_ENV !== "production" } = opts;
  return createYoga({
    schema,
    context: ({ request }) => context(request),
    graphqlEndpoint: GRAPHQL_ENDPOINT,
    // GraphiQL is a development tool; production serves the API only.
    graphiql,
    plugins: [oneQuizMutationPlugin],
    fetchAPI: { Response },
  });
}
