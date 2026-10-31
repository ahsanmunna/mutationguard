# MutationGuard UI rules

Project: MutationGuard, a working Next.js 15 (App Router) + TypeScript + Tailwind v3 prototype for the LandTech Innovation Hackathon 2026. Bangla is the default language, English secondary. Only PRESENTATION changes. Behaviour must not change. The audience: judges using phones and laptops. Goal: simple, calm, trustworthy, like a land-records office tool, not a generic AI-looking template.

## Already done (do not redo)
tailwind.config.ts (new colour system: emerald = pine green, slate = warm paper/charcoal neutrals, amber = survey amber, rose = alert red, blue = ink), src/app/globals.css, src/components/Footer.tsx, src/components/Logo.tsx, src/components/Header.tsx (Phase 1), src/components/StatusBadge.tsx, the shared pieces from Phase 1 (look in src/components/ui/ and reuse them), and the home page src/app/page.tsx. Keep using the normal class names (bg-emerald-600, text-slate-500, border-slate-200, bg-rose-50 ...): they map to the new palette.

## Never touch
src/app/api/**, src/lib/** (including translations), src/middleware.ts, db/**, tests/**, .env*, package.json, package-lock.json, tailwind.config.ts, src/app/globals.css, Footer.tsx, Logo.tsx, src/app/page.tsx. No new npm packages. Keep every fetch call, handler, state variable, route, form rule, role check and text string. New text uses the existing pattern: language === 'bn' ? 'Bangla' : 'English'. Numbers keep using formatCount/formatNumber/formatDate. If a change needs a forbidden file, write it in HANDOFF notes in your report instead.

## Visual rules
1. Icons: lucide-react only (already installed). Import icons individually, size 16-18px, strokeWidth 1.75, aria-hidden, always with a text label when meaning matters. Use classic icon names (ArrowRight, ArrowLeft, Check, X, Search, Lock, Link2, LogIn, LogOut, FilePlus2, ClipboardList, ScrollText, FlaskConical, FileText, Landmark, RefreshCw, TriangleAlert, Inbox, Clock, Loader2). No emoji anywhere in .tsx files under src/.
2. Shape: panels rounded-lg, inputs and buttons rounded-md. No rounded-2xl or rounded-3xl. No shadow-lg/xl/md, no gradients, no backdrop-blur, no glow, no decorative blobs. Borders: 1px border-slate-200 (dark: border-slate-800).
3. Do not wrap every section in a card. Use plain sections separated by a 1px rule or spacing; use a panel only for forms, tables and record sheets.
4. Type: Noto Sans Bengali stays. Page title text-2xl sm:text-3xl font-bold; section title text-lg font-semibold; body text-[15px]; muted text-slate-500; nothing larger than text-3xl. IDs, hashes, rule IDs and technical values use font-mono text-xs; long hashes are truncated in the middle with the full value in a title attribute.
5. Colour meaning: pine (emerald-600) = primary buttons, active navigation, success. Rose = real conflicts and errors ONLY. Amber = highlights and demo markers, sparingly. Ink/blue = links and neutral info. Never use colour alone: every status has an icon AND text.
6. Buttons: min-h-[44px]; primary = bg-emerald-600 text-white hover:bg-emerald-700; secondary = white with border-slate-300; danger = bg-rose-600 text-white; disabled = opacity-50 cursor-not-allowed. Action buttons are always SOLID, never semi-transparent or faded. Loading buttons show a Loader2 spinner plus text. Only spinners and a subtle loading pulse may animate.
7. Layout: content max-w-6xl, px-4 sm:px-6, spacing space-y-6. Tables become stacked rows below 768px. No horizontal page scroll. Test at 360px, 768px and 1280px, light and dark, Bangla and English.
8. Users never see raw status codes (verified, under_review, approved, finalized, held, rejected...). Always render the translated label via StatusBadge.
9. Technical details (hashes, JSON, English technical sentences, tamper buttons) go inside collapsed <details> sections or a clearly labelled "Demo tools" panel. Show a one-line plain Bangla/English summary first.

## Process rules for every phase
- Read this file first. Make small, readable, commented changes the team can explain to judges.
- After the work run: npm run typecheck, npm run lint, npm run test, npm run build. All must pass. Fix failures; never weaken a test.
- Commit with the message given in the phase prompt, then STOP and report: files changed, what visually changed in plain words, real output of the four checks, anything you left undone. Wait for the user to say "continue".
