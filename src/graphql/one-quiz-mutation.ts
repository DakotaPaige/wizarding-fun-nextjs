import { GraphQLError, Kind, type SelectionSetNode, type ValidationContext, type ValidationRule } from "graphql";
import type { Plugin } from "graphql-yoga";

/** Root fields that may call the AI; each one can make one `messages.create`. */
const QUIZ_FIELDS = new Set(["quizTurn", "quizVerdict"]);

function countQuizFields(set: SelectionSetNode, context: ValidationContext, seen: Set<string>): number {
  let count = 0;
  for (const selection of set.selections) {
    if (selection.kind === Kind.FIELD) {
      if (QUIZ_FIELDS.has(selection.name.value)) count += 1;
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      count += countQuizFields(selection.selectionSet, context, seen);
    } else if (!seen.has(selection.name.value)) {
      seen.add(selection.name.value);
      const fragment = context.getFragment(selection.name.value);
      if (fragment) count += countQuizFields(fragment.selectionSet, context, seen);
    }
  }
  return count;
}

/**
 * Rejects a mutation that selects more than one quiz root field (aliases and fragments
 * included), so one GraphQL request can make at most one AI call.
 */
export const OneQuizMutationRule: ValidationRule = (context) => ({
  OperationDefinition(node) {
    if (node.operation !== "mutation") return;
    if (countQuizFields(node.selectionSet, context, new Set()) > 1) {
      context.reportError(
        new GraphQLError("Only one quizTurn or quizVerdict may be selected per request", {
          nodes: [node],
          extensions: { code: "BAD_INPUT" },
        }),
      );
    }
  },
});

/** Yoga plugin that adds `OneQuizMutationRule` to validation. */
export const oneQuizMutationPlugin: Plugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(OneQuizMutationRule);
  },
};
