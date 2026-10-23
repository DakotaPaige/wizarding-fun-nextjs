import "@/graphql/types/character";
import "@/graphql/types/house";
import "@/graphql/types/quiz";
import "@/graphql/types/spell";
import { builder } from "@/graphql/builder";

export const schema = builder.toSchema();
