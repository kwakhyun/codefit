# Terminal UI components

All product-owned buttons, links, fields, disclosures, tabs, toggles, badges, progress bars and status messages use `src/components/ui/primitives.tsx`. `Modal` owns native dialog focus, Escape and backdrop handling; `Select` owns combobox keyboard selection and popover positioning. They compose the same primitives. `useConfirmation` uses the shared modal for project and security-record deletion; cancellation and unmount resolve without deleting. Repeated product patterns such as `VisualIntro`, `ExperienceJourney`, `GuestLogin`, `ScenarioVisual`, `ServiceThumbnail` and `SectionArtwork` remain shared composites.

`src/styles/terminal-system.css` defines the neutral charcoal terminal palette, 3px control corners, contrast, hover/focus/disabled states and motion. Page classes control layout and domain-specific content. Native properties, refs, roles and form behavior pass through the primitives; use `type="button"` for non-submit buttons inside a form. Native inputs preserve labels and input semantics. Monaco manages its own internal controls.

Illustration edges blend with the surrounding background using masks. Scenario sprite masks belong to the viewport, not the four-frame source image. Project evidence screenshots and third-party provider/brand icons are not cropped or faded.

Route changes animate the existing main element without remounting its state. Disclosure, tab and modal entry use a short opacity-only transition. `useFadeTransition` also fades type changes, learning steps, questions and results without remounting drafts or animating typing. Reduced-motion preferences disable animations. Hidden responsive controls retain their display rules.

`api()` reports actual in-flight and settled requests. `RouteFeedback` displays completed responses out of the current request batch. Unknown durations use an indeterminate bar, not a simulated percentage. `LoadingState` accepts a measured value/max; AI requests also show elapsed time. A percentage measures completed work units, not predicted time remaining.

AI quotas live in `src/lib/ai-access.ts`. Server-resolved ownership selects guest or member limits. Guests can generate problems and complete project analysis, answer assessment and follow-up within their own workspace. Existing origin checks, request leases, quota transactions, ownership checks, network and global caps remain in force. The README contains the current usage table and reset rules.
