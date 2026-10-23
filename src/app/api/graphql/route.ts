import { createYoga } from "graphql-yoga";
import { createContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";

const { handleRequest } = createYoga({
  schema,
  context: ({ request }) => createContext(request),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

export { handleRequest as GET, handleRequest as POST };
