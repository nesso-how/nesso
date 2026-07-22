---
title: Review mode
description: Spaced-repetition review of your concepts with FSRS, how it queues cards and reschedules them from your self-ratings.
---

Press `R` (or open the **Review** pill in the top bar) to start a focused study session. Review surfaces concepts that are due, prompts you to recall what you know, and reschedules them based on how you self-rate.

Nesso uses [FSRS](https://github.com/open-spaced-repetition/ts-fsrs), a modern open-source successor to the SM-2 / Anki algorithm.

## What gets reviewed

Each concept node carries its own FSRS state: `stability`, `difficulty`, `due`, `lastReview`, `lastRating`, and friends. A node is **due** when `due <= now`. New, unrated concepts default to `due = 0`, which means they show up immediately the first time you open Review.

The session queue is built fresh every time you open the overlay: all due nodes, sorted by urgency, in random order within the same due bucket.

## Daily reminder

When a concept you have already studied becomes due, Nesso can show a reminder after you open its graph. The reminder appears at most once per local calendar day for each graph. New concepts do not trigger it, although they still join the normal queue when you choose **Start review**.

Closing the reminder suppresses it for that graph for the rest of the day. **Start review** opens the same unfiltered Review session as the top-bar pill.

## Flow

For each due concept, Review:

1. **Shows the concept title** and a short recall prompt. Try to remember its definition and typed relations before revealing.
2. **Waits for you to think**, then click **Reveal** (or press `Space`).
3. **Reveals** the concept's definition and typed relations.
4. **You rate** how it felt: `Again`, `Hard`, `Good`, `Easy`. Each button shows the **predicted next interval** under it (e.g. `5 min`, `2 hours`, `4 days`, `2 months`, localized to your language).

FSRS then updates `stability` and `difficulty`, schedules the next `due` date, and Review advances to the next card. Done with the queue, the overlay closes. You're caught up.

## Tuning FSRS

Under **Settings → Learning → Review**:

| Setting              | What it does                                                                                                          | Range       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Review reminder**  | Shows a daily reminder when concepts you have studied are due. This can be disabled independently of **Review mode**. | On/off      |
| **Target retention** | Probability of correctly recalling a concept at its next review. Higher means more frequent reviews.                  | 70% to 97%  |
| **Max interval**     | Longest interval FSRS can schedule, in days. Caps how far into the future a card can be pushed.                       | 1 to 36,500 |

The defaults (90% retention, 100-year cap) match the FSRS reference defaults. Lower the retention if you're comfortable forgetting more in exchange for fewer reviews. Raise the max interval if you want long-term cards to keep stretching out.

Review is on by default. The **Review mode** toggle at the top of **Settings → Learning** turns it off entirely: the **Review** pill and the `R` shortcut disappear, and the FSRS settings above hide while it is off. The **Review reminder** toggle remains available independently, but reminders only appear while **Review mode** is enabled.

## Tips

- Add a **definition** in the Inspector. It appears on reveal and gives you something concrete to check your recall against.
- Pair concepts with **at least one typed edge** before reviewing them. Relations are part of what you reveal and what makes the graph worth remembering.
- The session count in the top bar reflects the original queue size. Cards rated `Again` that come back later increase the count past 100%. That is expected.
