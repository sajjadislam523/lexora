/**
 * Phase 1 prototype content — a fixed practice session.
 * Real exercise generation from the language data arrives in Phase 6.
 */
import type { GapPart } from "@/components/lexora/gap-sentence";

export type Verdict = "correct" | "acceptable" | "incorrect";

export type ChoiceQuestion = {
  kind: "choice";
  id: string;
  mode: string;
  purpose: string;
  prompt: string;
  /** Sentence with a gap; the chosen option fills it. */
  parts?: GapPart[];
  /** Render options in the serif language voice (full sentences). */
  optionsAreLanguage?: boolean;
  options: { id: string; label: string; verdict: Verdict; explanation: string }[];
  focusSlug?: string;
};

export type TypedQuestion = {
  kind: "typed";
  id: string;
  mode: string;
  purpose: string;
  prompt: string;
  parts: GapPart[];
  accepted: { answer: string; verdict: Verdict; explanation: string }[];
  /** Shown for any other answer. */
  wrongExplanation: string;
  answer: string;
  focusSlug?: string;
};

export type MultiQuestion = {
  kind: "multi";
  id: string;
  mode: string;
  purpose: string;
  prompt: string;
  head: string;
  options: { label: string; correct: boolean }[];
  explanation: string;
  focusSlug?: string;
};

export type PracticeQuestion = ChoiceQuestion | TypedQuestion | MultiQuestion;

export const PRACTICE_SESSION: PracticeQuestion[] = [
  {
    kind: "choice",
    id: "complete",
    mode: "Complete the sentence",
    purpose: "Pick the verb that fits the sentence and its preposition.",
    prompt: "Which word completes the sentence most naturally?",
    parts: ["Governments should ", { gap: 0 }, " more resources to public transport."],
    options: [
      {
        id: "allocate",
        label: "allocate",
        verdict: "correct",
        explanation:
          "“Allocate resources to” is the precise, formal choice for how public money is divided.",
      },
      {
        id: "assign",
        label: "assign",
        verdict: "incorrect",
        explanation:
          "“Assign” is used for tasks, roles or people — “assign a teacher to a class” — not budgets.",
      },
      {
        id: "devote",
        label: "devote",
        verdict: "acceptable",
        explanation:
          "Also natural: “devote more resources to” works well. “Allocate” is slightly more precise.",
      },
      {
        id: "distribute",
        label: "distribute",
        verdict: "incorrect",
        explanation:
          "“Distribute” means sharing something out among people or places, not deciding a budget.",
      },
    ],
    focusSlug: "allocate",
  },
  {
    kind: "choice",
    id: "natural",
    mode: "Choose the natural expression",
    purpose: "Spot the version a fluent writer would use.",
    prompt: "Which sounds most natural?",
    optionsAreLanguage: true,
    options: [
      {
        id: "strongly",
        label: "I strongly agree with this argument because…",
        verdict: "correct",
        explanation: "“Strongly agree” is the natural collocation for firm agreement.",
      },
      {
        id: "very",
        label: "I very agree with this argument because…",
        verdict: "incorrect",
        explanation: "“Very” can't modify the verb “agree”. Use “strongly” or “completely”.",
      },
      {
        id: "am",
        label: "I am agree with this argument because…",
        verdict: "incorrect",
        explanation: "“Agree” is a verb, so it doesn't need “am”: “I agree…”.",
      },
    ],
  },
  {
    kind: "typed",
    id: "preposition",
    mode: "Preposition retrieval",
    purpose: "Recall the preposition without seeing options.",
    prompt: "Type the missing preposition.",
    parts: ["People often depend ", { gap: 0 }, " public transport."],
    accepted: [
      {
        answer: "on",
        verdict: "correct",
        explanation: "“Depend on” — the preposition is always on.",
      },
      {
        answer: "upon",
        verdict: "acceptable",
        explanation: "Correct but formal. “Depend on” is the everyday choice.",
      },
    ],
    wrongExplanation:
      "“Depend” always takes on (or the formal upon) — “depend on public transport”.",
    answer: "on",
    focusSlug: "depend-on",
  },
  {
    kind: "choice",
    id: "repetition",
    mode: "Replace repetition",
    purpose: "Avoid repeating the same words in consecutive sentences.",
    prompt: "Choose the best way to continue without repeating yourself.",
    parts: [
      "Governments should take action to reduce pollution. ",
      { gap: 0 },
      ", the problem will only get worse.",
    ],
    optionsAreLanguage: true,
    options: [
      {
        id: "they-fail",
        label: "If they fail to act soon",
        verdict: "correct",
        explanation:
          "“They” replaces “governments” and “act” replaces “take action” — no repetition.",
      },
      {
        id: "they-take",
        label: "If they do not take action soon",
        verdict: "acceptable",
        explanation: "Better, but “take action” still repeats the previous sentence.",
      },
      {
        id: "governments",
        label: "If governments do not take action soon",
        verdict: "incorrect",
        explanation: "This repeats both “governments” and “take action” from the sentence before.",
      },
      {
        id: "the-governments",
        label: "If the governments not act soon",
        verdict: "incorrect",
        explanation: "Grammatically wrong — it needs “do not act”.",
      },
    ],
  },
  {
    kind: "multi",
    id: "collocation",
    mode: "Collocation",
    purpose: "Recall which words naturally go together.",
    prompt: "Select every noun that naturally follows “significant”.",
    head: "significant",
    options: [
      { label: "impact", correct: true },
      { label: "homework", correct: false },
      { label: "increase", correct: true },
      { label: "role", correct: true },
      { label: "weather", correct: false },
      { label: "difference", correct: true },
    ],
    explanation: "Significant pairs with change and effect: impact, increase, role, difference.",
    focusSlug: "significant",
  },
];
