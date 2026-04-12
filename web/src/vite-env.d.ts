/// <reference types="vite/client" />

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
