# apps/web — Frontend rules

Scoped rules for the Vue 3 SPA. These extend the root `CLAUDE.md`; where they conflict, the more specific rule here wins.

## Vue

- Use `<script setup lang="ts">` SFCs. No Options API, no `defineComponent`.
- **Block order** in every SFC: `<script setup>`, then `<template>`, then `<style>`.
- **Props & emits** use the generic, type-only form — never the runtime object form:

  ```vue
  <script setup lang="ts">
  const props = defineProps<{ artistId: string; featured?: boolean }>()
  const emit = defineEmits<{ select: [id: string] }>()
  </script>
  ```

  Give optional props defaults with `withDefaults`.
- **Extract logic into composables** under `src/composables/` (named `useX`, one per file). Keep `<script setup>` thin — it wires composables to the template. GL, data-fetching, and reusable stateful logic do not belong inline in a component.
- **Prefer small, single-purpose components.** If an SFC's `<template>` grows past ~150 lines or juggles several concerns, split it. Many small components beat one large one.
- Route views live in `src/views/` (or `src/router/`), shared components in `src/components/`. Global state goes in Pinia stores under `src/stores/`, not in ad-hoc singletons.
- **Import order:** external packages, then `@/` aliases, then relative imports; a blank line between groups.

## TypeScript

Strict but pragmatic.

- Avoid `any`. Reach for `unknown` + narrowing instead. If an escape hatch (`any`, `!`, `@ts-expect-error`) is truly needed, it must carry a short comment explaining why.
- **Explicit types at module boundaries** — exported functions, composable return shapes, store getters, and anything crossing the CMS/API boundary. Internal locals can rely on inference.
- Prefer `type` aliases for data shapes; `interface` only when you need declaration merging.
- No default exports for logic modules (components excepted); prefer named exports.

## Styling (Tailwind v4)

- **Tailwind utilities only.** No `<style>` blocks and no custom CSS except for what utilities genuinely can't express (complex keyframes, the WebGL canvas). CSS-first config lives in `src/assets/main.css` via `@theme` — there is no `tailwind.config.js`.
- **Use theme tokens, not arbitrary values.** Prefer `text-brand`, `p-4`, `gap-6` over `text-[#ab12cd]` or `top-[37px]`. If a value recurs, add a token in `@theme` first.
- **Repeated utility lists → a component, not `@apply`.** Extract a small Vue component instead of creating CSS classes.
- **Mobile-first & responsive.** Base styles target mobile; layer up with `sm:` / `md:` / `lg:`. Support dark mode explicitly where relevant.

## Testing (Vitest + Vue Test Utils)

- **Colocate tests** as `*.spec.ts` next to the source (`Foo.vue` → `Foo.spec.ts`, `useBooking.ts` → `useBooking.spec.ts`). The legacy `src/__tests__/` is being phased out — put new tests beside their subject.
- **Test behavior, not internals.** Assert on rendered output and user-visible behavior; don't reach into component internals or private refs.
- **Mock the CMS boundary.** No real network in tests — stub Strapi/REST calls and use typed fixtures for CMS responses.
- **New logic ships with tests.** Composables, stores, and utils require tests. Purely presentational components are optional.

## WebGL2

- Raw WebGL2 by default — assume WebGL2 features are available. **three.js is permitted** for glTF/GLB mesh loading and rendering where raw WebGL2 would be disproportionate (e.g. `src/gl/logoBadgeRenderer.ts` on `/home3`). Reach for raw GL for shader-only / fullscreen effects.
- **Isolate GL behind composables/modules** (e.g. `src/composables/` or a dedicated `src/gl/` module). Components should not touch the raw context directly. The same applies to three — keep the scene/renderer inside the module, not the SFC.
- **Own the lifecycle explicitly.** Create context, programs, and buffers deliberately; dispose of every GL resource (for three: geometries, materials, and the renderer) and cancel the render loop on `onUnmounted`. Route changes must not leak contexts.
- **three ShaderMaterial gotcha:** with `glslVersion: THREE.GLSL3`, three does *not* declare a fragment output — declare your own `out vec4` and use explicit `in`/`out` varyings (not `gl_FragColor`).
