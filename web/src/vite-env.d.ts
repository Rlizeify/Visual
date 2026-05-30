/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'butterchurn' {
  interface VisualizerOptions {
    width: number
    height: number
    meshWidth?: number
    meshHeight?: number
    pixelRatio?: number
  }

  interface Visualizer {
    connectAudio(analyser: AnalyserNode): void
    loadPreset(preset: unknown, blendTime: number): void
    setRendererSize(width: number, height: number): void
    render(): void
  }

  const butterchurn: {
    createVisualizer(
      audioContext: AudioContext,
      canvas: HTMLCanvasElement,
      options: VisualizerOptions
    ): Visualizer
  }

  export default butterchurn
}

declare module 'butterchurn-presets' {
  const presets: {
    getPresets(): Record<string, unknown>
  }
  export default presets
}

declare module 'butterchurn-presets/lib/butterchurnPresetsExtra.min.js' {
  const presets: { getPresets(): Record<string, unknown> }
  export default presets
}

declare module 'butterchurn-presets/lib/butterchurnPresetsExtra2.min.js' {
  const presets: { getPresets(): Record<string, unknown> }
  export default presets
}

declare module 'butterchurn-presets/lib/butterchurnPresetsMD1.min.js' {
  const presets: { getPresets(): Record<string, unknown> }
  export default presets
}

declare module 'butterchurn-presets/lib/butterchurnPresetsNonMinimal.min.js' {
  const presets: { getPresets(): Record<string, unknown> }
  export default presets
}
