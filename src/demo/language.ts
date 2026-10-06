/**
 * Phase 1 prototype content — NOT the language dataset.
 * A small, hand-written sample used to make the prototype screens realistic.
 * Replaced by curated, validated content in Phase 3.
 */
import type { DemoLanguageItem } from "./types";

export const DEMO_LANGUAGE: DemoLanguageItem[] = [
  {
    slug: "significant",
    term: "significant",
    category: "synonym",
    partOfSpeech: "adjective",
    ipa: "/sɪɡˈnɪfɪkənt/",
    level: "B2",
    register: ["academic", "neutral"],
    strength: 2,
    skills: ["writing", "speaking"],
    status: "learning",
    meaning: "Important enough to have a noticeable effect or influence.",
    pattern: "a significant + increase / impact / role",
    collocations: [
      { phrase: "a significant increase", note: "a rise in numbers, sales or use" },
      { phrase: "a significant impact", note: "on people, the economy or the environment" },
      { phrase: "a significant difference", note: "between two groups, places or figures" },
      { phrase: "play a significant role", note: "in + noun / -ing" },
      { phrase: "a significant proportion", note: "of + plural noun" },
    ],
    examples: [
      {
        text: "There has been a significant increase in the number of people using public transport.",
        highlight: "significant",
        skill: "writing",
      },
      {
        text: "Technology has played a significant role in reshaping education.",
        highlight: "significant",
        skill: "writing",
      },
      {
        text: "Moving to a new city made a significant difference to how I study.",
        highlight: "significant",
        skill: "speaking",
      },
    ],
    bestWhen:
      "The idea has a measurable or noticeable effect — numbers, changes, results or influence. Ideal for Task 1 data and Task 2 cause and effect.",
    avoidWhen:
      "For personal or emotional importance. “My family is very significant to me” sounds clinical — say “important to me”.",
    usage: {
      writing: {
        text: "The new policy had a significant impact on air quality.",
        highlight: "significant impact",
        skill: "writing",
      },
      speaking: {
        text: "Honestly, the new rules have made a big difference to the air in my city.",
        highlight: "made a big difference",
        skill: "speaking",
      },
      note: "In conversation, “a big difference” or “a real impact” sound more natural than “significant”.",
    },
    mistakes: [
      {
        wrong: "a significant amount of people",
        right: "a significant number of people",
        why: "Use number with countable nouns (people, cars) and amount with uncountable ones (money, time).",
      },
      {
        wrong: "This decision is very significance.",
        right: "This decision is very significant.",
        why: "Significant is the adjective; significance is the noun — “a decision of great significance”.",
      },
    ],
    related: [
      { relation: "Stronger", term: "crucial", slug: "crucial" },
      { relation: "Similar", term: "considerable", slug: "considerable" },
      { relation: "Similar", term: "substantial" },
      { relation: "Opposite", term: "insignificant" },
      { relation: "Opposite", term: "minor" },
    ],
  },
  {
    slug: "crucial",
    term: "crucial",
    category: "synonym",
    partOfSpeech: "adjective",
    ipa: "/ˈkruːʃl/",
    level: "B2",
    register: ["academic", "neutral"],
    strength: 3,
    skills: ["writing", "speaking"],
    status: "new",
    meaning: "Extremely important, because something else depends on it.",
    pattern: "crucial to / for + noun · it is crucial that …",
    collocations: [
      { phrase: "a crucial role", note: "play a crucial role in + noun / -ing" },
      { phrase: "a crucial factor", note: "in a decision or result" },
      { phrase: "crucial to success", note: "also: crucial for success" },
    ],
    examples: [
      {
        text: "Public investment is crucial to reducing traffic congestion.",
        highlight: "crucial",
        skill: "writing",
      },
      {
        text: "Getting enough sleep is crucial before an exam.",
        highlight: "crucial",
        skill: "speaking",
      },
    ],
    bestWhen:
      "An outcome depends on it — use it for necessary conditions, not simply for large effects.",
    avoidWhen:
      "For size or amount. “A crucial increase” sounds odd — use “significant” or “considerable”.",
    mistakes: [
      {
        wrong: "very crucial",
        right: "absolutely crucial",
        why: "Crucial already means extremely important. Use “absolutely” if you need extra emphasis.",
      },
    ],
    related: [
      { relation: "Weaker", term: "significant", slug: "significant" },
      { relation: "Similar", term: "vital" },
      { relation: "Similar", term: "essential" },
    ],
  },
  {
    slug: "fundamental",
    term: "fundamental",
    category: "synonym",
    partOfSpeech: "adjective",
    ipa: "/ˌfʌndəˈmentl/",
    level: "B2",
    register: ["academic"],
    strength: 3,
    skills: ["writing"],
    meaning: "Forming the basic, underlying part of something.",
    pattern: "fundamental to + noun · a fundamental + change / right",
    collocations: [
      { phrase: "a fundamental right", note: "human rights, freedoms" },
      { phrase: "a fundamental change", note: "deep change to how something works" },
      { phrase: "fundamental to", note: "fundamental to a healthy society" },
    ],
    examples: [
      {
        text: "Access to clean water is a fundamental human right.",
        highlight: "fundamental",
        skill: "writing",
      },
    ],
    bestWhen: "The idea is basic or foundational — principles, rights, causes or deep change.",
    avoidWhen:
      "For a large effect that isn't foundational. “A fundamental increase in sales” — use “significant”.",
    related: [
      { relation: "More natural", term: "basic" },
      { relation: "Similar", term: "essential" },
    ],
  },
  {
    slug: "considerable",
    term: "considerable",
    category: "synonym",
    partOfSpeech: "adjective",
    ipa: "/kənˈsɪdərəbl/",
    level: "B2",
    register: ["academic", "formal"],
    strength: 2,
    skills: ["writing"],
    meaning: "Large in size, amount or degree.",
    pattern: "considerable + amount / number / time / effort",
    collocations: [
      { phrase: "a considerable amount", note: "of money, time or effort" },
      { phrase: "considerable effort", note: "make a considerable effort" },
      { phrase: "to a considerable extent", note: "formal hedging" },
    ],
    examples: [
      {
        text: "The project required a considerable amount of public money.",
        highlight: "considerable",
        skill: "writing",
      },
    ],
    bestWhen: "You mean size or amount rather than importance.",
    avoidWhen: "To say something matters. “A considerable reason” — use “an important reason”.",
    related: [
      { relation: "Similar", term: "significant", slug: "significant" },
      { relation: "Similar", term: "substantial" },
      { relation: "More natural", term: "a lot of" },
    ],
  },
  {
    slug: "responsible-for",
    term: "responsible for",
    category: "preposition",
    partOfSpeech: "adjective + preposition",
    level: "B1",
    register: ["neutral"],
    skills: ["writing", "speaking"],
    status: "due",
    meaning: "Having the duty to deal with something, or being the cause of it.",
    pattern: "be responsible for + noun / -ing",
    examples: [
      {
        text: "Local governments are responsible for maintaining public parks.",
        highlight: "responsible for",
        skill: "writing",
      },
      {
        text: "I'm responsible for organising the team's schedule.",
        highlight: "responsible for",
        skill: "speaking",
      },
    ],
    bestWhen: "Saying who has a duty, or what caused a result.",
    mistakes: [
      {
        wrong: "responsible of",
        right: "responsible for",
        why: "With the task, thing or cause, the preposition is always for.",
      },
    ],
    related: [
      { relation: "Related", term: "responsible to (the person you report to)" },
      { relation: "Related", term: "take responsibility for" },
    ],
  },
  {
    slug: "depend-on",
    term: "depend on",
    category: "preposition",
    partOfSpeech: "verb + preposition",
    level: "B1",
    register: ["neutral"],
    skills: ["writing", "speaking"],
    status: "due",
    meaning: "To need someone or something, or to be decided by something.",
    pattern: "depend on + noun / -ing · it depends on whether …",
    examples: [
      {
        text: "Many rural communities depend on public transport.",
        highlight: "depend on",
        skill: "writing",
      },
      { text: "It depends on the weather, really.", highlight: "depends on", skill: "speaking" },
    ],
    bestWhen: "Talking about reliance, or about the condition that decides a result.",
    mistakes: [
      {
        wrong: "depend of",
        right: "depend on",
        why: "Depend always takes on (or the more formal upon).",
      },
    ],
    related: [
      { relation: "More formal", term: "depend upon" },
      { relation: "Similar", term: "rely on" },
    ],
  },
  {
    slug: "play-a-crucial-role",
    term: "play a crucial role",
    category: "collocation",
    partOfSpeech: "verb phrase",
    level: "B2",
    register: ["academic", "neutral"],
    strength: 3,
    skills: ["writing", "speaking"],
    status: "learning",
    meaning: "To be extremely important in making something happen.",
    pattern: "play a crucial / key / significant role in + noun / -ing",
    examples: [
      {
        text: "Teachers play a crucial role in shaping students' attitudes.",
        highlight: "play a crucial role",
        skill: "writing",
      },
      {
        text: "Parents play a huge role in that.",
        highlight: "play a huge role",
        skill: "speaking",
      },
    ],
    bestWhen: "Describing the part a person or factor has in an outcome — very common in Task 2.",
    mistakes: [
      {
        wrong: "make a crucial role",
        right: "play a crucial role",
        why: "Role collocates with play, not make.",
      },
      {
        wrong: "play a crucial role on",
        right: "play a crucial role in",
        why: "The preposition after role is in.",
      },
    ],
    related: [
      { relation: "Similar", term: "play a key role" },
      { relation: "Related", term: "crucial", slug: "crucial" },
    ],
  },
  {
    slug: "on-the-other-hand",
    term: "On the other hand,",
    category: "linker",
    partOfSpeech: "linking phrase",
    level: "B1",
    register: ["neutral"],
    skills: ["writing", "speaking"],
    status: "mastered",
    meaning: "Introduces the other side of an argument.",
    pattern: "(On the one hand, …) On the other hand, + clause",
    examples: [
      {
        text: "Cars are convenient. On the other hand, they contribute to air pollution.",
        highlight: "On the other hand,",
        skill: "writing",
      },
      {
        text: "On the other hand, it's really expensive.",
        highlight: "On the other hand,",
        skill: "speaking",
      },
    ],
    bestWhen: "Weighing two sides of the same issue — advantages against disadvantages.",
    avoidWhen: "For a simple difference between two things — use “in contrast” or “whereas”.",
    mistakes: [
      { wrong: "In the other hand", right: "On the other hand", why: "The fixed phrase uses on." },
    ],
    related: [
      { relation: "Similar", term: "in contrast", slug: "in-contrast" },
      { relation: "Similar", term: "however", slug: "however" },
    ],
  },
  {
    slug: "however",
    term: "However,",
    category: "linker",
    partOfSpeech: "linking adverb",
    level: "B1",
    register: ["neutral", "academic"],
    skills: ["writing", "speaking"],
    meaning: "Introduces a contrast with what has just been said.",
    pattern: "Sentence. However, + clause",
    examples: [
      {
        text: "Public transport is cheap. However, it is often unreliable.",
        highlight: "However,",
        skill: "writing",
      },
    ],
    bestWhen: "A general-purpose contrast between two sentences.",
    mistakes: [
      {
        wrong: "It is cheap, however it is unreliable.",
        right: "It is cheap. However, it is unreliable.",
        why: "However can't join two clauses with a comma. Use a full stop or semicolon before it and a comma after.",
      },
    ],
    related: [
      { relation: "More formal", term: "nevertheless", slug: "nevertheless" },
      { relation: "More natural", term: "but" },
    ],
  },
  {
    slug: "nevertheless",
    term: "Nevertheless,",
    category: "linker",
    partOfSpeech: "linking adverb",
    level: "C1",
    register: ["formal", "academic"],
    skills: ["writing"],
    meaning: "Despite what has just been said.",
    pattern: "Sentence. Nevertheless, + clause",
    examples: [
      {
        text: "The plan is expensive. Nevertheless, it is likely to save money in the long term.",
        highlight: "Nevertheless,",
        skill: "writing",
      },
    ],
    bestWhen: "Conceding a point, then continuing your argument anyway.",
    avoidWhen: "For a simple difference between two things — use “however” or “in contrast”.",
    related: [
      { relation: "Similar", term: "however", slug: "however" },
      { relation: "More natural", term: "even so" },
    ],
  },
  {
    slug: "in-contrast",
    term: "In contrast,",
    category: "linker",
    partOfSpeech: "linking phrase",
    level: "B2",
    register: ["academic"],
    skills: ["writing"],
    meaning: "Introduces a clear difference between two things being compared.",
    pattern: "In contrast, + clause · In contrast to + noun, …",
    examples: [
      {
        text: "Urban populations grew rapidly. In contrast, rural areas saw a steady decline.",
        highlight: "In contrast,",
        skill: "writing",
      },
    ],
    bestWhen: "Comparing two groups, places or figures — ideal for Task 1.",
    avoidWhen: "To concede a point in an argument — use “nevertheless” or “however”.",
    mistakes: [
      {
        wrong: "In contrast of",
        right: "In contrast to",
        why: "Before a noun, use in contrast to.",
      },
    ],
    related: [
      { relation: "Similar", term: "whereas", slug: "whereas" },
      { relation: "Similar", term: "on the other hand", slug: "on-the-other-hand" },
    ],
  },
  {
    slug: "whereas",
    term: "whereas",
    category: "linker",
    partOfSpeech: "conjunction",
    level: "B2",
    register: ["academic", "neutral"],
    skills: ["writing", "speaking"],
    meaning: "Joins two clauses to show a direct contrast between them.",
    pattern: "clause, whereas + clause",
    examples: [
      {
        text: "Younger people tend to cycle, whereas older people are more likely to drive.",
        highlight: "whereas",
        skill: "writing",
      },
    ],
    bestWhen: "Contrasting two facts inside one sentence.",
    mistakes: [
      {
        wrong: "City rents rose. Whereas, village rents fell.",
        right: "City rents rose, whereas village rents fell.",
        why: "Whereas joins two clauses; it isn't a sentence adverb like however.",
      },
    ],
    related: [
      { relation: "Similar", term: "while" },
      { relation: "Similar", term: "in contrast", slug: "in-contrast" },
    ],
  },
  {
    slug: "for-instance",
    term: "for instance",
    category: "expression",
    partOfSpeech: "phrase",
    level: "B1",
    register: ["neutral"],
    skills: ["writing", "speaking"],
    meaning: "Introduces an example.",
    pattern: "For instance, + clause · …, for instance, …",
    examples: [
      {
        text: "Some cities have invested heavily in cycling. Copenhagen, for instance, has built hundreds of kilometres of bike lanes.",
        highlight: "for instance",
        skill: "writing",
      },
    ],
    bestWhen: "Adding an example as a clause or a full sentence.",
    related: [
      { relation: "Similar", term: "for example" },
      { relation: "Related", term: "such as", slug: "such-as" },
    ],
  },
  {
    slug: "such-as",
    term: "such as",
    category: "expression",
    partOfSpeech: "phrase",
    level: "B1",
    register: ["neutral"],
    skills: ["writing", "speaking"],
    meaning: "Introduces examples inside a sentence, before nouns.",
    pattern: "noun, such as + noun(s)",
    examples: [
      {
        text: "Renewable sources such as wind and solar power are becoming cheaper.",
        highlight: "such as",
        skill: "writing",
      },
    ],
    bestWhen: "Listing examples within the same sentence.",
    mistakes: [
      {
        wrong: "Such as, cars cause pollution.",
        right: "For example, cars cause pollution.",
        why: "Such as can't start a sentence on its own — use for example or for instance.",
      },
    ],
    related: [{ relation: "Related", term: "for instance", slug: "for-instance" }],
  },
  {
    slug: "a-case-in-point",
    term: "a case in point",
    category: "expression",
    partOfSpeech: "noun phrase",
    level: "C1",
    register: ["formal", "academic"],
    skills: ["writing"],
    meaning: "A single example that clearly proves the point just made.",
    pattern: "X is a case in point.",
    examples: [
      {
        text: "Some cities have cut traffic dramatically; Copenhagen is a case in point.",
        highlight: "a case in point",
        skill: "writing",
      },
    ],
    bestWhen: "One strong, specific example that supports your claim.",
    avoidWhen: "Listing several examples — use “such as” or “for instance”.",
  },
  {
    slug: "furthermore",
    term: "Furthermore,",
    category: "linker",
    partOfSpeech: "linking adverb",
    level: "B2",
    register: ["formal", "academic"],
    skills: ["writing"],
    meaning: "Adds a further point that supports the previous one.",
    pattern: "Sentence. Furthermore, + clause",
    examples: [
      {
        text: "Cycling lanes improve safety. Furthermore, they reduce congestion in city centres.",
        highlight: "Furthermore,",
        skill: "writing",
      },
    ],
    bestWhen: "Adding a supporting point in formal writing.",
    avoidWhen: "In speaking it can sound stiff — use “on top of that” or “what's more”.",
    usage: {
      writing: {
        text: "Furthermore, this approach reduces congestion.",
        highlight: "Furthermore,",
        skill: "writing",
      },
      speaking: {
        text: "On top of that, it's just easier for people to get around.",
        highlight: "On top of that,",
        skill: "speaking",
      },
      note: "Furthermore marks a formal addition. In conversation, “on top of that” or “what's more” sound natural.",
    },
    related: [
      { relation: "More natural", term: "on top of that", slug: "on-top-of-that" },
      { relation: "More natural", term: "what's more", slug: "whats-more" },
      { relation: "Similar", term: "moreover" },
    ],
  },
  {
    slug: "on-top-of-that",
    term: "On top of that,",
    category: "linker",
    partOfSpeech: "linking phrase",
    level: "B2",
    register: ["neutral", "informal"],
    skills: ["speaking"],
    meaning: "Adds another point, often one that makes the situation better or worse.",
    pattern: "On top of that, + clause",
    examples: [
      {
        text: "The flat was tiny. On top of that, it was really noisy.",
        highlight: "On top of that,",
        skill: "speaking",
      },
    ],
    bestWhen: "Adding a point naturally in conversation — useful in Speaking Part 3.",
    avoidWhen: "In formal Task 2 essays — use “furthermore” or “in addition”.",
    related: [{ relation: "More formal", term: "furthermore", slug: "furthermore" }],
  },
  {
    slug: "whats-more",
    term: "what's more",
    category: "linker",
    partOfSpeech: "linking phrase",
    level: "B2",
    register: ["neutral", "informal"],
    skills: ["speaking"],
    meaning: "Adds an extra, often more important, point.",
    pattern: "…, and what's more, + clause",
    examples: [
      {
        text: "It's cheap, and what's more, it's really convenient.",
        highlight: "what's more",
        skill: "speaking",
      },
    ],
    bestWhen: "Adding a stronger point in speaking or informal writing.",
    related: [{ relation: "More formal", term: "furthermore", slug: "furthermore" }],
  },
  {
    slug: "allocate",
    term: "allocate",
    category: "vocabulary",
    partOfSpeech: "verb",
    ipa: "/ˈæləkeɪt/",
    level: "C1",
    register: ["academic", "formal"],
    skills: ["writing"],
    meaning: "To officially give money, time or resources for a particular purpose.",
    pattern: "allocate + money / funds / resources + to + noun",
    collocations: [
      { phrase: "allocate funds", note: "to a project or service" },
      { phrase: "allocate resources", note: "to an area of need" },
    ],
    examples: [
      {
        text: "Governments should allocate more money to public transport.",
        highlight: "allocate",
        skill: "writing",
      },
    ],
    bestWhen: "Formal decisions about how money or resources are divided.",
    related: [
      { relation: "Similar", term: "invest", slug: "invest" },
      { relation: "More natural", term: "spend" },
    ],
  },
  {
    slug: "invest",
    term: "invest",
    category: "vocabulary",
    partOfSpeech: "verb",
    level: "B1",
    register: ["neutral"],
    skills: ["writing", "speaking"],
    meaning: "To put money, time or effort into something to gain a future benefit.",
    pattern: "invest + money + in + noun",
    examples: [
      {
        text: "Governments should invest more money in public transport.",
        highlight: "invest",
        skill: "writing",
      },
    ],
    bestWhen: "Emphasising future benefit or long-term development.",
    related: [{ relation: "More formal", term: "allocate", slug: "allocate" }],
  },
  {
    slug: "devote",
    term: "devote",
    category: "vocabulary",
    partOfSpeech: "verb",
    level: "B2",
    register: ["neutral", "formal"],
    skills: ["writing"],
    meaning: "To give time, effort, attention or resources to something.",
    pattern: "devote + time / effort / resources + to + noun / -ing",
    examples: [
      {
        text: "Schools should devote more time to practical skills.",
        highlight: "devote",
        skill: "writing",
      },
    ],
    bestWhen: "With time, effort, attention or resources.",
    avoidWhen:
      "With money on its own it sounds less natural — “devote more resources to” works better.",
    related: [{ relation: "Similar", term: "allocate", slug: "allocate" }],
  },
  {
    slug: "rise-sharply",
    term: "rise sharply",
    category: "collocation",
    partOfSpeech: "verb + adverb",
    level: "B2",
    register: ["academic"],
    strength: 3,
    skills: ["writing"],
    meaning: "To increase quickly and by a large amount.",
    pattern: "rise / increase + sharply / significantly · a sharp rise in + noun",
    collocations: [
      { phrase: "rise sharply", note: "fast and large" },
      { phrase: "increase significantly", note: "large and noticeable" },
      { phrase: "grow steadily", note: "slow but continuous" },
    ],
    examples: [
      {
        text: "The number of cyclists rose sharply between 2010 and 2020.",
        highlight: "rose sharply",
        skill: "writing",
      },
    ],
    bestWhen: "Describing a fast, large change in Task 1 data.",
    mistakes: [
      {
        wrong: "rose up sharply",
        right: "rose sharply",
        why: "Rise already means go up, so drop “up”.",
      },
    ],
    related: [
      { relation: "Weaker", term: "rise steadily" },
      { relation: "Related", term: "significant", slug: "significant" },
    ],
  },
];

export function getLanguageItem(slug: string) {
  return DEMO_LANGUAGE.find((item) => item.slug === slug);
}

export function requireLanguageItem(slug: string) {
  const item = getLanguageItem(slug);
  if (!item) throw new Error(`Unknown demo language item: ${slug}`);
  return item;
}
