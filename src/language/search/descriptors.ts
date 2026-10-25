/**
 * Descriptors (Phase 6B): the size and speed words learners put in a request ("a word for a
 * **large** increase"), and the authored evidence that a piece of language carries them. A small,
 * explicit vocabulary, not a semantic model: each quality lists the words that ask for it, the
 * words that carry it in collocations, and the phrases that carry it in definitions. They are
 * retrieval signals, never definitions or synonyms: a result needs authored content that joins
 * the signal to the learner's head word (see service.ts → descriptorSearch).
 *
 * Adding a quality or a word means adding it here with a test.
 */
import { words } from "../normalise";

export const QUALITIES = ["large", "small", "rapid", "gradual"] as const;
export type Quality = (typeof QUALITIES)[number];

type QualitySignals = {
  /**
   * Words that carry the quality in an authored collocation or headword, in priority order. The
   * -ly adverb of each counts too ("dramatic" → "dramatically").
   */
  signals: readonly string[];
  /** Phrases that carry it in an authored definition ("by a large amount"), whole words. */
  glosses: readonly string[];
};

export const QUALITY_SIGNALS: Record<Quality, QualitySignals> = {
  large: {
    signals: ["significant", "substantial", "considerable", "dramatic", "marked", "major"],
    glosses: ["large", "big", "a lot", "a great deal"],
  },
  small: {
    signals: ["slight", "marginal", "minor", "modest", "small"],
    glosses: ["small amount", "small degree", "a little", "slightly", "very small"],
  },
  rapid: {
    signals: ["sharp", "rapid", "sudden", "steep", "dramatic", "quick", "fast"],
    glosses: ["quickly", "suddenly", "sudden", "rapidly", "rapid", "fast"],
  },
  gradual: {
    signals: ["gradual", "steady", "slow", "progressive"],
    glosses: ["gradually", "gradual", "slowly", "steadily", "over a period"],
  },
};

/** Words in a request that ask for a quality. Some ask for two ("sharp": fast and large). */
const QUALITY_WORDS: Record<string, readonly Quality[]> = {
  large: ["large"],
  big: ["large"],
  huge: ["large"],
  great: ["large"],
  massive: ["large"],
  enormous: ["large"],
  significant: ["large"],
  substantial: ["large"],
  considerable: ["large"],
  major: ["large"],
  marked: ["large"],
  noticeable: ["large"],
  dramatic: ["large", "rapid"],
  sharp: ["rapid", "large"],
  steep: ["rapid", "large"],
  sudden: ["rapid"],
  rapid: ["rapid"],
  quick: ["rapid"],
  fast: ["rapid"],
  abrupt: ["rapid"],
  small: ["small"],
  slight: ["small"],
  tiny: ["small"],
  minor: ["small"],
  modest: ["small"],
  marginal: ["small"],
  gradual: ["gradual"],
  slow: ["gradual"],
  steady: ["gradual"],
  progressive: ["gradual"],
  gentle: ["gradual"],
};

/** Words that ask for a stronger or a weaker word ("very important"). */
const INTENSITY_WORDS: Record<string, "stronger" | "weaker"> = {
  very: "stronger",
  extremely: "stronger",
  really: "stronger",
  highly: "stronger",
  incredibly: "stronger",
  especially: "stronger",
  truly: "stronger",
  absolutely: "stronger",
  somewhat: "weaker",
  fairly: "weaker",
  rather: "weaker",
  slightly: "weaker",
};

const ARTICLES = new Set(["a", "an", "the"]);

/** Words that negate a gloss right after them: "not very large" doesn't say large. */
const NEGATIONS = new Set(["not", "no", "never", "without", "less", "hardly"]);

export type Descriptor =
  | {
      kind: "quality";
      /** The learner's descriptor word ("huge"). */
      word: string;
      qualities: readonly Quality[];
      /** The head word or phrase it describes, without articles ("rise"). */
      head: string;
      /** Before the head ("a large increase"): a noun phrase. After it ("rise sharply"): a verb. */
      reading: "noun" | "verb";
    }
  | { kind: "intensity"; word: string; direction: "stronger" | "weaker"; head: string };

/** The -ly adverb of an adjective: dramatic → dramatically, steady → steadily, gentle → gently. */
export function adverbOf(adjective: string) {
  if (adjective.endsWith("ic")) return `${adjective}ally`;
  if (adjective.endsWith("le")) return `${adjective.slice(0, -1)}y`;
  if (adjective.endsWith("y")) return `${adjective.slice(0, -1)}ily`;
  return `${adjective}ly`;
}

/** The quality words of an adverb ("sharply" → sharp), so "rise sharply" reads as a descriptor. */
const ADVERB_QUALITIES = new Map(
  Object.entries(QUALITY_WORDS).map(([word, qualities]) => [adverbOf(word), { word, qualities }]),
);

/**
 * Reads a size, speed or intensity word in a request's term: "a large increase", "very
 * important", "rise sharply". A term that is only the descriptor ("large") has no head and isn't
 * read. Articles before the descriptor or head are dropped.
 */
export function readDescriptor(term: string): Descriptor | undefined {
  let list = words(term);
  if (ARTICLES.has(list[0] ?? "")) list = list.slice(1);
  if (list.length < 2) return undefined;
  const [first, ...rest] = list as [string, ...string[]];

  const direction = INTENSITY_WORDS[first];
  // "a very large increase": the intensity word only strengthens the size word after it.
  if (direction && !QUALITY_WORDS[rest[0]!]) {
    return { kind: "intensity", word: first, direction, head: rest.join(" ") };
  }
  const own = direction ? rest : list;
  const qualities = QUALITY_WORDS[own[0]!];
  if (qualities && own.length > 1) {
    const head = own.slice(1).filter((word, i) => i > 0 || !ARTICLES.has(word));
    if (head.length > 0) {
      return { kind: "quality", word: own[0]!, qualities, head: head.join(" "), reading: "noun" };
    }
  }
  const adverb = ADVERB_QUALITIES.get(list.at(-1)!);
  if (adverb) {
    return {
      kind: "quality",
      word: list.at(-1)!,
      qualities: adverb.qualities,
      head: list.slice(0, -1).join(" "),
      reading: "verb",
    };
  }
  return undefined;
}

/** The signals and glosses of these qualities, the first quality's first. */
export function signalsOf(qualities: readonly Quality[]) {
  const unique = (list: string[]) => [...new Set(list)];
  return {
    signals: unique(qualities.flatMap((q) => QUALITY_SIGNALS[q].signals)),
    glosses: unique(qualities.flatMap((q) => QUALITY_SIGNALS[q].glosses)),
  };
}

/** Whether normalised text contains a normalised phrase as whole words. */
export function containsPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

/**
 * The priority of the first signal a phrase carries (its position in `signals`), as the word or
 * its -ly adverb; -1 when it carries none.
 */
export function signalRank(phrase: string, signals: readonly string[]) {
  const own = new Set(words(phrase));
  return signals.findIndex((signal) => own.has(signal) || own.has(adverbOf(signal)));
}

/** Where a run of words occurs in a list of words: every start position. */
function positions(list: readonly string[], run: readonly string[]) {
  const found: number[] = [];
  for (let at = 0; at + run.length <= list.length; at++) {
    if (run.every((part, i) => list[at + i] === part)) found.push(at);
  }
  return found;
}

/** Positions of a gloss in a list of words that no word just before negates ("not very large"). */
function glossAt(list: readonly string[], gloss: string) {
  return positions(list, words(gloss)).filter(
    (at) => !list.slice(Math.max(0, at - 2), at).some((word) => NEGATIONS.has(word)),
  );
}

/**
 * The priority of the first gloss a normalised definition uses (its position in `glosses`), not
 * negated; -1 when it uses none.
 */
export function glossRank(definition: string, glosses: readonly string[]) {
  const list = words(definition);
  return glosses.findIndex((gloss) => glossAt(list, gloss).length > 0);
}

/** How far apart a descriptor and the word it describes may be in a note: "a sudden, large increase". */
const REACH = 3;

/**
 * Whether a normalised note says the quality of one of the head word's forms: a gloss or signal
 * within a few words of the form ("Surge means a sudden, large increase"). A note that only
 * mentions a gloss elsewhere ("slightly less formal") doesn't. Returns the gloss's or signal's
 * priority, or -1.
 */
export function describesNear(
  note: string,
  forms: readonly string[],
  glosses: readonly string[],
  signals: readonly string[],
) {
  const list = words(note);
  const heads = forms.flatMap((form) => {
    const run = words(form);
    return positions(list, run).map((at) => [at, at + run.length - 1] as const);
  });
  const near = (at: number, length: number) =>
    heads.some(([from, to]) =>
      at + length - 1 < from ? from - (at + length - 1) <= REACH : at - to > 0 && at - to <= REACH,
    );
  const markers = [
    ...glosses.map((gloss) => ({ run: gloss, at: glossAt(list, gloss) })),
    ...signals.map((signal) => ({
      run: signal,
      at: [...positions(list, [signal]), ...positions(list, [adverbOf(signal)])],
    })),
  ];
  const index = markers.findIndex(({ run, at }) => at.some((p) => near(p, words(run).length)));
  if (index < 0) return -1;
  return index < glosses.length ? index : index - glosses.length;
}

/**
 * Whether a normalised collocation puts its descriptor before the head word ("a sharp
 * increase", a noun phrase) or after it ("increase sharply", a verb); undefined when it has no
 * signal or no form of the head.
 */
export function phraseShape(
  phrase: string,
  forms: readonly string[],
  signals: readonly string[],
): "noun" | "verb" | undefined {
  const list = words(phrase);
  const signal = list.findIndex((word) => signals.some((s) => word === s || word === adverbOf(s)));
  const head = forms.map((form) => positions(list, words(form))[0]).find((at) => at !== undefined);
  if (signal < 0 || head === undefined) return undefined;
  return signal < head ? "noun" : "verb";
}
