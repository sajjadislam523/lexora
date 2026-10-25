/**
 * Request normalisation (Phase 6B): the words around a learner's question that don't change what
 * it asks — politeness and framing ("can you give me …", "what is …"), and the IELTS task it is
 * for ("Task 1 word for increase"). They are taken off so the ordered patterns in classify.ts can
 * read the question, and the task is kept to put the language used in it first.
 *
 * Only a fallback: a query the patterns already read is left as it is, except that a task named
 * inside its term ("better word for important in task 2") is taken out of the term. Nothing is
 * stripped from an ordinary lookup that no pattern reads ("writing task 1 language" stays a
 * lookup), so no learner's words are thrown away to force a reading.
 */
import type { IeltsTask } from "../schema/vocabulary";

import { classify, type Classification } from "./classify";

/** "(for|in) (ielts) (writing) task 2", "speaking part 3": the task, and where it was. */
const TASK =
  /(?:^| )(?:(?:for|in|on) )?(?:(?:the )?ielts )?(?:(?:academic )?(writing|speaking) )?(task|part) ([1-3])(?= |$)/;

const IELTS = /(?:^| )(?:for |in )?ielts(?= |$)/;

/** Framing before a question: "please", "can you give me", "what is", "is there". */
const LEADING =
  /^(?:please|pls|hi|hello|hey|so|ok|okay|can you|could you|would you|will you|can i (?:get|have)|could i (?:get|have)|give me|tell me|show me|find me|help me find|i need|i'm looking for|i am looking for|im looking for|looking for|is there|are there|what is|what's|whats|what are|which is|do you know|do you have) /;

const TRAILING = / (?:please|pls|thanks|thank you)$|\?+$/;

/** The task named in a normalised query, and the query without it. */
export function extractTask(normalised: string): { text: string; task?: IeltsTask } {
  const match = TASK.exec(normalised);
  let text = normalised;
  let task: IeltsTask | undefined;
  if (match) {
    const [, skill, unit, number] = match;
    const speaking = skill === "speaking" || (skill === undefined && unit === "part");
    const candidate = `${speaking ? "speaking" : "writing"}-${number}` as IeltsTask;
    // Writing has two tasks; a "writing part 3" names nothing.
    if (speaking || number !== "3") {
      task = candidate;
      text = `${normalised.slice(0, match.index)} ${normalised.slice(match.index + match[0].length)}`;
    }
  }
  text = text.replace(IELTS, " ").replace(/\s+/g, " ").trim();
  return { text, ...(task && { task }) };
}

/** The query without framing words at either end. */
export function stripFraming(normalised: string) {
  let text = normalised;
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text.replace(LEADING, "").replace(TRAILING, "").trim();
  }
  return text;
}

const readsAsRequest = (c: Classification) => c.intent !== "LOOKUP" && c.intent !== "CONTEXT_GAP";

/**
 * Classifies a normalised query (classify.ts), reading through framing words and an IELTS task
 * when the query as typed reads only as a lookup.
 */
export function readRequest(normalised: string): Classification {
  const plain = classify(normalised);
  if (plain.intent === "CONTEXT_GAP") return plain;
  if (readsAsRequest(plain)) {
    const value = plain.term ?? plain.phrase;
    if (value === undefined) return plain;
    const { text, task } = extractTask(value);
    if (!task || !text) return plain;
    return { ...plain, ...(plain.term ? { term: text } : { phrase: text }), task };
  }

  const { text, task } = extractTask(normalised);
  const variants = [
    { text, task },
    { text: stripFraming(normalised), task: undefined },
    { text: stripFraming(text), task },
  ];
  for (const variant of variants) {
    if (!variant.text || variant.text === normalised) continue;
    const c = classify(variant.text);
    if (readsAsRequest(c)) return { ...c, ...(variant.task && { task: variant.task }) };
  }
  return plain;
}
