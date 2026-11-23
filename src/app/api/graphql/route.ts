import { createGraphQLServer } from "@/graphql/yoga";

const { handleRequest } = createGraphQLServer();

// Next passes `{ params }` as the second argument, which yoga's server context type does not accept.
const handler = (request: Request) => handleRequest(request, {});

export { handler as GET, handler as POST };
