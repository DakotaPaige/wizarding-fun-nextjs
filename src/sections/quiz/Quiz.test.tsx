import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ART } from "@/data/art-manifest";
import type { QuizMode, TurnRecord } from "@/quiz/types";
import type { FetchTurn, FetchVerdict, TurnRequest, TurnResponse, VerdictResponse } from "./quiz.graphql";
import { Quiz } from "./Quiz";
import { Result } from "./Result";

const selectHouse = vi.fn();
vi.mock("@/components/house-selection", () => ({
  useHouseSelection: () => ({ house: "GRYFFINDOR", selectHouse }),
}));

beforeEach(() => selectHouse.mockReset());

const AWAKE = "The Hat is awake · AI quizmaster";
const RESTING = "The Hat is resting · classic mode";

function turnResponse(request: TurnRequest, mode: QuizMode): TurnResponse {
  return {
    mode,
    hatLine: "Ah, a fresh head beneath my brim.",
    question: {
      id: `q${request.state.turns.length}`,
      topic: "patronus",
      difficulty: request.dared ? "hard" : "normal",
      prompt: "Whose Patronus is an otter?",
      artSlot: null,
      correctOptionId: "hermione",
      options: [
        { id: "luna", label: "Luna Lovegood" },
        { id: "ron", label: "Ron Weasley" },
        { id: "hermione", label: "Hermione Granger" },
        { id: "cho", label: "Cho Chang" },
      ],
    },
  };
}

const VERDICT: VerdictResponse = {
  house: "HUFFLEPUFF",
  verdict: "Loyalty to the long game is a quiet gift.",
  mode: "classic",
  scores: { GRYFFINDOR: 0.1, SLYTHERIN: 0, RAVENCLAW: 0.2, HUFFLEPUFF: 0.9 },
};

function renderQuiz({ mode = "classic" as QuizMode, fetchTurn, fetchVerdict }: {
  mode?: QuizMode;
  fetchTurn?: FetchTurn;
  fetchVerdict?: FetchVerdict;
} = {}) {
  const turn = vi.fn<FetchTurn>(fetchTurn ?? (async (request) => turnResponse(request, mode)));
  const verdict = vi.fn<FetchVerdict>(fetchVerdict ?? (async () => VERDICT));
  render(<Quiz fetchTurn={turn} fetchVerdict={verdict} />);
  return { fetchTurn: turn, fetchVerdict: verdict, user: userEvent.setup() };
}

async function begin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Put on the Hat" }));
}

describe("Quiz", () => {
  it("keeps the section landmark and heading the page shell relies on", () => {
    renderQuiz();
    const section = screen.getByRole("region", { name: "Let the Hat test you" });
    expect(section).toHaveAttribute("id", "sorting-ceremony");
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("Let the Hat test you");
  });

  it.each([
    ["ai", AWAKE],
    ["classic", RESTING],
  ] as const)("shows the exact badge copy once the server reports %s mode", async (mode, copy) => {
    const { user } = renderQuiz({ mode });
    expect(screen.getByText(AWAKE)).toBeInTheDocument();
    await begin(user);
    await user.click(screen.getByRole("button", { name: /Play it safe/ }));
    await screen.findByRole("heading", { name: "Whose Patronus is an otter?" });
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.queryByText(mode === "ai" ? RESTING : AWAKE)).not.toBeInTheDocument();
  });

  it("is a voice only without Hat art: no image, but the quote and its attribution", () => {
    expect(ART["quiz.hat"]).toBeUndefined();
    renderQuiz();
    const hat = screen.getByRole("figure", { name: "— The Sorting Hat" });
    expect(within(hat).queryByRole("img")).not.toBeInTheDocument();
    expect(within(hat).getByText("— The Sorting Hat")).toBeInTheDocument();
    expect(within(hat).getByText("Well then. Will you play it safe, or show me a little nerve?")).toBeInTheDocument();
  });

  it("types the Hat line over an aria-hidden copy while the full line stays readable", async () => {
    const { user } = renderQuiz();
    await begin(user);
    await user.click(screen.getByRole("button", { name: /Dare/ }));
    await screen.findByRole("heading", { name: "Whose Patronus is an otter?" });
    const hat = screen.getByRole("figure", { name: "— The Sorting Hat" });
    const lines = within(hat).getAllByText(/Ah, a fresh head beneath my brim\./);
    expect(lines.some((el) => el.closest("[aria-hidden='true']") === null)).toBe(true);
  });

  it("labels the correct and the chosen option with text and announces the feedback politely", async () => {
    const { user } = renderQuiz();
    await begin(user);
    await user.click(screen.getByRole("button", { name: /Dare/ }));
    expect(await screen.findByText("Patronus question · Daring · 2 pts")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ron Weasley" }));
    expect(screen.getByRole("button", { name: /Hermione Granger.*Correct/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Ron Weasley.*Your answer/ })).toBeDisabled();
    const feedback = screen.getByText("Not quite. The answer was Hermione Granger.");
    expect(feedback.closest("[aria-live='polite']")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Next question/ })).toHaveFocus();
  });

  it("shows the exact error copy with a Retry that keeps the game", async () => {
    let fail = true;
    const { user, fetchTurn } = renderQuiz({
      fetchTurn: async (request) => {
        if (fail) {
          fail = false;
          throw new Error("offline");
        }
        return turnResponse(request, "classic");
      },
    });
    await begin(user);
    await user.click(screen.getByRole("button", { name: /Play it safe/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The Hat lost its train of thought — try again");
    // Falling back to classic is silent; an error is the only thing that shows one.
    expect(screen.getByText(AWAKE)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { name: "Whose Patronus is an otter?" });
    expect(fetchTurn.mock.calls[1]).toEqual(fetchTurn.mock.calls[0]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("plays a round to the result and Play again returns to the intro", async () => {
    const { user, fetchVerdict } = renderQuiz();
    await begin(user);
    for (let i = 0; i < 10; i++) {
      await user.click(await screen.findByRole("button", { name: i % 2 ? /Dare/ : /Play it safe/ }));
      await user.click(await screen.findByRole("button", { name: "Hermione Granger" }));
      await user.click(screen.getByRole("button", { name: i === 9 ? /verdict/ : /Next question/ }));
    }
    expect(await screen.findByRole("heading", { name: "Hufflepuff!" })).toHaveFocus();
    expect(fetchVerdict).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Final score: 15")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("button", { name: "Put on the Hat" })).toBeInTheDocument();
  });
});

describe("Result", () => {
  const turns: TurnRecord[] = Array.from({ length: 10 }, (_, i) => ({
    topic: i % 2 ? "wand" : "spell",
    difficulty: i < 3 ? "hard" : "normal",
    dared: i < 3,
    correct: i !== 9,
    msToAnswer: 2000,
  }));
  const result = { house: "RAVENCLAW" as const, scores: VERDICT.scores, verdict: "A mind that weighs a risk." };

  it("names the house, quotes the verdict and ties the four stats to houses", () => {
    render(<Result result={result} turns={turns} onPlayAgain={() => {}} />);
    expect(screen.getByRole("heading", { name: "Ravenclaw!" })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "— The Sorting Hat" })).toHaveTextContent("A mind that weighs a risk.");
    const stats = within(screen.getByRole("list", { name: "How you played" })).getAllByRole("listitem");
    expect(stats.map((row) => row.textContent)).toEqual([
      "Dares taken · 3 of 10Gryffindor",
      "Hard questions right · 3 of 3Ravenclaw ★(your house)",
      "Longest steady streak · 9Hufflepuff",
      "Points from calculated risks · 33%Slytherin",
    ]);
    expect(screen.getByText("Final score: 12")).toBeInTheDocument();
  });

  it("'Meet your housemates' selects the house and scrolls to the Great Hall", async () => {
    const onPlayAgain = vi.fn();
    render(<Result result={result} turns={turns} onPlayAgain={onPlayAgain} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Meet your housemates" }));
    expect(selectHouse).toHaveBeenCalledWith("RAVENCLAW", { scroll: true });
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
