## 1. Project Overview
 
### What it is
Budget Buddy is a single-page, no-login personal budget tracker. The user logs money gained and spent each day. The app adds totals, balance, and weekly/monthly figures automatically, then offers simple spending tips.
 
### Core user flow
1. **Press Start** on the home view (no sign-up, no login).
2. **Set a monthly spending limit** and starting money.
3. **Log each day** (quick-add for today, or "+ Items" for multiple entries on any day).
4. **Read the results**: totals, budget-used bar, spending chart, category breakdown, and suggestions.
### Feature inventory (as observed live)
| Area | What it does |
| --- | --- |
| Home view | Hero message, three-point value list, example "month at a glance", feature cards, 3-step "How it works" |
| Quick add | Spent/Gained toggle, amount, category, note |
| Month setup | Month picker, starting money, spending limit, auto daily allowance, "use last month's remaining money" |
| Summary | Gained, Spent, Money left, Budget left |
| Budget used | Progress indicator against the limit |
| Suggestions | Mood-style prompt ("How does your money feel?") that reveals tips |
| Category breakdown | "Where your money went" |
| Daily log | Table: Day, Gained, Spent, Category, Note, Balance; filters for category and "Hide empty days" |
| Daily chart | Bars per day; orange bars exceed the daily allowance; hover/tap shows the amount |
| Recurring | Recurring income and bills, applied to the month on demand |
| Savings goals | Goal name, target amount, optional target date |
| Settings and backup | Currency, theme (Match my device / Light / Dark), log reminder, custom categories, JSON backup/restore, CSV download, clear month |
 
### The Why
- **No login, browser-only storage.** The footer states data is saved in the browser only. For a finals project, this removes server cost, privacy risk, and a failure point, and it makes the "Start" step instant. The trade-off (data does not sync across devices) is softened by the JSON export/restore feature.
- **One-page scope.** A budget tracker is a daily, repeated task. Keeping everything on one page means the user never loses their place between logging and seeing results.
- **Tips tied to real numbers.** Generic advice gets ignored. Suggestions based on the limit and the day of the month feel relevant, which is the product's main differentiator over a plain spreadsheet.
---
 
## 2. Architecture
 
### Structure
- **Static single-page app** deployed on GitHub Pages: HTML for structure, CSS for presentation, JavaScript for behavior.
- **Hash-based navigation.** The nav links point to `#home` and `#log`, so "views" are sections of one document toggled by the URL hash rather than separate pages.
- **Client-side state.** All calculations (totals, balance, daily allowance, budget used) run in the browser and re-render as the user types.
- **Persistence.** Browser storage for the log, settings, and goals, plus explicit **export/restore (.json)** and **CSV** download as the user-controlled backup path. **[confirm in source: storage key names, e.g. localStorage keys]**
### Suggested file map
```
/ (repo root)
├── index.html      # both views (#home, #log) and all dialogs
├── style.css       # tokens in :root, layout, components, dark theme
├── script.js       # state, calculations, rendering, storage, export
└── HANDOFF.md
```
**[confirm in source: actual filenames and whether CSS/JS are inline]**
 
### Data flow
```
user input -> update state -> recompute totals/allowance/tips
          -> re-render summary, table, chart, category breakdown
          -> save to browser storage
```
 
### The Why
- **Static hosting over a backend.** The app needs no accounts and no shared data, so a server would add cost and risk with no benefit. GitHub Pages is free, versioned through git, and cannot go "down" because of a database.
- **Hash routing over multiple HTML files.** Hash navigation keeps one document, one stylesheet, and one script, so state persists while switching views and there is no page reload flash.
- **Derived values are never stored by hand.** Balance, totals, and allowance are recomputed from the log entries. This prevents the classic bug where an edited entry leaves a stale total.
- **Export/restore as a first-class feature.** Browser-only storage can be wiped by clearing site data. A visible JSON backup gives users control and doubles as a test fixture for developers.
- **Dialog for multi-item entry.** The "Entries for day" panel keeps the main table compact (one row per day) while still allowing many entries per day.
---
 
## 3. Layout
 
### Page anatomy
1. **Header/nav:** brand mark ("₱ Budget Buddy"), links to Home and My log, theme indicator.
2. **Home view:** hero (headline, supporting sentence, Start button), benefit list, example summary card, three feature cards, three numbered steps.
3. **My log view**, top to bottom:
   - Quick add for today
   - Month setup and summary figures
   - Budget used bar
   - Suggestions
   - Category breakdown
   - Daily log table
   - Daily spending chart
   - Recurring income and bills
   - Savings goals
   - Settings and backup
4. **Day-entries dialog** (opens from "+ Items").
5. **Footer:** short note on browser-only storage.
### The Why
- **Order follows frequency of use.** The thing done every day (quick add) is first; the thing done once a month (settings, backup) is last. The user rarely scrolls to do the common task.
- **Result before detail.** Summary, budget bar, and suggestions come before the table and chart, answering "how am I doing?" before "what exactly happened?".
- **Home example card.** Showing "Gained 1500 / Spent 920 / Left 580" with a plain sentence ("31% of the budget used...") teaches the product in one glance, before the user commits to Start.
- **Three-step "How it works."** Three is short enough to read in seconds and ends on the payoff (reading tips), which pushes the user toward the log.
- **Single column with stacked cards.** The user is likely on a phone, logging a purchase right after making it. A vertical flow avoids horizontal scrolling and keeps the tap targets large. **[confirm in source: breakpoints]**
- **Table plus chart for the same data.** The table is precise (audit), the chart is fast (pattern). Different users, and the same user at different moments, need each.
- **Filters on the log ("Hide empty days").** A 31-row table is mostly empty early in the month; hiding blanks keeps it scannable.
---
 
## 4. Design Tokens
 
> Token **roles and names** below are the recommended contract. The exact **values** must be copied from your `:root` block. **[confirm in source]**
 
### Colour roles
| Token | Role | Where it appears |
| --- | --- | --- |
| `--color-bg` | Page background | Body |
| `--color-surface` | Card/panel background | Summary, forms, dialog |
| `--color-text` | Primary text | Body copy, table |
| `--color-text-muted` | Secondary text | Helper text, notes |
| `--color-primary` | Brand/action colour | Start button, links, active nav |
| `--color-gain` | Money in | "Gained" figures |
| `--color-spend` | Money out | "Spent" figures |
| `--color-warn` | Over budget / over allowance | Orange chart bars, limit warnings |
| `--color-border` | Dividers and field outlines | Inputs, table rows |
 
Every colour token has a **light** and a **dark** value, switched by the theme setting (Match my device / Light / Dark).
 
### Type, space, shape
| Token | Role |
| --- | --- |
| `--font-body` | One readable sans-serif stack with system fallbacks |
| `--text-sm / --text-base / --text-lg / --text-xl` | Modular type scale; headings step up from base |
| `--space-1 ... --space-6` | One spacing scale (e.g. 4/8/12/16/24/32 px) used for all padding and gaps |
| `--radius` | One corner radius for cards, inputs, buttons |
| `--shadow-card` | Single subtle elevation for cards and the dialog |
 
### The Why
- **Tokens instead of raw values.** Changing one variable updates the whole site. This is what makes the dark theme cheap: the same components read different token values, with no duplicated CSS.
- **Semantic names (`--color-spend`, not `--color-red`).** A name should say what a colour *means*. If "spent" later becomes a different hue, nothing else needs renaming.
- **Gain, spend, and warn as separate roles.** Money status is the core information of the app. Distinct roles let the interface signal "good / outflow / over limit" consistently across the summary, table, and chart.
- **Orange for over-allowance bars.** The chart note ("Orange bars went over your daily allowance") shows the app uses a warning hue that reads as caution without the alarm of pure red, which suits a friendly, non-judgmental budgeting tone. Orange must never be the *only* signal; see Accessibility.
- **A single spacing scale and a single radius.** Consistency is what makes the page look designed rather than assembled. It also lets a new contributor add a component without making new decisions.
- **System font stack.** Fast to load (no font download), familiar on every device, and good for number legibility, which matters in a money app.
---
 
## 5. Accessibility
 
### What the live page already supports
- **Viewport meta tag** (`width=device-width, initial-scale=1`) so the page scales properly and users can zoom.
- **Theme choice** (Match my device / Light / Dark) for light sensitivity and low-light use.
- **Plain-language copy and a no-account flow**, lowering the cognitive barrier.
- **Chart values on hover or tap**, with the same data also present in the daily log table.
- **Semantic structure**: headings per section, a real data table with column headers (Day, Gained, Spent, Category, Note, Balance), form fields with visible labels.
### Checklist to verify before submission **[confirm in source]**
| Check | Target |
| --- | --- |
| Text contrast | At least 4.5:1 for body text, 3:1 for large text and UI borders, in **both** light and dark themes |
| Keyboard | Every control (Start, toggles, add, filters, "+ Items", dialog Close) reachable and operable with Tab/Enter/Space; visible focus ring |
| Dialog | Focus moves into "Entries for day" on open, is trapped inside, returns to the trigger on Close, and Escape closes it |
| Labels | Every input has an associated `<label>` (not placeholder-only) |
| Chart | Has a text alternative (`aria-label` or summary); over-allowance state is conveyed by more than colour |
| Live updates | Totals and tips announce changes politely (`aria-live="polite"`) |
| Tap targets | At least 44x44 px on mobile |
| Motion | Respect `prefers-reduced-motion` |
| Reflow | Usable at 320 px width and 200% zoom without horizontal scrolling (the table may scroll inside its own container) |
| Language | `<html lang="en">` set |
 
### The Why
- **Contrast in both themes.** A dark theme is only an accessibility feature if its contrast is verified separately; flipping colours does not guarantee legibility.
- **Never colour alone.** About 1 in 12 men have some colour-vision deficiency. Orange bars versus normal bars must also differ by something else (a label, pattern, icon, or the tooltip text and table values), or the over-budget warning is invisible to those users.
- **Keyboard and focus management in the dialog.** The "+ Items" dialog is the highest-risk component: if focus is not managed, keyboard and screen-reader users get lost behind it.
- **Labels over placeholders.** Placeholders vanish while typing, which hurts memory and screen-reader clarity; this matters in a form where amount, category, and note are all required context.
- **Live regions for totals.** The product's promise is that totals "update by themselves." Without a live region, a screen-reader user hears nothing when that happens, so the key feature is silent for them.
- **Table plus chart.** The table gives every chart value in an accessible, sortable-by-eye format, so the chart can be a visual enhancement rather than the only path to the data.
- **Plain language.** "Money I started with" and "Daily allowance" are accessible to users with lower financial literacy, reading difficulty, or English as a second language, which is the real audience for a budgeting tool.
