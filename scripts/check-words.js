#!/usr/bin/env node
// Validates words.js. Run: node scripts/check-words.js
//
// Fails on:
//   - missing/invalid fields
//   - duplicate words (within or across difficulties)
//   - clues that give away the answer: the word itself, an also-accept answer,
//     its stem ("boast" -> "boastful"), or a chunk of a compound ("rain" in "rainbow")
//   - clues that are too short or too long to read aloud comfortably

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const file = path.join(__dirname, "..", "words.js");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
const bank = sandbox.window.WORD_BANK;

const LEVELS = ["easy", "medium", "hard"];
const POS = new Set(["noun", "verb", "adjective", "adverb"]);
const MIN_CLUE = 20;
const MAX_CLUE = 140;
// Short words that legitimately show up inside answers and clues.
const IGNORE_CHUNKS = new Set(["that", "with", "your", "from", "this", "what", "when", "they", "them", "then", "were", "have", "like", "over", "into", "time", "make", "made", "some", "back", "less", "ever", "ever", "able", "more", "most", "just", "line", "ring", "ting"]);

const errors = [];
const warnings = [];
const seen = new Map();

const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const tokens = s => norm(s).split(/[^a-z]+/).filter(Boolean);

function stem(w) {
  return w.replace(/(ations?|ing|ers?|ed|ly|ness|ment|ful|less|ous|ism|ist|ity|ic|al|y|e|s)$/, "");
}

if (!bank || typeof bank !== "object") {
  console.error("words.js must define window.WORD_BANK");
  process.exit(1);
}

for (const level of LEVELS) {
  const list = bank[level];
  if (!Array.isArray(list)) { errors.push(`${level}: missing list`); continue; }

  list.forEach((entry, i) => {
    const where = `${level}[${i}] "${entry && entry.word}"`;
    if (!entry || typeof entry.word !== "string" || !entry.word.trim()) { errors.push(`${where}: missing word`); return; }
    if (!POS.has(entry.pos)) errors.push(`${where}: bad pos "${entry.pos}"`);
    if (typeof entry.clue !== "string") { errors.push(`${where}: missing clue`); return; }
    if (entry.alt !== undefined && !(Array.isArray(entry.alt) && entry.alt.every(a => typeof a === "string"))) {
      errors.push(`${where}: alt must be an array of strings`);
    }

    const word = norm(entry.word);
    if (entry.word !== entry.word.toLowerCase()) errors.push(`${where}: word should be lowercase`);

    if (seen.has(word)) errors.push(`${where}: duplicate of ${seen.get(word)}`);
    else seen.set(word, `${level}[${i}]`);

    if (entry.clue.length < MIN_CLUE) errors.push(`${where}: clue under ${MIN_CLUE} chars`);
    if (entry.clue.length > MAX_CLUE) errors.push(`${where}: clue over ${MAX_CLUE} chars (${entry.clue.length})`);

    // ── Leak checks ──
    const clue = norm(entry.clue);
    const clueTokens = tokens(entry.clue);
    const wordStem = stem(word.replace(/[^a-z]/g, ""));

    if (clue.includes(word)) errors.push(`${where}: clue contains the answer`);

    for (const a of entry.alt || []) {
      const alt = norm(a);
      if (alt.length > 2 && new RegExp(`\\b${alt.replace(/[^a-z ]/g, ".")}\\b`).test(clue)) {
        errors.push(`${where}: clue contains also-accept answer "${a}"`);
      }
    }

    for (const t of clueTokens) {
      if (wordStem.length >= 4 && t.startsWith(wordStem)) {
        errors.push(`${where}: clue word "${t}" shares the answer's stem "${wordStem}"`);
      } else if (t.length >= 4 && !IGNORE_CHUNKS.has(t) && word.includes(t)) {
        errors.push(`${where}: clue word "${t}" is part of the answer`);
      }
    }
  });
}

// Near-duplicates: one answer built on another ("procrastinate" / "procrastination").
// Pairs that only look related are allowlisted.
const ALLOW_PAIRS = new Set([
  "referee|referendum", "inflation|influencer", "heir|heirloom", "inflammation|inflation",
  "prom|promotion", "dorm|dormant", "entree|entrepreneur"
]);
const allWords = [...seen.keys()];
const reported = new Set();
for (const a of allWords) {
  const aStem = stem(a);
  if (aStem.length < 4) continue;
  for (const b of allWords) {
    const pair = [a, b].sort().join("|");
    if (a === b || !b.startsWith(aStem) || ALLOW_PAIRS.has(pair) || reported.has(pair)) continue;
    reported.add(pair);
    errors.push(`"${b}" (${seen.get(b)}) is too close to "${a}" (${seen.get(a)})`);
  }
}

const counts = LEVELS.map(l => `${l}: ${(bank[l] || []).length}`).join(", ");
for (const w of warnings) console.warn("warn:", w);
if (errors.length) {
  for (const e of errors) console.error("error:", e);
  console.error(`\n${errors.length} problem(s). (${counts})`);
  process.exit(1);
}
console.log(`words.js OK — ${counts}`);
