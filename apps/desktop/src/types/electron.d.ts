declare global {
  interface Window {
    api?: {
      loadMp3: () => Promise<string | null>
      play: () => Promise<void>
      pause: () => Promise<void>
      stop: () => Promise<void>
      pushToDisplay: (data: unknown) => Promise<void>
      readAudioFile: (filePath: string) => Promise<Uint8Array>
      toggleDisplayFullscreen: () => void
    }
  }
}

export {}
