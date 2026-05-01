declare module 'butterchurn' {
  const butterchurn: {
    createVisualizer(
      audioCtx: AudioContext,
      canvas: HTMLCanvasElement,
      opts?: { width?: number; height?: number; pixelRatio?: number }
    ): {
      loadPreset(preset: unknown, blendTime: number): void
      setRendererSize(width: number, height: number): void
      render(timestamp?: number, elapsedMs?: number): void
      connectAudio(node: AudioNode): void
    }
  }
  export default butterchurn
}

declare module 'butterchurn-presets' {
  const presets: {
    getPresets(): Record<string, unknown>
  }
  export default presets
}

declare module '*.ttf?url' {
  const src: string
  export default src
}

declare module '*.otf?url' {
  const src: string
  export default src
}
