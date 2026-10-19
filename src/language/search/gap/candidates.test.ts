import { describe, expect, it } from "vitest";

import { normaliseQuery } from "../../normalise";
import type { CollocationTemplate, GapFrame, LinkerHit, PatternHit } from "../repository";

import {
  anchorWords,
  baseCandidates,
  collocationCandidates,
  differsInFirstWordOnly,
  formCandidates,
  framePrepositionCandidates,
  gapWindows,
  headCandidates,
  inflectionFamilies,
  jointCandidates,
  linkerCandidates,
  linkerSlot,
  orderCandidates,
  prepositionCandidates,
  reachesFrameHead,
  wordsBetween,
  type GapCandidate,
} from "./candidates";
import { planGaps } from "./reader";

function windowsOf(query: string) {
  const plan = planGaps(query);
  if (plan.kind !== "gap") throw new Error(`not a gap query: ${query}`);
  return gapWindows(normaliseQuery(plan.text), query, plan.blanks);
}
const first = (query: string) => windowsOf(query)[0]!;

const pattern = (over: Partial<PatternHit>): PatternHit => ({
  id: "responsible-for.duty:for",
  senseId: "responsible-for.duty",
  base: "responsible",
  preposition: "for",
  pattern: "be responsible for + noun / -ing",
  complement: "noun_or_ing",
  position: 0,
  ...over,
});

const template = (over: Partial<CollocationTemplate>): CollocationTemplate => ({
  id: "significant.notable:increase",
  senseId: "significant.notable",
  normalized: "a significant increase",
  display: "a significant increase",
  ...over,
});

describe("gapWindows", () => {
  it("reads up to four words on each side, nearest first", () => {
    expect(first("Cars are largely responsible ___ the air pollution in cities")).toMatchObject({
      index: 0,
      before: ["responsible", "largely", "are", "cars"],
      after: ["the", "air", "pollution", "in"],
    });
  });

  it("stops at the other blank", () => {
    const [one, two] = windowsOf("Governments should ___ more money ___ public transport");
    expect(one).toMatchObject({ before: ["should", "governments"], after: ["more", "money"] });
    expect(two).toMatchObject({
      index: 1,
      before: ["money", "more"],
      after: ["public", "transport"],
    });
  });

  it("stops at punctuation next to the blank, and keeps it as linker evidence", () => {
    expect(first("___, it is often slow")).toMatchObject({
      before: [],
      after: [],
      atStart: true,
      commaAfter: true,
      wordsAfter: true,
    });
    expect(first("Prices rose, ___ demand fell")).toMatchObject({
      before: [],
      after: ["demand", "fell"],
      commaBefore: true,
    });
    expect(first("Prices rose. ___ demand fell")).toMatchObject({ before: [], atStart: true });
  });
});

describe("preposition candidates", () => {
  it("tries every run of words that ends right before the blank", () => {
    const window = first("Tourism plays a crucial role ___ the economy");
    expect(baseCandidates(window)).toEqual([
      "role",
      "crucial role",
      "a crucial role",
      "plays a crucial role",
    ]);
    expect(formCandidates(first("It depends ___ the weather"))).toContain("depends on");
  });

  it("keeps a pattern whose base ends the words before the blank, with its own sense", () => {
    const found = prepositionCandidates(first("responsible ___ the project"), [
      { pattern: pattern({}) },
      {
        pattern: pattern({
          id: "responsible-for.duty:to",
          preposition: "to",
          pattern: "be responsible to + person",
        }),
      },
    ]);
    expect(found.map((c) => [c.fill, c.senseId, c.evidence.id])).toEqual([
      ["for", "responsible-for.duty", "responsible-for.duty:for"],
      ["to", "responsible-for.duty", "responsible-for.duty:to"],
    ]);
  });

  it("finds a pattern through an inflected form of its item", () => {
    const found = prepositionCandidates(first("The report focused ___ housing"), [
      {
        pattern: pattern({
          id: "focus-on.attention:on",
          senseId: "focus-on.attention",
          base: "focus",
          preposition: "on",
          pattern: "focus on + noun / -ing",
        }),
        viaForm: "focused on",
      },
    ]);
    expect(found.map((c) => c.fill)).toEqual(["on"]);
  });

  it("ignores a pattern whose preposition comes after an object, not after its base", () => {
    const allocate = pattern({
      id: "allocate.distribute:to",
      senseId: "allocate.distribute",
      base: "allocate",
      preposition: "to",
      pattern: "allocate + noun + to + noun",
    });
    expect(
      prepositionCandidates(first("We should allocate ___ schools"), [{ pattern: allocate }]),
    ).toEqual([]);
  });

  it("ignores a form whose preposition isn't the pattern's", () => {
    const found = prepositionCandidates(first("It depends ___ the weather"), [
      {
        pattern: pattern({
          id: "x",
          base: "depend",
          preposition: "on",
          pattern: "depend on + noun",
        }),
        viaForm: "depends for",
      },
    ]);
    expect(found).toEqual([]);
  });

  it("keeps the mistake the pattern links to, as evidence for later steps", () => {
    const [candidate] = prepositionCandidates(first("responsible ___ the project"), [
      { pattern: pattern({ mistakeId: "responsible-for.duty:of" }) },
    ]);
    expect(candidate?.evidence.mistakeId).toBe("responsible-for.duty:of");
  });
});

describe("collocation candidates", () => {
  it("fills the blank with the one collocation word it lines up with", () => {
    const window = first("There was a ___ increase in cycling");
    // Every content word around the blank (Step 4.4), not only the ones next to it.
    expect(anchorWords(window)).toEqual(["was", "there", "increase", "cycling"]);
    const found = collocationCandidates(window, [template({})]);
    expect(found.map((c) => [c.fill, c.senseId, c.term])).toEqual([
      ["significant", "significant.notable", "a significant increase"],
    ]);
  });

  it("accepts an inflection in the learner's words", () => {
    const found = collocationCandidates(first("Public transport plays a ___ role"), [
      template({
        id: "play-a-crucial-role.main:key",
        senseId: "play-a-crucial-role.main",
        normalized: "play a key role",
        display: "play a key role",
      }),
    ]);
    expect(found.map((c) => c.fill)).toEqual(["key"]);
  });

  it("needs every other word to line up", () => {
    expect(collocationCandidates(first("There was a ___ decrease"), [template({})])).toEqual([]);
    expect(collocationCandidates(first("___ increase"), [template({})])).toEqual([]);
  });

  it("needs a content word in the collocation, and never puts a stopword in the blank", () => {
    expect(anchorWords(first("a ___ the"))).toEqual([]);
    expect(
      collocationCandidates(first("a ___ the"), [
        template({ normalized: "a few the", display: "x" }),
      ]),
    ).toEqual([]);
    expect(
      collocationCandidates(first("take measures ___ reduce crime"), [
        template({
          id: "take-measures.act:to",
          senseId: "take-measures.act",
          normalized: "take measures to",
          display: "take measures to",
        }),
      ]),
    ).toEqual([]);
  });

  it("prefers a full collocation item over the same words authored under a word", () => {
    const found = collocationCandidates(first("Teachers play a ___ role"), [
      template({
        id: "crucial.essential:role",
        senseId: "crucial.essential",
        itemId: "play-a-crucial-role",
        normalized: "play a crucial role",
        display: "play a crucial role",
      }),
      template({
        id: "form:play-a-crucial-role:play a crucial role",
        senseId: "play-a-crucial-role.main",
        itemId: "play-a-crucial-role",
        normalized: "play a crucial role",
        display: "play a crucial role",
        base: "play a crucial role",
      }),
    ]);
    expect(found.map((c) => c.senseId)).toEqual(["play-a-crucial-role.main"]);
  });

  it("gives the same candidates whatever order the rows come in", () => {
    const rows = [
      template({ id: "b", normalized: "a big increase", display: "a big increase" }),
      template({ id: "a", normalized: "a big increase", display: "a big increase" }),
    ];
    const window = first("There was a ___ increase");
    expect(collocationCandidates(window, rows)).toEqual(
      collocationCandidates(window, [...rows].reverse()),
    );
  });
});

describe("Step 4.4: inflected multiword bases", () => {
  const pose = pattern({
    id: "pose-a-threat.danger:to",
    senseId: "pose-a-threat.danger",
    base: "pose a threat",
    preposition: "to",
    pattern: "pose a threat to + noun",
    complement: "noun",
  });

  it("looks the bare base runs up as forms too", () => {
    expect(formCandidates(first("Plastic waste poses a threat ___ marine life"))).toEqual(
      expect.arrayContaining(["poses a threat", "a threat", "threat", "poses a threat to"]),
    );
  });

  it("reaches a pattern through a form that inflects only the base's first word", () => {
    const window = first("Plastic waste poses a threat ___ marine life");
    const found = prepositionCandidates(window, [{ pattern: pose, viaForm: "poses a threat" }]);
    expect(found.map((c) => [c.fill, c.senseId, c.span])).toEqual([
      ["to", "pose-a-threat.danger", 3],
    ]);
  });

  it("doesn't let a form that differs elsewhere stand in for the base", () => {
    expect(differsInFirstWordOnly("poses a threat", "pose a threat")).toBe(true);
    expect(differsInFirstWordOnly("depend upon", "depend on")).toBe(false);
    expect(differsInFirstWordOnly("pose threats", "pose a threat")).toBe(false);
    const window = first("Plastic waste poses threats ___ marine life");
    expect(prepositionCandidates(window, [{ pattern: pose, viaForm: "poses threats" }])).toEqual(
      [],
    );
  });
});

describe("Step 4.4: prepositions after a verb frame's object", () => {
  const allocatePattern = pattern({
    id: "allocate.distribute:to",
    senseId: "allocate.distribute",
    base: "allocate",
    preposition: "to",
    pattern: "allocate + noun + to + noun",
    complement: "noun",
    mistakeId: "allocate.distribute:in",
  });
  const allocate: GapFrame = {
    id: "allocate.distribute:money-to",
    senseId: "allocate.distribute",
    head: "allocate",
    fillers: ["money", "funds", "time"],
    prepositions: ["to", "for"],
    next: "noun",
    display: "allocate something to / for + noun",
  };
  const rows = [{ pattern: allocatePattern, viaForm: "allocated" }];

  it("looks up the words a frame's head can be: before[1…3]", () => {
    expect(headCandidates(first("The council allocated more money ___ schools"))).toEqual([
      "more",
      "allocated",
      "council",
    ]);
  });

  it("offers the frame's prepositions in authored order, with its evidence", () => {
    const window = first("The council allocated money ___ education");
    expect(reachesFrameHead(window, rows)).toBe(true);
    const found = framePrepositionCandidates(window, rows, [allocate]);
    expect(
      found.map((c) => [
        c.type,
        c.fill,
        c.complement,
        c.evidence,
        c.span,
        c.context,
        c.objectAuthored,
      ]),
    ).toEqual([
      [
        "frame_preposition",
        "to",
        "noun",
        {
          id: "allocate.distribute:money-to",
          display: "allocate something to / for + noun",
          mistakeId: "allocate.distribute:in",
        },
        2,
        "allocated money",
        true,
      ],
      [
        "frame_preposition",
        "for",
        "noun",
        { id: "allocate.distribute:money-to", display: "allocate something to / for + noun" },
        2,
        "allocated money",
        true,
      ],
    ]);
  });

  it("skips skip words between the head and the object, and keeps an unauthored object", () => {
    const [to] = framePrepositionCandidates(
      first("They allocated more land ___ housing"),
      [{ pattern: allocatePattern }].map((row) => ({ ...row, viaForm: "allocated" })),
      [allocate],
    );
    expect([to?.span, to?.context, to?.objectAuthored]).toEqual([3, "allocated more land", false]);
  });

  it.each([
    "We need to allocate ___ education",
    "They allocated it ___ schools",
    "Councils allocated sums quickly ___ schools",
    "The money was allocated ___ schools",
  ])("finds no head and object before the blank in %j", (query) => {
    const window = first(query);
    expect(reachesFrameHead(window, rows)).toBe(false);
    expect(framePrepositionCandidates(window, rows, [allocate])).toEqual([]);
  });

  it("ignores patterns whose preposition follows the base, and frames of other senses", () => {
    const window = first("The council allocated money ___ education");
    expect(
      framePrepositionCandidates(window, rows, [{ ...allocate, senseId: "other.sense" }]),
    ).toEqual([]);
    expect(
      framePrepositionCandidates(
        window,
        [{ pattern: pattern({}), viaForm: "allocated" }],
        [allocate],
      ),
    ).toEqual([]);
  });
});

describe("Step 4.4: collocation guards, anchor and authored inflections", () => {
  const takeForms = [
    { itemId: "take-measures", normalized: "take measures" },
    { itemId: "take-measures", normalized: "takes measures" },
    { itemId: "take-measures", normalized: "took measures" },
  ];
  const form = (normalized: string, base = "take measures"): CollocationTemplate =>
    template({
      id: `form:take-measures:${normalized}`,
      senseId: "take-measures.act",
      itemId: "take-measures",
      normalized,
      display: normalized,
      base,
    });
  const steps = template({
    id: "take-measures.act:steps",
    senseId: "take-measures.act",
    normalized: "take steps",
    display: "take steps",
  });

  it("reads inflection families from forms that differ only in their first word", () => {
    const families = inflectionFamilies([
      ...takeForms,
      { itemId: "in-contrast", normalized: "in contrast" },
      { itemId: "in-contrast", normalized: "by contrast" },
      { itemId: "depend-on", normalized: "depend on" },
      { itemId: "depend-on", normalized: "depend upon" },
      { itemId: "allocate", normalized: "allocate" },
      { itemId: "allocate", normalized: "allocated" },
    ]);
    expect(families("take", "took")).toBe(true);
    expect(families("takes", "took")).toBe(true);
    expect(families("allocate", "allocated")).toBe(true);
    expect(families("take", "take")).toBe(false);
    // A function word isn't an inflection, and later words never make a family.
    expect(families("in", "by")).toBe(false);
    expect(families("on", "upon")).toBe(false);
  });

  it("never offers the learner's own neighbouring word, or an inflection of it (G1, G2)", () => {
    const families = inflectionFamilies(takeForms);
    const found = collocationCandidates(
      first("Governments must take ___ measures"),
      [form("take measures"), form("takes measures"), form("took measures"), steps],
      families,
    );
    expect(found.map((c) => c.fill)).toEqual(["steps"]);
  });

  it("offers from an inflected form only the words of its item's base form (G2)", () => {
    const found = collocationCandidates(first("There is ___ measures"), [
      form("takes measures"),
      form("take measures"),
    ]);
    expect(found.map((c) => [c.fill, c.evidence.id])).toEqual([
      ["take", "form:take-measures:take measures"],
    ]);
    expect(
      collocationCandidates(first("There is ___ measures"), [form("takes measures", "")]),
    ).toEqual([]);
  });

  it("marks a collocation that ends at the blank before an unchecked content word (G3)", () => {
    const [open] = collocationCandidates(first("They take ___ measures"), [steps]);
    expect(open?.openRight).toBe(true);
    const [closed] = collocationCandidates(first("They take ___ to cut costs"), [steps]);
    expect(closed?.openRight).toBeUndefined();
    const [end] = collocationCandidates(first("They take ___"), [steps]);
    expect(end?.openRight).toBeUndefined();
  });

  it("marks a collocation that starts at the blank after a function word, and only then", () => {
    const threat = template({
      id: "form:pose-a-threat:pose a threat",
      senseId: "pose-a-threat.danger",
      itemId: "pose-a-threat",
      normalized: "pose a threat",
      display: "pose a threat",
      base: "pose a threat",
    });
    const [afterIs] = collocationCandidates(first("There is ___ a threat"), [threat]);
    expect([afterIs?.fill, afterIs?.openLeft]).toEqual(["pose", true]);
    const [afterNoun] = collocationCandidates(first("Plastic waste ___ a threat"), [threat]);
    expect(afterNoun?.openLeft).toBeUndefined();
    const [atStart] = collocationCandidates(first("___ a threat to wildlife"), [threat]);
    expect(atStart?.openLeft).toBeUndefined();
    const [afterComma] = collocationCandidates(first("It is, ___ a threat"), [threat]);
    expect(afterComma?.openLeft).toBeUndefined();
    // A collocation word before the blank is covered: nothing is open on that side.
    const [covered] = collocationCandidates(first("There was a ___ increase"), [template({})]);
    expect(covered?.openLeft).toBeUndefined();
  });

  it("anchors on any content word of the collocation, not only the one next to the blank", () => {
    const threat = template({
      id: "form:pose-a-threat:pose a threat",
      senseId: "pose-a-threat.danger",
      itemId: "pose-a-threat",
      normalized: "pose a threat",
      display: "pose a threat",
      base: "pose a threat",
    });
    const window = first("Plastic waste ___ a threat to marine life");
    expect(anchorWords(window)).toEqual(["waste", "plastic", "threat", "marine"]);
    expect(collocationCandidates(window, [threat]).map((c) => c.fill)).toEqual(["pose"]);
    // Step 4.5 (G5-D4): a collocation of function words aligns, flagged for a capped verdict.
    const crucial = template({ normalized: "it is crucial that", display: "it is crucial that" });
    expect(
      collocationCandidates(first("It is ___ that we act"), [crucial]).map((c) => [
        c.fill,
        c.functionWordsOnly,
      ]),
    ).toEqual([["crucial", true]]);
  });

  it("matches a first word through an authored inflection as written, and only the first", () => {
    const families = inflectionFamilies([
      ...takeForms,
      { itemId: "rise-sharply", normalized: "rise sharply" },
      { itemId: "rise-sharply", normalized: "rose sharply" },
    ]);
    const [took] = collocationCandidates(first("They took ___ to cut costs"), [steps], families);
    expect([took?.fill, took?.authoredForm, took?.inflected]).toEqual(["steps", true, undefined]);
    expect(collocationCandidates(first("They took ___ to cut costs"), [steps])).toEqual([]);
    const sharpRise = template({ normalized: "a sharp rise", display: "a sharp rise" });
    expect(collocationCandidates(first("There was a ___ rose"), [sharpRise], families)).toEqual([]);
  });

  it("prefers a match as written over an authored inflection over the stemmer", () => {
    const families = inflectionFamilies(takeForms);
    const [found] = collocationCandidates(
      first("They took ___ to cut costs"),
      [form("take measures"), form("took measures")],
      families,
    );
    expect(found?.evidence.id).toBe("form:take-measures:took measures");
    expect(found?.authoredForm).toBeUndefined();
  });
});

describe("linker candidates", () => {
  const linkers: LinkerHit[] = [
    {
      senseId: "however.contrast",
      headword: "however",
      positions: ["start", "middle", "end"],
      connects: "sentences",
      functions: ["contrast"],
    },
    {
      senseId: "whereas.contrast",
      headword: "whereas",
      positions: ["start", "middle"],
      connects: "clauses",
      functions: ["contrast"],
    },
    {
      senseId: "furthermore.addition",
      headword: "furthermore",
      positions: ["start"],
      connects: "sentences",
      functions: ["addition"],
    },
  ];
  const fills = (query: string) => linkerCandidates(first(query), linkers).map((c) => c.fill);

  it("reads the position from the learner's punctuation", () => {
    expect(linkerSlot(first("___, it is cheap"))).toBe("start");
    expect(linkerSlot(first("Spending, ___, increased"))).toBe("between_commas");
    expect(linkerSlot(first("I love cities, ___ she prefers the country"))).toBe("after_comma");
  });

  it("offers linkers that go in that position and connect what is there", () => {
    expect(fills("___, it is cheap")).toEqual(["however", "furthermore"]);
    expect(fills("Spending, ___, increased")).toEqual(["however"]);
    expect(fills("I love cities, ___ she prefers the country")).toEqual(["whereas"]);
  });

  it("doesn't guess without punctuation, or with nothing to link", () => {
    expect(linkerSlot(first("___ it is cheap"))).toBeUndefined();
    expect(linkerSlot(first("It is cheap, ___"))).toBeUndefined();
    expect(fills("___ it is cheap")).toEqual([]);
  });
});

describe("orderCandidates", () => {
  const candidate = (over: Partial<GapCandidate>): GapCandidate => ({
    gap: 0,
    type: "collocation",
    senseId: "a",
    fill: "x",
    term: "x",
    evidence: { id: "a", display: "x" },
    span: 1,
    ...over,
  });

  it("orders by span, relevance, headword, then evidence id", () => {
    const facts = {
      a: { relevance: "high" as const, headword: "b" },
      b: { relevance: "core" as const, headword: "z" },
      c: { relevance: "core" as const, headword: "a" },
      d: { relevance: "core" as const, headword: "a" },
    };
    const ordered = orderCandidates(
      [
        candidate({ senseId: "a", evidence: { id: "a", display: "" }, span: 3 }),
        candidate({ senseId: "b", evidence: { id: "b", display: "" } }),
        candidate({ senseId: "d", evidence: { id: "d", display: "" } }),
        candidate({ senseId: "c", evidence: { id: "c", display: "" } }),
      ],
      (id) => facts[id as keyof typeof facts],
      [],
    );
    expect(ordered.map((c) => c.senseId)).toEqual(["a", "c", "d", "b"]);
  });

  it("groups linkers by their first function, in vocabulary order", () => {
    const ordered = orderCandidates(
      [candidate({ senseId: "c", type: "linker" }), candidate({ senseId: "a", type: "linker" })],
      (id) => ({
        relevance: "core",
        headword: id,
        firstFunction: id === "a" ? "result" : "addition",
      }),
      ["addition", "result"],
    );
    expect(ordered.map((c) => c.senseId)).toEqual(["c", "a"]);
  });
});

describe("Step 4.5: precision repairs", () => {
  const playKey = template({
    id: "play-a-crucial-role.main:key",
    senseId: "play-a-crucial-role.main",
    normalized: "play a key role",
    display: "play a key role",
  });

  it.each([
    "It was ___ a key role",
    "They were ___ a key role",
    "It has been ___ a key role",
    "We have ___ a key role",
    "I am ___ a key role",
  ])("R-1: a form of be or have before the blank leaves that side unchecked: %j", (query) => {
    const [found] = collocationCandidates(first(query), [playKey]);
    expect([found?.fill, found?.openLeft]).toEqual(["play", true]);
  });

  it("R-1: a modal, a noun or nothing before the blank leaves it checked", () => {
    for (const query of ["This will ___ a key role", "Teachers ___ a key role", "___ a key role"]) {
      expect(collocationCandidates(first(query), [playKey])[0]?.openLeft, query).toBeUndefined();
    }
  });

  it("R-2: a content word after a collocation that ends on a content word is unchecked", () => {
    const [models] = collocationCandidates(first("Teachers play a ___ role models"), [playKey]);
    expect([models?.fill, models?.openRight, models?.rightWord]).toEqual(["key", true, "models"]);
    const [inShaping] = collocationCandidates(first("Teachers play a ___ role in shaping"), [
      playKey,
    ]);
    expect(inShaping?.openRight).toBeUndefined();
    const [atEnd] = collocationCandidates(first("Teachers play a ___ role"), [playKey]);
    expect(atEnd?.openRight).toBeUndefined();
  });

  it("R-2: a collocation that ends with a function word expects what follows", () => {
    const negative = template({
      id: "have-a-detrimental-effect-on.harm:negative",
      senseId: "have-a-detrimental-effect-on.harm",
      normalized: "have a negative effect on",
      display: "have a negative effect on",
    });
    const [found] = collocationCandidates(first("Screens can ___ a negative effect on sleep"), [
      negative,
    ]);
    expect([found?.fill, found?.openRight]).toEqual(["have", undefined]);
  });
});

describe("Step 4.5: collocations made of function words", () => {
  const crucial = template({
    id: "crucial.essential:that",
    senseId: "crucial.essential",
    normalized: "it is crucial that",
    display: "it is crucial that",
  });

  it("looks them up only with at least three function words around the blank", () => {
    expect(anchorWords(first("It is ___ that governments act"))).toEqual(
      expect.arrayContaining(["governments", "act", "is", "it", "that"]),
    );
    expect(anchorWords(first("a ___ the"))).toEqual([]);
  });

  it("aligns them only as written, flagged for a capped verdict", () => {
    expect(
      collocationCandidates(first("It is ___ that governments act"), [crucial]).map((c) => [
        c.fill,
        c.functionWordsOnly,
      ]),
    ).toEqual([["crucial", true]]);
    expect(collocationCandidates(first("It's ___ that governments act"), [crucial])).toEqual([]);
    expect(collocationCandidates(first("It is ___ to consider the costs"), [crucial])).toEqual([]);
    expect(
      collocationCandidates(first("a ___ the"), [
        template({ normalized: "a few the", display: "x" }),
      ]),
    ).toEqual([]);
  });
});

describe("Step 4.5: one structure for both blanks", () => {
  const windows = (query: string) => {
    const plan = planGaps(query);
    if (plan.kind !== "gap") throw new Error(`not a gap query: ${query}`);
    const normalised = normaliseQuery(plan.text);
    return {
      between: wordsBetween(normalised, query, plan.blanks),
      windows: gapWindows(normalised, query, plan.blanks),
    };
  };
  const invest: GapFrame = {
    id: "invest.money:money-in",
    senseId: "invest.money",
    head: "invest",
    fillers: ["money", "funds", "time"],
    prepositions: ["in", "into"],
    next: "noun",
    display: "invest something in / into + noun",
  };
  const allocate: GapFrame = {
    id: "allocate.distribute:money-to",
    senseId: "allocate.distribute",
    head: "allocate",
    fillers: ["money", "funds", "land-not-here"],
    prepositions: ["to", "for"],
    next: "noun",
    display: "allocate something to / for + noun",
  };
  const investIn = pattern({
    id: "invest.money:in",
    senseId: "invest.money",
    base: "invest",
    preposition: "in",
    pattern: "invest + money / time + in + noun / -ing",
    complement: "noun_or_ing",
    mistakeId: "invest.money:on",
  });
  const poseTo = pattern({
    id: "pose-a-threat.danger:to",
    senseId: "pose-a-threat.danger",
    base: "pose a threat",
    preposition: "to",
    pattern: "pose a threat to + noun",
    complement: "noun",
  });

  const pairs = (query: string, frames: GapFrame[], patterns: PatternHit[]) => {
    const {
      between,
      windows: [first],
    } = windows(query);
    return between ? jointCandidates(between, first!, frames, patterns) : [];
  };

  it("reads the words between two blanks: one to four, with no punctuation", () => {
    expect(windows("Governments should ___ more money ___ public transport").between).toEqual([
      "more",
      "money",
    ]);
    expect(windows("Governments should ___ more money, ___ transport").between).toBeUndefined();
    expect(windows("They ___ money every single year again ___ schools").between).toBeUndefined();
    expect(windows("They ___ ___ schools").between).toBeUndefined();
    expect(windows("They ___ money for schools").between).toBeUndefined();
  });

  it("pairs each frame's head with its own prepositions, never another frame's", () => {
    const found = pairs(
      "Governments should ___ more money ___ public transport",
      [invest, allocate],
      [investIn],
    );
    expect(found.map((c) => `${c.fill} … ${c.preposition}:${c.complement}`)).toEqual([
      "allocate … to:noun",
      "allocate … for:noun",
      "invest … in:noun_or_ing",
      "invest … into:noun",
    ]);
    expect(found.find((c) => c.preposition === "in")?.evidence).toEqual({
      id: "invest.money:money-in",
      display: "invest something in / into + noun",
      mistakeId: "invest.money:on",
    });
  });

  it("needs an object the frame authors, right before the second blank", () => {
    expect(pairs("The council ___ land ___ housing", [invest], [])).toEqual([]);
    expect(pairs("They ___ money each year ___ schools", [invest], [])).toEqual([]);
    expect(pairs("They ___ it ___ schools", [invest], [])).toEqual([]);
  });

  it("pairs a pattern on a phrase when the words between are its base after the first word", () => {
    expect(
      pairs("Plastic waste ___ a threat ___ marine life", [], [poseTo]).map(
        (c) => `${c.structure}:${c.fill} … ${c.preposition}`,
      ),
    ).toEqual(["pattern:pose … to"]);
    expect(pairs("Plastic waste ___ a serious threat ___ marine life", [], [poseTo])).toEqual([]);
    expect(pairs("Plastic waste ___ threat ___ marine life", [], [poseTo])).toEqual([]);
  });

  it("never offers a stopword for the first blank", () => {
    const inContrast = pattern({
      id: "in-contrast.difference:to",
      senseId: "in-contrast.difference",
      base: "in contrast",
      preposition: "to",
      pattern: "in contrast to + noun",
      complement: "noun",
    });
    expect(pairs("___ contrast ___ their parents", [], [inContrast])).toEqual([]);
  });

  it("marks the first blank's left side unchecked after a function word or a form of be/have", () => {
    expect(pairs("We need to ___ more money ___ schools", [invest], [])[0]?.openLeft).toBe(true);
    expect(pairs("They have ___ money ___ schools", [invest], [])[0]?.openLeft).toBe(true);
    expect(pairs("Governments ___ money ___ schools", [invest], [])[0]?.openLeft).toBeUndefined();
  });
});
