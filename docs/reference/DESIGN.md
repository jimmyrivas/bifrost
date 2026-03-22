# The Design System: Tactical Precision & Spectral Depth

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Spectral Command."** 

This system moves beyond the utility of a standard terminal and into the realm of a high-end, editorial DevOps cockpit. We are evolving the legacy of connection management into a sophisticated, keyboard-centric experience that balances high information density with premium visual breathing room. 

Unlike generic IDEs that rely on rigid 1px grids, this system utilizes **Asymmetric Tonal Layering**. We define structure through shifting light and depth rather than physical lines. The UI should feel like a series of obsidian glass panes floating in a void, illuminated by the "Bifrost" spectral accent—a thin, prismatic thread that guides the user’s eye across complex data landscapes.

---

## 2. Colors & Surface Logic

Our palette is rooted in deep zinc neutrals to ensure "terminal-grade" focus, contrasted by a high-energy spectral gradient.

### The "No-Line" Rule
**Explicit Mandate:** 1px solid borders are prohibited for sectioning. 
To separate the Sidebar from the Terminal or the Inspector from the Main View, use background shifts. Place a `surface_container_low` panel against the `background` to create a natural, sophisticated break. If a boundary feels "lost," increase the padding rather than adding a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack. Each level of nesting moves one step up or down the container scale:
- **Level 0 (App Shell):** `surface` (#131316)
- **Level 1 (Main Workspaces):** `surface_container_low` (#1b1b1e)
- **Level 2 (Active Cards/Modals):** `surface_container_high` (#2a2a2d)
- **Level 3 (Floating Tooltips/Popovers):** `surface_bright` (#39393c) with 80% opacity and 12px backdrop-blur.

### The "Glass & Gradient" Rule
The signature "Bifrost" gradient (`linear-gradient(135deg, #ff6b6b...#d56bff)`) must be used sparingly to maintain its premium feel.
- **Branding:** Use as a 2px top-border on the primary window or a subtle underglow on the active tab.
- **CTAs:** Apply a subtle 10% opacity version of the gradient as a background for primary buttons to give them a "holographic" depth.

---

## 3. Typography: The Editorial Interface

We pair the clinical precision of **Inter** with the structural clarity of **JetBrains Mono**.

- **Display & Headlines:** Use `display-sm` for workspace titles. Shift from standard weights to Semi-Bold to establish an authoritative "Editorial" hierarchy.
- **Terminal & Code:** All monospaced data must use `JetBrains Mono`. Increase line-height to `1.6` for long-form logs to ensure readability during high-stress debugging.
- **Labels:** Use `label-sm` in `on_surface_variant` (#c7c4d7) for non-interactive metadata. High-contrast white (`#FFFFFF`) is reserved only for active, critical information.

---

## 4. Elevation & Depth

We eschew traditional "Drop Shadows" in favor of **Tonal Ambient Occlusion.**

- **The Layering Principle:** To lift a terminal pane, place a `surface_container_highest` element over a `surface_dim` background. The contrast in value provides all the "lift" required.
- **Ambient Shadows:** For floating command palettes (Cmd+K), use a shadow color derived from `surface_container_lowest` at 40% opacity with a 32px blur. It should feel like a soft glow-cast rather than a harsh shadow.
- **Ghost Borders:** When accessibility requires a container definition (e.g., input fields), use the `outline_variant` token at **15% opacity**. This creates a "Ghost Border" that is felt rather than seen.

---

## 5. Components

### Primary Buttons
- **Style:** No solid background. Use a `ghost_border` with the "Bifrost" gradient applied only to the text or a subtle 1px bottom accent.
- **State:** On hover, apply a `surface_bright` fill at 10% opacity.

### Terminal Cells & Cards
- **Constraint:** **Strictly forbid divider lines.** 
- **Structure:** Use a 0.6rem (`spacing.3`) vertical gap to separate log entries. Use `surface_container_low` for alternating "zebra" backgrounds in high-density tables if necessary, but prioritize whitespace.

### Input Fields (Command Bar)
- **Visuals:** Use `surface_container_highest`. No border. The focus state is indicated by a 1px "Spectral Thread" (the rainbow gradient) at the very bottom of the input.
- **Typography:** `JetBrains Mono` body-md.

### Connection Chips
- **States:** 
  - **Connected:** `on_success` text with a 4px soft-glow pulse of `success` (#22c55e).
  - **Error:** `tertiary_container` background with `on_tertiary_container` text.

### The "Breadcrumb Navigator"
A custom component for DevOps: A horizontal list of breadcrumbs using `title-sm`, where the "chevron" is replaced by a subtle tonal shift in the background of each segment.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `0.25rem` (default) rounding for structural elements to maintain a "technical" feel.
- **Do** use `JetBrains Mono` for any data that is "output" by a machine.
- **Do** use `surface_container_lowest` for the main terminal background to provide maximum contrast for syntax highlighting.

### Don’t
- **Don't** use pure black (#000000) or pure white (#FFFFFF) for large surfaces. It breaks the "Spectral" depth.
- **Don't** use standard Material Design "elevated" FABs. Everything in this system should feel integrated into the "panes of glass" logic.
- **Don't** use icons as the primary way to communicate actions for pro-users; prioritize text labels with keyboard shortcut hints (e.g., `⌘K`).

### Accessibility Note
While we use subtle tonal shifts, ensure that the contrast between `on_surface` and its respective `surface_container` always meets a minimum of 4.5:1 for critical UI text. Use `outline_variant` sparingly but intentionally to pass AA standards in high-glare environments.