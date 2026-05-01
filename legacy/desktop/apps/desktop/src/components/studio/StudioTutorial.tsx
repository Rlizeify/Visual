import { useState, useEffect, useCallback, useRef } from 'react'

interface TutorialStep {
  selector: string
  title: string
  description: string
}

const STEPS: TutorialStep[] = [
  {
    selector: '',
    title: 'Welcome to the Studio',
    description: 'Build sounds from scratch. Let\u2019s walk through the main tools.',
  },
  {
    selector: '[data-tutorial-id="studio-tabs"]',
    title: 'Tool Tabs',
    description: 'Switch between Synth, Sampler, and other tools here.',
  },
  {
    selector: '[data-tutorial-id="studio-additive-synth"]',
    title: 'Additive Synth',
    description: 'Create sounds with oscillator layers. Add up to 6 layers with different waveforms.',
  },
  {
    selector: '[data-tutorial-id="studio-osc-layer"]',
    title: 'Oscillator Layer',
    description: 'Each layer has frequency, gain, detune, and waveform controls. Toggle layers on or off.',
  },
  {
    selector: '[data-tutorial-id="studio-additive-synth"]',
    title: 'Additive Synthesis',
    description: 'The additive synth lets you combine frequencies. Layers are additive \u2014 they stack.',
  },
  {
    selector: '[data-tutorial-id="studio-oscilloscope"]',
    title: 'Oscilloscope',
    description: 'XY oscilloscope shows your audio as a Lissajous pattern. Left channel on X, right on Y.',
  },
  {
    selector: '[data-tutorial-id="studio-function-input"]',
    title: 'Function Input',
    description: 'Type math functions to generate audio. Use x, y, z as frequency inputs and t for time. Example: sin(x) + cos(y*t)',
  },
  {
    selector: '[data-tutorial-id="studio-sample-editor"]',
    title: 'Sampler',
    description: 'Load audio samples, trim them, loop them, reverse them, and pitch shift.',
  },
  {
    selector: '[data-tutorial-id="studio-sample-waveform"]',
    title: 'Sample Waveform',
    description: 'Mouse wheel to zoom in. Click and drag to pan. Drag the markers to set start and end points.',
  },
  {
    selector: '[data-tutorial-id="studio-beat-pads"]',
    title: 'Beat Pads',
    description: '16 trigger pads. Right-click a pad to assign a sample. Click to play it.',
  },
  {
    selector: '[data-tutorial-id="studio-patches"]',
    title: 'Patch Management',
    description: 'Save and load your sound patches. Each patch stores your full synth and sampler configuration.',
  },
  {
    selector: '',
    title: 'You\u2019re Ready to Create',
    description: 'Press ? anytime to replay this guide.',
  },
]

const STORAGE_KEY = 'visual-tutorial-studio-viewed'

interface Props {
  onClose: () => void
}

export default function StudioTutorial({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [highlight, setHighlight] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const currentStep = STEPS[step]

  // Find and measure the target element
  useEffect(() => {
    if (!currentStep.selector) {
      setHighlight(null)
      return
    }
    const el = document.querySelector(currentStep.selector)
    if (el) {
      setHighlight(el.getBoundingClientRect())
    } else {
      setHighlight(null)
    }
  }, [step, currentStep.selector])

  // Reposition on resize
  useEffect(() => {
    const handleResize = () => {
      if (!currentStep.selector) return
      const el = document.querySelector(currentStep.selector)
      if (el) setHighlight(el.getBoundingClientRect())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [currentStep.selector])

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else {
      localStorage.setItem(STORAGE_KEY, 'true')
      onClose()
    }
  }, [step, onClose])

  const back = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  const skip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    onClose()
  }, [onClose])

  // Card position: next to highlighted element, or centered
  const getCardStyle = (): React.CSSProperties => {
    if (!highlight) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const pad = 16
    let top = highlight.bottom + pad
    let left = highlight.left + highlight.width / 2 - 160

    // Clamp to viewport
    if (left < pad) left = pad
    if (left + 320 > window.innerWidth - pad) left = window.innerWidth - 320 - pad
    if (top + 200 > window.innerHeight - pad) {
      top = highlight.top - 200 - pad
    }

    return { position: 'fixed', top, left }
  }

  return (
    <>
      <style>{tutorialCSS}</style>
      {/* Dark overlay with cutout */}
      <div className="tut-overlay" onClick={skip}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="studio-tut-mask">
              <rect width="100%" height="100%" fill="white" />
              {highlight && (
                <rect
                  x={highlight.left - 6}
                  y={highlight.top - 6}
                  width={highlight.width + 12}
                  height={highlight.height + 12}
                  rx={6}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#studio-tut-mask)" />
          {highlight && (
            <rect
              x={highlight.left - 6}
              y={highlight.top - 6}
              width={highlight.width + 12}
              height={highlight.height + 12}
              rx={6}
              fill="none"
              stroke="rgba(255,45,155,0.6)"
              strokeWidth={2}
            />
          )}
        </svg>
      </div>

      {/* Card */}
      <div ref={cardRef} className="tut-card tut-card--studio" style={getCardStyle()} onClick={e => e.stopPropagation()}>
        <div className="tut-card__step">Step {step + 1} of {STEPS.length}</div>
        <div className="tut-card__title">{currentStep.title}</div>
        <div className="tut-card__desc">{currentStep.description}</div>
        <div className="tut-card__nav">
          <button className="tut-nav-btn" onClick={back} disabled={step === 0}>Back</button>
          <button className="tut-nav-btn tut-nav-btn--primary tut-nav-btn--studio" onClick={next}>
            {step === STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
        <button className="tut-skip" onClick={skip}>Skip Tutorial</button>
      </div>
    </>
  )
}

const tutorialCSS = `
.tut-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  cursor: pointer;
}

.tut-card {
  z-index: 10001;
  width: 320px;
  background: rgba(5, 0, 15, 0.96);
  border: 1px solid rgba(255, 179, 71, 0.5);
  box-shadow: 0 0 24px rgba(255, 179, 71, 0.15), 0 8px 32px rgba(0,0,0,0.6);
  border-radius: 6px;
  padding: 20px;
  animation: tut-fade-in 200ms ease;
  -webkit-app-region: no-drag;
}

.tut-card--studio {
  border-color: rgba(255, 45, 155, 0.5);
  box-shadow: 0 0 24px rgba(255, 45, 155, 0.15), 0 8px 32px rgba(0,0,0,0.6);
}

@keyframes tut-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.tut-card__step {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  color: #666;
  letter-spacing: 0.15em;
  margin-bottom: 8px;
}

.tut-card__title {
  font-family: 'Hitmarker Text', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #ffb347;
  margin-bottom: 8px;
}

.tut-card--studio .tut-card__title {
  color: #ff2d9b;
}

.tut-card__desc {
  font-family: 'Hitmarker Text', system-ui, sans-serif;
  font-size: 14px;
  color: #a0a0b0;
  line-height: 1.5;
  margin-bottom: 16px;
}

.tut-card__nav {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.tut-nav-btn {
  flex: 1;
  padding: 8px 16px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
  border: 1px solid rgba(255, 179, 71, 0.3);
  background: transparent;
  color: #a0a0b0;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
}

.tut-nav-btn:not(:disabled):hover {
  background: rgba(255, 179, 71, 0.1);
  color: #ffb347;
}

.tut-nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.tut-nav-btn--primary {
  background: rgba(255, 179, 71, 0.15);
  color: #ffb347;
  border-color: rgba(255, 179, 71, 0.5);
}

.tut-nav-btn--primary:hover {
  background: rgba(255, 179, 71, 0.25) !important;
}

.tut-nav-btn--studio {
  background: rgba(255, 45, 155, 0.15);
  color: #ff2d9b;
  border-color: rgba(255, 45, 155, 0.5);
}

.tut-nav-btn--studio:hover {
  background: rgba(255, 45, 155, 0.25) !important;
  color: #ff2d9b;
}

.tut-skip {
  display: block;
  margin: 0 auto;
  background: none;
  border: none;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: #555;
  cursor: pointer;
  letter-spacing: 0.08em;
  transition: color 0.15s;
}

.tut-skip:hover {
  color: #888;
}
`
