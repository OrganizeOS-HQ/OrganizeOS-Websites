# Upstream animation presets

`new-view-animations.json` and `new-scroll-animations.json` are upstream
Webstudio's "new animation" presets (`newViewAnimations` and
`newScrollAnimations` in
`apps/builder/app/builder/features/settings-panel/props-section/animation/`),
evaluated to the data the editor saves. `play-action.test.ts` plays them; a
builder-side test checks they still equal upstream's files, so an upstream
change to its presets fails there first. Regenerate them from those modules,
never by hand.

`motion-presets.json` is the OrganizeOS panel's own Reveal and Gentle parallax
actions (`organizeos-panel/motion/presets.ts` in the builder).
`play-action.test.ts` checks it equals the actions it plays, and the builder's
`motion/presets.test.ts` checks it equals the presets the Motion area writes,
so the two cannot drift.
