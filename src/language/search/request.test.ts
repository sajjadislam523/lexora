import { describe, expect, it } from "vitest";

import { normaliseQuery } from "../normalise";

import { extractTask, readRequest, stripFraming } from "./request";

const read = (query: string) => readRequest(normaliseQuery(query));

describe("readRequest", () => {
  it.each([
    "better word for important",
    "Better word for IMPORTANT?!",
    "  better   word   for important ",
    "a better word for important",
    "what is a better word for important",
    "what's a better word for important?",
    "another word for important",
    "alternative word for important",
    "can you give me another word for important please",
    "is there a better word for important",
  ])("reads %j as a synonym request for “important”", (query) => {
    expect(read(query)).toMatchObject({ intent: "SYNONYM", term: "important" });
  });

  it.each([
    ["preposition after responsible", "PREPOSITION", "responsible"],
    ["what is the preposition after responsible", "PREPOSITION", "responsible"],
    ["alternative to however", "ALTERNATIVE", "however"],
    ["tell me an alternative to however", "ALTERNATIVE", "however"],
    ["formal way to say think", "SYNONYM", "think"],
    ["academic way to say show", "SYNONYM", "show"],
    ["word meaning very important", "SYNONYM", "very important"],
  ])("reads %j as %s about %j", (query, intent, term) => {
    expect(read(query)).toMatchObject({ intent, term });
  });

  it.each([
    ["linker for reason", "cause"],
    ["cause and effect linker", "cause"],
    ["contrast linking words", "contrast"],
  ])("reads %j as a linker request for %s", (query, fn) => {
    expect(read(query)).toMatchObject({ intent: "LINKER", function: fn });
  });

  it("keeps register modifiers through the new phrasings", () => {
    expect(read("formal way to say think").modifiers).toEqual(["formal"]);
    expect(read("academic word for good").modifiers).toEqual(["academic"]);
  });

  it.each([
    ["IELTS Task 1 word for increase", "SYNONYM", "increase", "writing-1"],
    ["Task 2 phrase for giving an opinion", "PHRASE", undefined, "writing-2"],
    ["writing task 2 linker for contrast", "LINKER", undefined, "writing-2"],
    ["better word for important in task 2", "SYNONYM", "important", "writing-2"],
    ["speaking part 3 word for good", "SYNONYM", "good", "speaking-3"],
  ])("reads the task in %j", (query, intent, term, task) => {
    expect(read(query)).toMatchObject({ intent, ...(term && { term }), task });
  });

  it("leaves a query no pattern reads as it is, framing and all", () => {
    expect(read("writing task 1 language")).toMatchObject({
      intent: "LOOKUP",
      term: "writing task 1 language",
    });
    expect(read("what's more")).toMatchObject({ intent: "LOOKUP", term: "what's more" });
    expect(read("increase")).toMatchObject({ intent: "LOOKUP", term: "increase" });
    expect(read("increase").task).toBeUndefined();
  });

  it("never reads a gap query differently", () => {
    expect(read("Task 1: prices rose ___ in 2020").intent).toBe("CONTEXT_GAP");
  });
});

describe("extractTask", () => {
  it.each([
    ["task 1 word for increase", "word for increase", "writing-1"],
    ["word for increase for ielts task 1", "word for increase", "writing-1"],
    ["ielts writing task 2 essay phrase", "essay phrase", "writing-2"],
    ["speaking part 2 phrase", "phrase", "speaking-2"],
    ["part 1 word for like", "word for like", "speaking-1"],
  ])("%j → %j (%s)", (text, rest, task) => {
    expect(extractTask(text)).toEqual({ text: rest, task });
  });

  it("names no task for writing part 3 or no number, and drops a bare “ielts”", () => {
    expect(extractTask("writing part 3 word")).toEqual({ text: "writing part 3 word" });
    expect(extractTask("ielts word for good")).toEqual({ text: "word for good" });
  });
});

describe("stripFraming", () => {
  it.each([
    ["please give me a word for good", "a word for good"],
    ["could you tell me what is a word for good thanks", "a word for good"],
    ["word for good?", "word for good"],
    ["word for good", "word for good"],
  ])("%j → %j", (text, stripped) => {
    expect(stripFraming(text)).toBe(stripped);
  });
});
