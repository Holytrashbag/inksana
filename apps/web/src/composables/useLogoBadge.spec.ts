import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLogoBadge } from './useLogoBadge'

// jsdom has no WebGL2, so getContext('webgl2') returns null. The composable
// must degrade gracefully: no throw, no leaked listeners.
const Host = defineComponent({
  setup() {
    const canvas = ref<HTMLCanvasElement | null>(null)
    const { isSupported } = useLogoBadge(canvas)
    return { canvas, isSupported }
  },
  template: '<canvas ref="canvas" />',
})

describe('useLogoBadge', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mounts without throwing when WebGL2 is unavailable', () => {
    expect(() => mount(Host)).not.toThrow()
  })

  it('reports unsupported and warns when the context cannot be created', () => {
    const wrapper = mount(Host)
    expect(wrapper.vm.isSupported()).toBe(false)
    expect(console.warn).toHaveBeenCalledWith('[useLogoBadge] disabled:', expect.anything())
  })

  it('removes its window listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(Host)
    wrapper.unmount()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
