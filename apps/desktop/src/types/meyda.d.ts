declare module 'meyda' {
  interface MeydaAnalyzerOptions {
    audioContext: AudioContext
    source: AudioNode
    bufferSize: number
    featureExtractors: string[]
    callback: (features: Record<string, unknown>) => void
  }

  interface MeydaAnalyzer {
    start(): void
    stop(): void
  }

  const Meyda: {
    createMeydaAnalyzer(options: MeydaAnalyzerOptions): MeydaAnalyzer
  }

  export default Meyda
}
