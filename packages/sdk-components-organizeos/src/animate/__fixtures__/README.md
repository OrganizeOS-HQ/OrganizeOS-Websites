# Upstream animation presets

`new-view-animations.json` and `new-scroll-animations.json` are upstream
Webstudio's "new animation" presets (`newViewAnimations` and
`newScrollAnimations` in
`apps/builder/app/builder/features/settings-panel/props-section/animation/`),
evaluated to the data the editor saves. `play-action.test.ts` plays them; a
builder-side test checks they still equal upstream's files, so an upstream
change to its presets fails there first. Regenerate them from those modules,
never by hand.
