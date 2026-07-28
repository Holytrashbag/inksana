<template>
  <!-- Shared chrome for the fixed top-of-page controls (theme toggle, ink
       color picker) so they read as one consistent floating pill: border,
       translucent card background, soft shadow, background blur, and a fixed
       height so badges line up regardless of what they contain. Position
       (e.g. `right-5`) and any inner spacing are supplied by the caller via
       `class`, which falls through onto this root element. -->
  <div
    class="fixed top-5 z-50 inline-flex h-11 items-center rounded-pill border border-hairline bg-surface-card/70 shadow-card backdrop-blur-sm"
  >
    <slot />
  </div>
</template>
