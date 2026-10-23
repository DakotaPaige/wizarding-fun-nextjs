import { createYoga } from "graphql-yoga";
import { createContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";

const { handleRequest } = createYoga({
  schema,
  context: ({ request }) => createContext(request),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

// Next passes `{ params }` as the second argument, which yoga's server context type does not accept.
const handler = (request: Request) => handleRequest(request, {});

export { handler as GET, handler as POST };
