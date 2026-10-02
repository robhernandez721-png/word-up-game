# Word Up!

A pass-the-phone party game: read the clue out loud, everyone races to guess the word, and the host taps whoever got it first. First to the target score wins.

Open `index.html` in a browser to play. No install or internet connection needed.

## How it plays

- **Easy:** everyday stuff (umbrella, sneeze, penguin)
- **Medium:** modern life (deadline, spoiler, layover)
- **Hard:** big ideas everyone knows but rarely says (irony, loophole, nepotism)
- **Mix:** a bit of everything
- **Hint:** first tap shows the letter count, second tap shows the first letter
- **Reveal:** shows the answer plus any "also accept" answers
- **Take turns reading:** each word, a different player reads the clue and sits out guessing. Or pick **One host** if someone just wants to run the game.
- **Timer (optional):** 30, 45, or 60 seconds per word, with warning beeps for the last five seconds and an automatic reveal when time runs out
- **Scoring:** tap a player to give them the point; the answer shows automatically. **Undo** reverses a mis-tap.
- Words don't repeat until you've played the whole list, even across games on the same device
- Your group and settings are remembered, and a game in progress survives closing the page; you'll be offered **Resume** next time
- The screen stays awake during a game on phones that support it

## Adding or editing words

All words live in [`words.js`](words.js). Each entry looks like this:

```js
{ word: "loophole", pos: "noun", clue: "A gap in the rules that lets you get around them legally." },
{ word: "stalemate", pos: "noun", clue: "A situation where neither side can win or make a move.", alt: ["deadlock", "standoff"] },
```

**The rules for a good word**

1. **People actually know it.** Difficulty comes from the clue, not obscure vocabulary. If most adults wouldn't recognize the word, it doesn't belong at any level.
2. **The clue points to one answer.** Add fair alternatives to `alt` instead of making the clue vaguer.
3. **The clue doesn't give it away.** It can't use the word, a piece of it ("rain" for *rainbow*), or an `alt` answer.
4. **Read it aloud.** Clues are one sentence, 20 to 140 characters, and easy to say.

**Before you commit**, run:

```sh
node scripts/check-words.js        # required: duplicates, near-duplicates, clue leaks, length
python3 scripts/word_frequency.py  # optional: how common each word is (pip install wordfreq)
```

`check-words.js` also runs automatically on every push and pull request.

`word_frequency.py` scores each word on the Zipf scale using real modern English (subtitles, social media, news, web). Words below a level's floor are flagged for a human to decide on. Some well-known words score low because people rarely write them (*icicle*, *jaywalk*), and very new words may be missing entirely (*doomscrolling*).
