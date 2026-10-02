// Browser tests for Word Up!  Run: npm test
const { test, expect } = require("@playwright/test");

const NAMES = ["Ana", "Ben", "Cy"];

// Add players and pick options on the setup screen.
async function setup(page, { names = NAMES, reader = "turns", timer = 0, difficulty, target } = {}) {
  for (const name of names) {
    await page.fill("#playerInput", name);
    await page.press("#playerInput", "Enter");
  }
  await page.click(`[data-reader="${reader}"]`);
  await page.click(`[data-timer="${timer}"]`);
  if (difficulty) await page.click(`#diff-${difficulty}`);
  if (target) {
    await page.fill("#targetScore", String(target));
    await page.dispatchEvent("#targetScore", "change");
  }
}

const row = (page, name) => page.locator(".player-score-row", { hasText: name });
const scoreOf = (page, name) => row(page, name).locator(".score-num");
const readerName = page => page.locator("#readerBanner strong").textContent();
const rowNames = page => page.$$eval(".player-score-row .player-name-col", els => els.map(e => e.childNodes[0].textContent));

test.beforeEach(async ({ page }) => {
  page.on("dialog", d => d.accept());
});

test.describe("setup", () => {
  test("player names are shown as text, never as HTML", async ({ page }) => {
    await page.goto("/");
    const evil = `O'Brien <img src=x onerror=alert(1)>`;
    await setup(page, { names: [evil, "Ben"], reader: "host" });
    await expect(page.locator(".player-chip span").first()).toHaveText(evil.slice(0, 20));
    await expect(page.locator(".player-chip img")).toHaveCount(0);

    await page.click("text=Start Game");
    await row(page, "O'Brien").click();
    await expect(scoreOf(page, "O'Brien")).toHaveText("1");
  });

  test("duplicate names are rejected regardless of case", async ({ page }) => {
    await page.goto("/");
    await setup(page, { names: ["Sam", "sam", " SAM "] });
    await expect(page.locator(".player-chip")).toHaveCount(1);
  });

  test("needs two players to start", async ({ page }) => {
    await page.goto("/");
    await setup(page, { names: ["Solo"] });
    await page.click("text=Start Game");
    await expect(page.locator("#setupScreen")).toBeVisible();
  });

  test("group and settings are remembered", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host", timer: 45, difficulty: "hard", target: 7 });
    await page.reload();
    await expect(page.locator(".player-chip span")).toHaveText(NAMES);
    await expect(page.locator('[data-reader="host"]')).toHaveClass(/active/);
    await expect(page.locator('[data-timer="45"]')).toHaveClass(/active/);
    await expect(page.locator("#diff-hard")).toHaveClass(/active-hard/);
    await expect(page.locator("#targetScore")).toHaveValue("7");
  });
});

test.describe("words", () => {
  test("clue, hints, and reveal", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");

    await expect(page.locator("#definitionText")).not.toBeEmpty();
    const word = (await page.locator("#actualWord").textContent()).toLowerCase();
    const letters = word.replace(/[^a-z]/g, "").length;

    await page.click("#hintBtn");
    await expect(page.locator("#hintPattern")).toContainText(`(${letters})`);
    await page.click("#hintBtn");
    await expect(page.locator("#hintPattern")).toHaveText(new RegExp("^" + word[0].toUpperCase()));
    await expect(page.locator("#hintBtn")).toBeDisabled();

    await expect(page.locator("#answerBox")).toBeHidden();
    await page.click("#wordReveal");
    await expect(page.locator("#answerBox")).toBeVisible();
    await expect(page.locator("#wordReveal")).toHaveAttribute("aria-expanded", "true");

    await page.click("text=Next Word");
    await expect(page.locator("#answerBox")).toBeHidden();
    await expect(page.locator("#hintPattern")).toBeEmpty();
  });

  test("words don't repeat within a pool", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host", difficulty: "easy" });
    await page.click("text=Start Game");
    const pool = await page.evaluate(() => WORD_BANK.easy.length);
    const seen = new Set();
    for (let i = 0; i < pool; i++) {
      seen.add(await page.locator("#actualWord").textContent());
      await page.click("text=Next Word");
    }
    expect(seen.size).toBe(pool);
  });

  test("every difficulty, including Mix, serves words", async ({ page }) => {
    await page.goto("/");
    for (const level of ["easy", "medium", "hard", "mix"]) {
      await page.click(`#diff-${level}`);
      if (level === "easy") await setup(page, { reader: "host" });
      await page.click("text=Start Game");
      await expect(page.locator("#roundBadge")).toContainText(level === "mix" ? "Mix" : level, { ignoreCase: true });
      await expect(page.locator("#definitionText")).not.toBeEmpty();
      await page.click("text=End Game");
      await page.click("text=Play Again");
    }
  });
});

test.describe("rounds", () => {
  test("readers rotate and can't score their own word", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "turns" });
    await page.click("text=Start Game");

    const first = await readerName(page);
    expect(NAMES).toContain(first);
    await expect(page.locator(".player-score-row.is-reader")).toContainText(first);
    await row(page, first).click({ force: true }); // a tap on the disabled row does nothing
    await expect(scoreOf(page, first)).toHaveText("0");

    await page.click("text=Next Word");
    expect(await readerName(page)).toBe(NAMES[(NAMES.indexOf(first) + 1) % NAMES.length]);
  });

  test("host mode: no reader, everyone can score", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");
    await expect(page.locator("#readerBanner")).toBeHidden();
    await expect(page.locator(".is-reader")).toHaveCount(0);
    for (const name of NAMES) {
      await row(page, name).click();
      await expect(scoreOf(page, name)).toHaveText("1");
    }
  });

  test("timer counts down, beeps out, and reveals at zero", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await setup(page, { reader: "host", timer: 30 });
    await page.click("text=Start Game");

    await expect(page.locator("#timerPill")).toHaveText("0:30");
    await page.clock.runFor(10_000);
    await expect(page.locator("#timerPill")).toHaveText("0:20");
    await page.clock.runFor(16_000);
    await expect(page.locator("#timerPill")).toHaveClass(/urgent/);
    await page.clock.runFor(5_000);
    await expect(page.locator("#timerPill")).toHaveText("Time's up");
    await expect(page.locator("#answerBox")).toBeVisible();

    await page.click("text=Next Word");
    await expect(page.locator("#timerPill")).toHaveText("0:30");
  });

  test("scoring freezes the timer and reveals the answer", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await setup(page, { reader: "host", timer: 30 });
    await page.click("text=Start Game");
    await page.clock.runFor(5_000);
    await row(page, "Ben").click();
    await expect(page.locator("#answerBox")).toBeVisible();
    await expect(page.locator("#timerPill")).toHaveClass(/done/);
    const frozen = await page.locator("#timerPill").textContent();
    await page.clock.runFor(10_000);
    await expect(page.locator("#timerPill")).toHaveText(frozen);
  });
});

test.describe("scoring", () => {
  test("undo, minus, stable row order, and leader crown", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");
    await expect(page.locator("#undoBtn")).toBeDisabled();

    await row(page, "Cy").click();
    await row(page, "Cy").click();
    expect(await rowNames(page)).toEqual(NAMES);
    await expect(row(page, "Cy")).toContainText("👑");

    await page.click("#undoBtn");
    await expect(scoreOf(page, "Cy")).toHaveText("1");
    await row(page, "Cy").locator(".minus-btn").click();
    await expect(scoreOf(page, "Cy")).toHaveText("0");
    await page.click("#undoBtn");
    await expect(scoreOf(page, "Cy")).toHaveText("1");
  });

  test("first to the target wins", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host", target: 2 });
    await page.click("text=Start Game");
    await row(page, "Ben").click();
    await expect(page.locator("#progressBar")).toHaveAttribute("style", /width: 50%/);
    await row(page, "Ben").click();
    await expect(page.locator("#winnerName")).toHaveText("Ben wins!");

    // a fresh game starts from zero
    await page.click("text=Play Again");
    await page.click("text=Start Game");
    await expect(page.locator("#progressBar")).toHaveAttribute("style", /width: 0%/);
    await expect(scoreOf(page, "Ben")).toHaveText("0");
  });

  test("ending early with a tie says so", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");
    await row(page, "Ana").click();
    await row(page, "Cy").click();
    await page.click("text=End Game");
    await expect(page.locator("#winnerName")).toHaveText("It's a tie!");
    await expect(page.locator("#winSub")).toHaveText("Ana & Cy finished level with 1 point.");
  });
});

test.describe("save and resume", () => {
  test("a game in progress survives a reload", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "turns" });
    await page.click("text=Start Game");
    const reader = await readerName(page);
    const scorer = NAMES.find(n => n !== reader);
    await row(page, scorer).click();
    const word = await page.locator("#actualWord").textContent();

    await page.reload();
    await expect(page.locator("#resumeCard")).toBeVisible();
    await expect(page.locator("#resumeDetail")).toContainText(`${scorer} 1`);
    await page.click("text=Resume");

    await expect(page.locator("#actualWord")).toHaveText(word);
    expect(await readerName(page)).toBe(reader);
    await expect(scoreOf(page, scorer)).toHaveText("1");
    await expect(page.locator("#undoBtn")).toBeEnabled();
  });

  test("the save is cleared when the game ends", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");
    await page.click("text=End Game");
    await page.reload();
    await expect(page.locator("#resumeCard")).toBeHidden();
  });

  test("Start over discards the save", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");
    await page.reload();
    await page.click("text=Start over");
    await expect(page.locator("#resumeCard")).toBeHidden();
    await page.reload();
    await expect(page.locator("#resumeCard")).toBeHidden();
  });
});

test.describe("app", () => {
  test("works offline after the first visit", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // let the service worker take control and cache
    await context.setOffline(true);
    await page.reload();
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");
    await expect(page.locator("#definitionText")).not.toBeEmpty();
  });

  test("score rows work from the keyboard", async ({ page }) => {
    await page.goto("/");
    await setup(page, { reader: "host" });
    await page.click("text=Start Game");
    await row(page, "Ana").focus();
    await page.keyboard.press("Enter");
    await expect(scoreOf(page, "Ana")).toHaveText("1");
    await expect(row(page, "Ana")).toHaveAttribute("aria-label", "Give Ana a point (1 now)");
  });

  test("fits a small phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await setup(page, { timer: 30 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.click("text=Start Game");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const heights = await page.$$eval(".action-row .btn", els => els.filter(e => e.offsetParent).map(e => e.offsetHeight));
    expect(new Set(heights).size).toBe(1); // no button wrapped onto two lines
  });

  test("no errors in the console during a full game", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await setup(page, { reader: "turns", target: 2, difficulty: "mix" });
    await page.click("text=Start Game");
    for (let i = 0; i < 6 && await page.locator("#gameScreen").isVisible(); i++) {
      const reader = await readerName(page);
      await page.click("#hintBtn");
      await row(page, NAMES.find(n => n !== reader && n !== "Cy") || "Cy").click();
      if (await page.locator("#gameScreen").isVisible()) await page.click("text=Next Word");
    }
    await expect(page.locator("#winScreen")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
