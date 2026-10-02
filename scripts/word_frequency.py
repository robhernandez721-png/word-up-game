#!/usr/bin/env python3
"""Report how common each word in words.js is in real, modern English.

Uses the `wordfreq` library (pip install wordfreq), which blends subtitles,
social media, news, Wikipedia, and web text. Scores are on the Zipf scale:
  6+  everyday ("the", "phone")      4-5  common ("ladder", "podcast")
  3   known but less frequent         <2.5 rare for most people

Each difficulty has a floor. Anything under it is flagged so a human can
decide whether people would actually know the word.

Run: python3 scripts/word_frequency.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from wordfreq import zipf_frequency

FLOORS = {"easy": 3.0, "medium": 2.6, "hard": 2.4}

root = Path(__file__).resolve().parent.parent
bank = json.loads(subprocess.check_output(
    ["node", "-e",
     "const vm=require('vm'),fs=require('fs');const s={window:{}};"
     f"vm.runInNewContext(fs.readFileSync({json.dumps(str(root / 'words.js'))},'utf8'),s);"
     "process.stdout.write(JSON.stringify(s.window.WORD_BANK))"]))


def score(word):
    # Hyphenated/compound answers: score the full word, falling back to its parts.
    whole = zipf_frequency(word, "en")
    parts = [p for p in re.split(r"[-\s]", word) if p]
    if whole == 0 and len(parts) > 1:
        return min(zipf_frequency(p, "en") for p in parts)
    return whole


flagged = 0
for level, entries in bank.items():
    scored = sorted((score(e["word"]), e["word"]) for e in entries)
    vals = [s for s, _ in scored]
    median = vals[len(vals) // 2]
    low = [(s, w) for s, w in scored if s < FLOORS[level]]
    flagged += len(low)
    print(f"{level:6}  {len(entries):3} words  median {median:.2f}  floor {FLOORS[level]}  below floor: {len(low)}")
    for s, w in low:
        print(f"          {s:.2f}  {w}")

sys.exit(1 if "--strict" in sys.argv and flagged else 0)
