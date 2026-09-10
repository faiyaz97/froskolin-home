# Froskolin design system

## Status and source of truth

This document is the source of truth for visual language, canonical UI components, responsive behavior, and interaction states. It is descriptive, not a redesign brief. Backend and domain rules belong in `docs/ARCHITECTURE.md`; operational instructions belong in the repository-root `AGENTS.md`.

Canonical reference pages:

1. Home: `src/app/h/[householdId]/page.tsx`
2. Add Expense: `src/app/h/[householdId]/add/expense/page.tsx`
3. Add Utility Bill: `src/app/h/[householdId]/add/bill/page.tsx`
4. User Settings: `src/app/h/[householdId]/account/page.tsx`
5. Group Settings: `src/app/h/[householdId]/settings/page.tsx`
6. Calendar: `src/app/h/[householdId]/calendar/page.tsx`
7. Expense and Utility Bill Details: `src/app/h/[householdId]/expenses/[expenseId]/page.tsx`
8. Payment Add and Details: `src/app/h/[householdId]/add/settlement/page.tsx` and `src/app/h/[householdId]/settlements/[settlementId]/page.tsx`
9. Activity List and Detail: `src/app/h/[householdId]/activity/page.tsx` and `src/app/h/[householdId]/activity/[eventId]/page.tsx`
10. Group and Landlord Balances: `src/app/h/[householdId]/balances/page.tsx` and `src/app/h/[householdId]/landlord/page.tsx`

Repeated patterns across these pages are canonical. The public authentication flow is also canonical for sign-in, create-group, and join-group screens. Error/loading and recurring-edit pages are not design-system references yet. Their styling may be retained for behavior, but should not be copied into new work without comparison to the canonical pages above.

## Design principles

- Friendly and compact: pastel color cues, rounded geometry, cat imagery, and dense information without visual heaviness.
- Border-light: major cards and option groups rely on background contrast, spacing, separators, and soft shadows. Borders remain appropriate for form controls, popovers, dialogs, dates, and selected states.
- One obvious action: primary actions are concise, icon-supported, and generally mint/teal; secondary actions are quieter.
- Progressive disclosure: payer, split, dates, utility type, attachments, profile data, and group access open focused dialogs or popovers instead of expanding the page.
- Mobile-first: mobile subpages use the shell header and bottom-safe tools; desktop adds framing and wider spacing without changing the core interaction model.
- Feedback near the problem: required fields become red and receive a short local message after an attempted submit. Cross-field mismatches sit directly after the related fields.

## Foundations

### Color tokens

Tokens live in `src/app/globals.css`; use them instead of new literal colors.

| Role            | Token                                      | Value                 | Typical use                      |
| --------------- | ------------------------------------------ | --------------------- | -------------------------------- |
| Primary text    | `--ink`                                    | `#172033`             | Headings, high-emphasis copy     |
| Secondary text  | `--ink-soft`                               | `#334155`             | Labels and controls              |
| Muted text      | `--muted`                                  | `#64748b`             | Supporting metadata              |
| Paper           | `--paper`                                  | `#ffffff`             | Cards and dialogs                |
| Canvas          | `--canvas`                                 | `#f8fafc`             | App background and soft hover    |
| Divider         | `--line`                                   | `#e2e8f0`             | Structural separators            |
| Soft divider    | `--soft-line`                              | `#f1f5f9`             | Rows and subtle boundaries       |
| Row hover       | `--row-hover`                              | `#f0fdfa`             | Shared interactive-row feedback  |
| Brand           | `--brand`                                  | `#0f766e`             | Primary action/accent            |
| Brand strong    | `--brand-strong`                           | `#115e59`             | Strong brand text and hover      |
| Brand soft      | `--brand-soft`                             | `#ccfbf1`             | Active and hover backgrounds     |
| Brand icon tint | `--brand-icon-soft` / `--brand-icon-hover` | `#ecf4f3` / `#dbeceb` | Teal-derived icon state/hover    |
| Violet          | `--violet` / `--violet-soft`               | `#7c3aed` / `#ede9fe` | AI, secondary cues, recurrence   |
| Peach           | `--peach` / `--peach-soft`                 | `#ea580c` / `#ffedd5` | Bills and landlord actions       |
| Sky             | `--sky` / `--sky-soft`                     | `#0369a1` / `#e0f2fe` | Informational/group accents      |
| Positive        | `--positive` / `--positive-soft`           | `#15803d` / `#dcfce7` | Credit/success                   |
| Negative        | `--negative` / `--negative-soft`           | `#dc2626` / `#fee2e2` | Debt, destructive action, errors |
| Warning         | `--warning` / `--warning-soft`             | `#a16207` / `#fef3c7` | Review-needed feedback           |
| Pastel mint     | `--pastel-mint` / `--pastel-mint-line`     | `#e3f5ef` / `#bce5d8` | Primary pastel surface           |
| Pastel lavender | `--pastel-lavender` / line                 | `#f0edff` / `#d9d1fa` | AI/secondary pastel surface      |
| Pastel peach    | `--pastel-peach` / line                    | `#fff0e7` / `#f7d4c0` | Warm action surface              |
| Pastel sky      | `--pastel-sky` / line                      | `#eaf5ff` / `#c9e3f7` | Headers/informational surface    |
| Home header     | `--home-header-blue`                       | `#dceeff`             | Desktop Home summary surface     |

Avatar background colors are data, not general UI tokens; they live in `src/lib/avatar.ts` and drive the matching User Settings header glow.

### Typography

- Family: Inter with platform sans-serif fallbacks, defined on `body`.
- Page/display headings: `font-black` (900), tight line height, negative tracking around `-0.04em`; responsive sizes are typically 24–40px.
- Form primary title: 20px, `font-black`, about `-0.025em` tracking.
- Form primary amount: 35px (`2.2rem`), `font-black`, about `-0.045em`, tabular numerals.
- Standard control/body copy: 14–15px, usually semibold or bold.
- Section labels/eyebrows: 10–12px, black weight, uppercase, tracking `0.12–0.16em`.
- Supporting text: 10–12px or 14px depending context, muted color.
- Monetary values and numeric codes use `tabular-nums`; group codes/PINs may add positive tracking.

Avoid long explanatory paragraphs on canonical settings and form pages. Prefer concise labels and contextual dialog content.

### Spacing and layout

- Minimum supported viewport width: 320px.
- App content maximum: 980px in `AppShell`.
- Forms: `max-w-2xl`; Group Settings: `max-w-3xl`; User Settings: `max-w-2xl`.
- Mobile outer padding for non-home routes: 12px (`px-3 pt-3`). Home intentionally reaches the viewport edges at the top.
- Desktop outer padding: 24px at `md`, 32px at `lg`; vertical page padding is 28–32px.
- Common component gaps: 4/6/8px for compact controls, 12px within forms, 16px within sections, 20–24px between page sections.
- Interactive rows are at least 64px tall; standard controls/buttons are at least 44px; icon tools are 48–56px targets.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` in sticky/fixed mobile chrome. The shared app shell owns desktop bottom-navigation clearance for every signed-in route; pages must not add their own desktop bottom margins for it. On mobile, only primary routes reserve bottom-navigation space. Non-primary routes use normal page padding, with local clearance only when they render a fixed mobile tool strip.
- Reserve a stable root scrollbar gutter so centered layouts do not shift when dialogs lock background scrolling.

### Radius and elevation

- Global surface radius: `--radius-surface: 1.25rem` (20px).
- Compact controls/popover items: 10–14px.
- Inputs and icon tiles: 12px.
- Form/card groups: 16–22px.
- Dialogs and feature headers: 24–28px.
- Pills and floating primary actions: full radius.
- Default shadows: `--shadow-sm` for cards, `--shadow` for elevated surfaces, `--shadow-float` for floating actions. Avoid combining visible borders with strong shadows on ordinary cards.

## Responsive shell

Canonical shell: `src/components/household/app-shell.tsx`.

- `<768px`: non-primary subpages receive a sticky compact header with Back, centered title, and an optional context-specific submit action. Their desktop `PageHeader` is hidden by `.mobile-subpage .page-header`.
- Primary mobile pages (Home, Calendar, Activity, Account) show the fixed four-item bottom navigation.
- `>=768px`: a sticky white brand header appears; page content gains desktop padding. Forms expose their desktop Cancel/Save buttons.
- `>=1024px`: the primary navigation becomes a centered floating rounded bar near the bottom.
- Any form controlled by the shell Save icon must have `data-mobile-submit` and a semantic submit button.
- Canonical navigation component: `src/components/household/app-navigation.tsx`.

Special page behavior:

- Home’s summary morph is mobile-only and scroll-driven; desktop stays expanded. Canonical component: `src/components/household/home-summary-motion.tsx` plus the `home-summary-*` rules in `globals.css`.
- User Settings owns a sticky mobile profile header and a static rounded desktop header.
- Group Settings header scrolls with page content; it must not be sticky.

Reduced-motion users receive near-zero transitions through the global `prefers-reduced-motion` rule.

### Public authentication shell

Canonical components: `src/components/public/auth-shell.tsx` and `src/components/public/auth-form.tsx`.

- Sign in, Create group, and Join group share one compact card centered vertically and horizontally on the canvas.
- Keep the page background plain. Do not add decorative gradients, blurred color blobs, illustrations, marketing copy, or secondary panels around the form.
- Center the Froskolin mark and app name above the form at every viewport size.
- Use one three-option segmented control for changing authentication mode. The active option uses the standard white selected surface; inactive options remain muted with a simple text hover.
- Keep fields in one flat stack. Do not divide credentials into nested cards or add explanatory descriptions.
- User-facing copy uses `group` and `member`: Group name, Group code, Group PIN, Your name, and Personal PIN. Compatibility identifiers such as `householdName` and `houseCode` remain internal.
- Creating a group does not expose currency or locale controls. Infer the supported currency from the device locale, fall back to EUR, and allow later changes in Group Settings. Use the device timezone without asking for it.
- A remembered sign-in may replace the code and name inputs with one compact neutral identity row. `Use another` returns to the full sign-in fields.
- The card must fit narrow screens without horizontal overflow and may scroll vertically on unusually short viewports.

## Components and patterns

### Buttons and links

Canonical primitive: `src/components/ui/button.tsx` (`Button`, `ButtonLink`).

- Base: minimum 44px, 14px radius, horizontal padding 16px, 14px black-weight label, optional leading icon.
- `primary`: solid teal, white text, restrained teal shadow, and a darker teal hover.
- `secondary`: white bordered utility action. Use sparingly on canonical pages.
- `quiet`: soft neutral surface and dark text, with a slightly stronger grey hover. Cancel is neutral—not violet or destructive.
- `accent`: solid violet.
- `pastel`, `pastelAccent`, and `pastelWarm` retain their names for compatibility, but standard in-page actions render as solid teal, violet, and orange controls with darker same-hue hover feedback. A colored button must never hover to mint.
- Canonical form submit buttons use `pastel`, a full pill radius, white text, and a restrained teal shadow.
- The three fixed Home actions deliberately pass `appearance="floating"` to preserve their lighter pastel surfaces. They use equal 48px heights and stepped widths from the smallest top action to the largest bottom action. Hover uses slight darkening and a stronger same-hue shadow without moving or resizing the control. Do not use the floating appearance for ordinary form or page buttons.
- Keep visible action labels concise without losing context. Forms whose page title already names the object use `Add`, `Save`, or `Record`; context-free shortcuts retain the object, such as `Add expense`, `Add bill`, and `Record payment`. Keep destructive and irreversible labels explicit.
- The mobile subpage submit control is an icon-only shell action with a descriptive accessible name, not a duplicate fixed text button.
- Canonical icon-only styling is `iconActionClass` from `src/components/ui/icon-action.ts`. Icon controls have a transparent resting surface, a semantic icon color, a circular same-family hover tint, and no resting border or shadow. Destructive icons are red; standard edit/save actions are teal and use the teal-derived `--brand-icon-*` fills rather than the mint surface palette; document/note actions may use violet.
- Icon-only buttons need a minimum 40–44px hit area and an `aria-label`; compact inline edit controls may use a 28px target when attached directly to a heading.
- A control that represents present content, such as a saved note, attachment, bill document, or selected date, keeps a very light circular tint at rest. Its hover tint must be visibly stronger than its persistent content tint. The icon itself may fill to reinforce the content-present state.
- The Home header settings control is a deliberate visibility exception: it keeps a translucent white circular surface over the sky header and becomes solid white on hover.
- `CurrencyAction` is a deliberate form-control exception: keep its persistent light teal surface and 12px rounded-square shape so the currency symbol remains visually attached to the amount input.
- Hover changes the surface softly; active state moves down 1px; disabled state reduces opacity and blocks interaction. Semantic display icons and record-type tiles are not icon controls and may retain their pastel tile backgrounds.

### Inputs and textareas

Canonical primitives: `Field`, `Input`, `Textarea`, and exported control classes in `src/components/ui/field.tsx`.

- Standard input: 44px tall, 12px radius, white surface, subtle control border/shadow, 15px semibold text.
- Hover strengthens the border; focus uses brand border plus a soft 2px ring; disabled uses `--control-disabled`.
- `Field` owns the visible label and one short hint or error. Errors are 11px red text immediately below the control.
- `Textarea` starts at 96px and may resize vertically. Transaction notes use it inside the focused note dialog rather than occupying permanent form space.
- Main expense/bill title and amount are intentional exceptions: large borderless inputs on a 2px mint underline. They share the `expense-primary-input` class and turn red after submit when invalid.

The duplicated primary title/amount markup in `ExpenseForm` and `BillConfirmation` is canonical visually but is not yet a shared component. See unresolved decisions.

### Money inputs

Canonical primitive: `src/components/ui/money-input.tsx` (`MoneyInput`).

- Currency symbol/code is inside the left side of the field; the value is right-aligned with tabular numerals.
- Use for standard amount breakdowns and exact split rows.
- Do not use it for the oversized primary total, which follows the underlined primary-input pattern.

### Selects and inline value controls

Canonical form pattern: `InlineValue` and `ChoiceRow` from `src/components/expenses/expense-sharing-controls.tsx`, composed with `Dialog`.

- Payer, split method, participants, utility type, and service period are readable sentence fragments with bold teal underlined values and a small chevron.
- Tapping an inline value opens a focused dialog; edits are staged and committed on Done.
- Required/invalid inline values use the negative soft background, negative text, and a red underline.
- Dialog choices use `ChoiceRow`: a full-width 48px row, subtle hover, mint selected state, and radio/check semantics.
- Unavailable member choices remain visible but disabled with reduced opacity; use this when a choice is invalid because that member is already selected in a mutually exclusive role.
- Member choices include `MemberAvatar` rather than initials-only circles.

`src/components/ui/select-input.tsx` is a capable full control/listbox primitive, but it is not used by the five completed reference pages. Do not treat it as the default visual pattern until a canonical page adopts it.

### Checkboxes, radio choices, and switches

- Multi-select and radio-style dialog choices use `ChoiceRow`, with accessible `aria-checked` state and a visual check/radio indicator.
- Native checkbox visuals from older/unfinished pages are not canonical references.
- Settings toggles are entire 64px rows with `role="switch"`, `aria-checked`, a pastel icon tile, and a teal 44×24 track with a white 16px thumb.
- Compact view toggles may sit beside a section title. Pair a short current-state label with a 36×20 track and 16px thumb, keep the whole label-and-track target clickable, and expose `role="switch"` plus `aria-checked`.
- The Group Settings switch is currently local to `settings-panel.tsx`; `SwitchField` in `ui/field.tsx` is a second implementation. Consolidation is unresolved—reuse the completed Group Settings appearance, but do not refactor solely for consistency without a separate task.

### Dialogs

Canonical primitive: `src/components/ui/dialog.tsx` (`Dialog`).

- Native modal dialog with focus containment, Escape behavior, backdrop dismissal when allowed, and body scroll lock.
- Width: `min(22rem, viewport - 24px)`; maximum height leaves 16px top and bottom; 24px radius; white surface; subdued navy backdrop.
- Edit/selection dialogs use a sticky three-column header: Back, centered title, Done check.
- Informational dialogs without Done use title plus Close.
- Enter submits from a focused text input when Done is available and enabled.
- Keep dialog bodies concise; use standard `Field` controls or `ChoiceRow` lists.
- Sensitive actions use `ConfirmationButton` from `src/components/ui/confirmation-button.tsx`; never use browser `window.confirm`. Confirm void, remove, delete, archive, credential reset, and similar balance- or access-changing actions before running them.
- Confirmation copy states the direct consequence in one short sentence. Use neutral `Cancel` and an explicit destructive verb such as `Void`, `Remove`, or `Archive`; keep the dialog open and nondismissible while the action is pending.

### Upload and attachment controls

- Expense attachment: `src/components/expenses/expense-attachment-action.tsx`.
- Bill upload: `src/components/bills/bill-upload.tsx`.
- Display the supported file types and 4 MiB limit in the empty-state helper copy.
- Empty controls open the file chooser. Attached controls open a compact popover containing View, Replace, and Remove.
- Popovers use `controlPopoverClass` from `ui/field.tsx`, 14px radius, white background, subtle border/shadow, and 40px menu rows.
- The Add and Edit version of an entity must share the same attachment component and interaction.

### Transaction notes

Canonical feature control: `src/components/expenses/transaction-note-action.tsx` (`TransactionNoteAction`).

- Expense, utility-bill, and payment add/edit forms use the same message-and-text icon action and focused dialog for optional notes.
- Match the date and attachment tools: a 56px circular action target with no nested tile. A non-empty note uses the lighter persistent lavender state and a filled icon so its presence is visible without exposing its contents; hover uses the stronger lavender tint.
- Keep notes to 500 characters, trim them on confirmation, and hide empty notes on read-only pages.
- On read-only transaction pages, place notes inside the main detail card after the people/share rows as compact inline copy in the form “Notes: …”. Do not create a separate notes card.

### Date-range calendars

Canonical feature component: `src/components/calendar/away-calendar.tsx` (`AwayCalendar`).

- Keep the calendar focused on one member. The selected member appears as an avatar-and-name pill above the calendar; only a group owner can open its `ChoiceRow` dialog to switch members.
- Month and year labels are direct controls. They open compact month and year grids, matching the date selector used by expense forms.
- Calendar cells are wide, inset canvas tiles with consistent white gutters on every side. The active range is one uniform mint sequence with clearly rounded first and last days and square middle days; do not darken the endpoints. A start-only selection must still have an obvious mint fill and outline. Saved ranges use a light pastel tint derived from the selected member's avatar color with the same rounded-end/square-middle shape; the period-list dot uses the exact avatar color. Never expose other members' saved dates as dots or markers.
- After a complete range is selected, show a compact summary row directly below the grid with the formatted dates and day count on one line, plus a right-aligned `Add period` action.
- Save additions and edits at the point of action. Removing a saved period uses the shared sensitive-action confirmation dialog before persisting.
- The section below the calendar lists only the selected member's periods that intersect the displayed month. Clip the displayed dates and day count to that month while editing or removing the underlying complete period, and place the day count immediately after its period.
- Keep calendar cards borderless with 22px radii and `--shadow-sm`, and keep empty copy to one short line.

### Cards, grouped rows, and list surfaces

- Canonical settings/list card: borderless `bg-white/85`, 22px radius, `--shadow-sm`, `overflow-hidden`.
- Rows are at least 64px and separated by inset 1px `--soft-line` dividers (`mx-4`).
- Leading icons sit in 40px pastel tiles with 12px radius. The label owns the flexible center; optional value/switch/chevron sits at the end.
- Hover/focus uses the shared soft-mint `--row-hover` background so feedback stays visible against both white cards and the canvas. Do not use the page canvas itself as a grouped-row hover color. Icon tiles may scale very slightly; chevrons may translate 2px. Do not recolor chevrons per row.
- Home balance cards use mint/peach semantic surfaces and collapse into a borderless divided strip during the mobile scroll morph.
- `src/components/ui/surface.tsx` is useful for semantic pastel surfaces, but its default visible border is not the default for completed-page cards. Override deliberately or use the grouped-card pattern.

### Expense and utility-bill details

Canonical route: `src/app/h/[householdId]/expenses/[expenseId]/page.tsx`.

- Expense and utility-bill records share one responsive detail route while using purpose-built breakdowns for their different data.
- Use a `max-w-2xl` column and a borderless 24px white transaction hero. The hero starts with the canonical icon, title and date, with the total aligned at the far right. Do not repeat the record or utility type as an eyebrow beside the icon; the icon already provides that cue.
- Both record types continue below the hero divider with a compact payer summary and connected avatar share rows. Connector elbows run directly into each child avatar without a terminal dot. The payer row ends with participant count; ordinary expenses also show the split method. Every known member uses `MemberAvatar`, with the share total right aligned. Bill rows add one compact line for days at home and the fixed-plus-usage share breakdown.
- Active recurring expense occurrences show the rule's authoritative next due date directly below the occurrence date with a compact violet recurrence cue. Hide the cue when the rule is paused, archived, or has reached its end date.
- The edit tool on a recurring occurrence opens the shared `ExpenseForm` in recurring-rule mode, so its calendar includes the Repeat frequency and end-date controls. Ordinary occurrence editing remains a separate domain operation and must not masquerade as schedule editing.
- Utility totals show concise Fixed and Usage values directly beneath the total at the right of the hero. Do not restore a separate allocation strip or explanatory allocation paragraphs.
- Use compact document/attachment, void, and edit icon tools below the card. Only render the left document tool when a file exists; ordinary expenses use a paperclip and utility bills use the bill-document icon. Keep authorized view routes.
- Present non-empty notes inside the main detail card after the share rows as compact inline copy in the form “Notes: …”.
- Keep edit as the positive pastel action, away dates as a quiet utility action for bills, and void as the clearly destructive action. Voided records remain readable but cannot be edited or voided again.
- The shared route sets the mobile shell title from the loaded record: `Expense` or `Utility bill`. Desktop shows the same specific record type through `PageHeader`.

### Payment add, view, and edit

Canonical form: `src/components/expenses/settlement-form.tsx` (`SettlementForm`).

- Add and edit use the same form component with initial state. The add flow selects the authenticated member as payer and the member they owe most as receiver, based on the existing per-currency ledger suggestions; when there is no debt suggestion, select any other active member.
- Present payer and receiver as compact avatar-and-name actions with a single directional arrow between them. Tint each action from that member's avatar background. Do not repeat “Paid by” and “Paid to” as visible labels.
- Each member action opens a `Dialog` of `ChoiceRow` items. Disable the person selected on the opposite side so a member cannot pay themselves.
- Use the same oversized underlined amount entry and `CurrencyAction` as expense and bill forms.
- Payment date defaults to the device's current local date and uses `ExpenseDateAction` without recurrence. Notes use the shared `TransactionNoteAction`; its filled lavender state indicates saved note content.
- Place date and note actions in `ExpenseTools` directly after the form content. Align them right on mobile; on desktop, use a single normal-flow action row with icon tools aligned left and Cancel plus Record/Save aligned right. Do not fix this row to the viewport, position it relative to the floating navigation, or stretch short forms to the viewport height.
- Opening a saved payment shows a read-only detail card, never the edit form. Match the transaction-detail composition: payment icon, visible formatted date, amount at the far right, then a divider and an avatar-colored payer-to-receiver row.
- Show non-empty notes inside the main payment card, directly beneath the payer-to-receiver row, as compact inline copy in the form “Notes: …”. Date and note icon tools belong only to the form; do not use them to hide information on the view page.
- Use compact void and edit icon actions below the view card. The edit action opens the dedicated edit route, which reuses `SettlementForm` with initial values and returns to the read-only detail after saving or cancelling.

### Activity list and detail

Canonical list: `src/components/activity/audit-list.tsx`; canonical presentation helpers: `src/lib/activity/presentation.ts`.

- Use one borderless 22px grouped card with soft row dividers. On mobile the list reaches the viewport edges like Home while the title keeps normal page padding; restore the contained card alignment from the desktop breakpoint. Each row shows the actor avatar, a small pastel entity badge, a concise action headline, actor name, timestamp, and an amount only when relevant.
- Activity is progressive: show the latest 10 records initially and reveal 10 more through the shared, centered `Load more` text action. Never fetch the complete audit history by default.
- Detail pages use the standard `max-w-2xl` transaction-card composition. Lead with the entity icon, human-readable action, timestamp, and actor identity.
- Show only a whitelist of meaningful fields. Updated records display only values that actually changed, with a compact before → after treatment. Created records show concise recorded details.
- Resolve member and user references to display names. Never expose UUIDs, raw snapshots, internal normalized fields, or JSON blobs in the interface.
- Use `ActivityTypeIcon` from `src/components/activity/activity-type-icon.tsx` for consistent entity colors and icons across list and detail views. Utility-bill activity must resolve the saved utility type and delegate to the canonical `UtilityTypeIcon`; use its gas, electricity, water, internet, or other-bill icon and pastel tone instead of the generic expense receipt.

### Group and landlord balances

- Both balance routes use a centered `max-w-2xl` column, the standard desktop `PageHeader`, short section labels, and borderless 22px grouped cards with soft full-width row dividers.
- The first Group Balances section is “Members”; do not add a currency label beside its title because each formatted amount already communicates currency. Each member row shows the avatar, name, and absolute balance, followed by smaller counterpart rows that explain the balance. Reuse the utility-detail breakdown structure: connect child rows beneath the parent avatar on the left with a clean elbow that meets the avatar directly and has no terminal dot, keep each counterpart avatar and name together, and align every amount at the right edge. Breakdown amounts repeat the parent total's positive-green or negative-red meaning at lower opacity.
- Place the compact `Simplified`/`Actual` switch at the right edge of the Members heading. Simplified is the default and shows the minimum-payment projection; Actual preserves the remaining original payer-to-participant relationships. Switching modes must update the connected member breakdowns and Settle up rows together.
- Settlement suggestions use avatar → avatar rows, member names, and one right-aligned amount. When the authenticated member is the payer, place a compact text-only mint `Settle up` action immediately before the amount and prefill the existing payment form with that exact payer, recipient, currency, and amount. Do not show a generic page-level settlement action.
- Landlord balances lead with one compact white Outstanding summary row: peach icon tile, short label, and the total aligned right. Outstanding rows show the canonical expense or utility-type icon, title, date, amount, then a small text-only mint `Mark paid` action. Do not add redundant “left” or paid-versus-total copy when only full payment is supported.
- Payment history shows at most the five most recently paid bills. Reuse the expense or utility-type icon rather than a completion tick, show the payment date and paid amount, and retain the icon-only reopen action with an explicit accessible label. Empty states are short borderless cards or one line of muted copy; do not restore dashed panels or explanatory paragraphs.

### Tables

No completed reference page defines a canonical data-table design. Use responsive grouped rows for member/share/transaction data today. If a true table becomes necessary, treat its density, mobile transformation, headers, sorting, and empty states as an explicit design decision rather than copying an unfinished page.

### Avatars and imagery

- Canonical avatar: `src/components/household/member-avatar.tsx`; avatar data: `src/lib/avatar.ts`; assets: `public/assets/avatars/*`.
- Use the selected avatar’s own background color. User Settings echoes that color as a restrained blurred glow inside the header only.
- Member rows and participant choices use the avatar image, generally 36–40px with no extra border/shadow.
- Home mascot components/assets are intentional brand elements: `PeekingFroskolin`, `BottomMascotReveal`, and `public/assets/froskolin-*.png`.

### Navigation, headers, and actions

- Desktop page title primitive: `PageHeader` in `src/components/ui/page.tsx`.
- Mobile subpage title/back/save: `AppShell`; do not render a competing sticky header.
- User and Group Settings use feature headers with a sky→mint gradient, 28px lower/outer radius, compact uppercase eyebrow, bold name, and a minimal pencil edit affordance.
- Group credentials are selectable plain text. Only the dedicated pencil button opens the Group Access dialog; the surrounding credential surface is never clickable.
- Home uses a sky header and its own responsive summary system rather than the generic `PageHeader`. On desktop, use the stronger `--home-header-blue` surface with the balance cards grouped inside one inset white rounded panel; mobile retains the edge-to-edge scroll/morph composition.
- Home transaction history uses Activity’s grouped-list shell: a borderless 22px white card, clipped outer corners, rectangular middle rows, and soft dividers. Preserve Home’s existing row content and month labels outside each card.
- Home transaction history is progressive: render the latest 10 combined expense/payment rows, then reveal batches of 10 with the shared `LoadMoreAction`. On Home and Activity, place this centered text-only action outside the grouped card and label it “Load more,” which works for pointer and touch input.
- Expense/Utility type switch: `src/components/expenses/expense-type-nav.tsx`; show only in add mode, not edit mode.
- Home floating actions use stacked pastel pill `ButtonLink`s and remain above navigation/content.

### Status, validation, and empty states

- Shared status primitive: `StatusNote` in `src/components/ui/page.tsx` for page/form-level success, warning, information, or server errors.
- Do not show a large summary list for ordinary missing fields. On submit, highlight each required control and show one short local explanation.
- Cross-field feedback (split total, bill fee/usage total) belongs immediately below the related controls and may use a compact negative-soft surface.
- Live feedback is appropriate when values must reconcile mathematically; required-empty feedback waits for submit.
- Split dialog feedback is right-aligned at the bottom of the summary/rows: “Shares must total …”. Do not add redundant “all accounted for” success sections.
- `EmptyState` in `ui/page.tsx` is shared, but the Home empty ledger card is the canonical tone: concise label, one short line, icon tile, no dashed border. The shared primitive’s dashed style is therefore not yet canonical.

## Interaction states

- Hover: subtle surface/color change, optional small icon scale or chevron translation. Avoid full-row saturated red, orange, or purple fills.
- Focus-visible: global 3px teal outline; complex controls may replace it with a 2px tokenized ring. Focus must remain visible.
- Active/pressed: button depression or selected pastel surface; selected state must also be exposed through ARIA.
- Disabled: blocked cursor, reduced opacity, and no hover animation. Do not rely on disabled submit buttons as the only validation explanation when a submit attempt can provide clearer feedback.
- Pending: disable the affected form/group and update action copy (“Saving…”, “Filling…”).
- Error: negative border/underline/text, `aria-invalid`, and `role="alert"` for newly surfaced blocking feedback.
- Menus: dismiss on outside pointer; maintain a high enough z-index to clear sticky tools.
- Motion: short color/transform transitions only. Honor global reduced-motion settings.

## Canonical component index

| Primitive/pattern             | Canonical path                                                      | Status                                                              |
| ----------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| App shell/mobile header       | `src/components/household/app-shell.tsx`                            | Canonical                                                           |
| Primary navigation            | `src/components/household/app-navigation.tsx`                       | Canonical                                                           |
| Public authentication shell   | `src/components/public/auth-shell.tsx`                              | Canonical centered public-page frame                                |
| Public authentication form    | `src/components/public/auth-form.tsx`                               | Canonical sign-in/create/join composition                           |
| Buttons/links                 | `src/components/ui/button.tsx`                                      | Canonical; form actions add pill overrides                          |
| Icon-only actions             | `src/components/ui/icon-action.ts`                                  | Canonical semantic tones, circular hover, and content-present state |
| Standard field/input/textarea | `src/components/ui/field.tsx`                                       | Canonical                                                           |
| Money input                   | `src/components/ui/money-input.tsx`                                 | Canonical                                                           |
| Dialog                        | `src/components/ui/dialog.tsx`                                      | Canonical                                                           |
| Sensitive-action confirmation | `src/components/ui/confirmation-button.tsx`                         | Canonical for void/remove/delete/archive and credential reset       |
| Page/status helpers           | `src/components/ui/page.tsx`                                        | `PageHeader`/`StatusNote` canonical; `EmptyState` visual unresolved |
| Inline selections/choice rows | `src/components/expenses/expense-sharing-controls.tsx`              | Canonical across expense and bill forms                             |
| Date dialog/tool              | `src/components/expenses/expense-date-action.tsx`                   | Canonical for expense date/recurrence                               |
| Transaction note tool         | `src/components/expenses/transaction-note-action.tsx`               | Canonical across expense, bill, and payment forms                   |
| Away date-range calendar      | `src/components/calendar/away-calendar.tsx`                         | Canonical for member range selection                                |
| Expense/bill detail view      | `src/app/h/[householdId]/expenses/[expenseId]/page.tsx`             | Canonical shared detail composition                                 |
| Payment form                  | `src/components/expenses/settlement-form.tsx`                       | Canonical add/edit payment composition                              |
| Activity entity icon          | `src/components/activity/activity-type-icon.tsx`                    | Canonical across activity list and detail                           |
| Activity list                 | `src/components/activity/audit-list.tsx`                            | Canonical grouped audit summary                                     |
| Progressive load action       | `src/components/ui/load-more-action.tsx`                            | Canonical text-only action for Home and Activity                    |
| Service period inputs         | `src/components/bills/bill-meta-controls.tsx` + `ui/date-input.tsx` | Canonical for bills                                                 |
| Expense attachment            | `src/components/expenses/expense-attachment-action.tsx`             | Canonical                                                           |
| Bill document upload          | `src/components/bills/bill-upload.tsx`                              | Canonical                                                           |
| Member avatar                 | `src/components/household/member-avatar.tsx`                        | Canonical                                                           |
| Expense/bill type tabs        | `src/components/expenses/expense-type-nav.tsx`                      | Canonical in add mode                                               |
| Settings grouped rows         | `personal-settings-panel.tsx`, `settings-panel.tsx`                 | Canonical appearance; shared abstraction unresolved                 |
| Home summary motion           | `src/components/household/home-summary-motion.tsx` + `globals.css`  | Canonical mobile-only behavior                                      |
| Generic full select           | `src/components/ui/select-input.tsx`                                | Available, not canonical in completed pages                         |
| Generic surface               | `src/components/ui/surface.tsx`                                     | Available; default border is not canonical card styling             |

## Known inconsistencies found in the audit

- The completed Expense and Utility Bill forms duplicate their primary title/amount row markup instead of sharing a primitive.
- Group Settings implements a local switch while `SwitchField` provides a separate version.
- User Settings and Group Settings duplicate the borderless grouped-row/card pattern without a shared component.
- Several literal colors remain alongside semantic CSS tokens (icon backgrounds, hover colors, focus outline, dialog backdrop).
- `Surface`, `EmptyState`, and `formSectionClass` default to visible/dashed borders, while completed pages generally prefer borderless cards.
- Standard `SelectInput` and legacy choice-card exports exist, but the completed forms use inline-value dialogs instead.
- Bill upload and expense attachment have parallel View/Replace/Remove popovers but separate implementations and slightly different presentation.
- User Settings header is sticky on mobile; Group Settings is intentionally not sticky. This is a deliberate page distinction and must not be “normalized.”
- Terminology remains `household` in routes, database columns, and internal function names while completed UI increasingly says `group`.

## Unresolved design decisions

These are not defined by the completed pages and should be decided in a future task:

1. A shared component/API for the oversized underlined title and amount entry rows.
2. A single switch primitive and a shared settings-row/group component.
3. Whether to revise `Surface`, `EmptyState`, and `formSectionClass` defaults or retain them for legacy contexts.
4. Whether full `SelectInput` should adopt the sentence/dialog model or remain a distinct pattern for dense forms.
5. A true responsive data-table pattern.
6. Consolidation of the two attachment action/popover implementations.
7. Token names for remaining literal hover, icon, backdrop, and focus colors.
8. Canonical visual treatment for loading, error, and recurring-management pages.
9. Whether internal `household` terminology should ever be migrated; no such migration is implied by the current UI language.
