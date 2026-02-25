"use client"

import { useState, useEffect, useCallback } from "react"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { UseFormReturn } from "react-hook-form"

export interface DevPreset<TFormData = Record<string, unknown>> {
  label: string
  description?: string
  data?: Partial<TFormData>
  step?: string
  onApply?: () => void
}

interface FlowDevToolsProps<TStep extends string, TFormData = Record<string, unknown>> {
  currentStep: TStep
  steps: readonly TStep[]
  onGoToStep: (step: TStep) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
  presets?: DevPreset<TFormData>[]
  flowName?: string
}

export function FlowDevTools<TStep extends string, TFormData = Record<string, unknown>>({
  currentStep,
  steps,
  onGoToStep,
  form,
  presets = [],
  flowName = "Flow",
}: FlowDevToolsProps<TStep, TFormData>) {
  const [isOpen, setIsOpen] = useState(false)
  const [showState, setShowState] = useState(false)
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const [editedJson, setEditedJson] = useState<string | null>(null)
  const [stateError, setStateError] = useState<string | null>(null)

  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "`" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        toggle()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [toggle])

  if (process.env.NODE_ENV !== "development") return null

  const formValues = form.watch()
  const currentIndex = steps.indexOf(currentStep)

  const applyPreset = (preset: DevPreset<TFormData>) => {
    if (preset.data) {
      Object.entries(preset.data).forEach(([key, value]) => {
        form.setValue(key, value, { shouldValidate: true, shouldDirty: true })
      })
    }
    if (preset.step) {
      onGoToStep(preset.step as TStep)
    }
    preset.onApply?.()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(formValues, null, 2))
      setCopyStatus("copied")
      setTimeout(() => setCopyStatus("idle"), 1500)
    } catch {
      setCopyStatus("error")
      setTimeout(() => setCopyStatus("idle"), 1500)
    }
  }

  const handleApply = () => {
    setStateError(null)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(editedJson ?? "")
    } catch {
      console.error("Invalid JSON:", editedJson)
      setStateError("Invalid JSON")
      return
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setStateError("Must be a JSON object")
      return
    }
    Object.entries(parsed).forEach(([key, value]) => {
      form.setValue(key, value, { shouldValidate: true, shouldDirty: true })
    })
    setEditedJson(null)
  }

  return (
    <div className="fixed bottom-4 right-4 z-9999 font-mono text-xs select-none">
      {/* Toggle button */}
      <div className="flex justify-end">
        <button
          onClick={toggle}
          title="Toggle Dev Tools (` key)"
          className="bg-primary hover:brightness-110 text-white px-3 py-1 rounded-full text-[11px] font-bold shadow tracking-wider"
        >
          DEV
        </button>
      </div>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-0 right-0 w-72 bg-white border border-default-300 rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-default-100 px-3 py-2 flex items-center justify-between border-b border-default-300">
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold">{flowName}</span>
              <span className="text-default-600 text-[10px]">` to toggle</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-default-600 hover:text-default-900 leading-none text-base transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
            {/* Step Navigation */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-default-700 uppercase tracking-wider text-[10px]">Steps</span>
                <span className="text-default-600 text-[10px]">
                  {currentIndex + 1} / {steps.length}
                </span>
              </div>

              {/* Prev / Next */}
              <div className="flex gap-1 mb-2">
                <button
                  disabled={currentIndex <= 0}
                  onClick={() => onGoToStep(steps[currentIndex - 1])}
                  className="flex-1 py-1 bg-default-100 hover:bg-default-200 disabled:opacity-40 disabled:cursor-not-allowed rounded text-default-900 text-[11px] transition-colors"
                >
                  ← Prev
                </button>
                <button
                  disabled={currentIndex >= steps.length - 1}
                  onClick={() => onGoToStep(steps[currentIndex + 1])}
                  className="flex-1 py-1 bg-default-100 hover:bg-default-200 disabled:opacity-40 disabled:cursor-not-allowed rounded text-default-900 text-[11px] transition-colors"
                >
                  Next →
                </button>
              </div>

              {/* Step grid */}
              <div className="flex flex-wrap gap-1">
                {steps.map((step) => (
                  <button
                    key={step}
                    onClick={() => onGoToStep(step)}
                    className={`py-1 px-2 rounded text-[11px] transition-colors ${
                      step === currentStep
                        ? "bg-primary text-white font-semibold"
                        : "bg-default-100 hover:bg-default-200 text-default-800 hover:text-default-900"
                    }`}
                  >
                    {step}
                  </button>
                ))}
              </div>
            </section>

            {/* Presets */}
            {presets.length > 0 && (
              <section>
                <div className="text-default-700 uppercase tracking-wider text-[10px] mb-2">Presets</div>
                <div className="flex flex-wrap gap-1">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      title={preset.description}
                      className="py-1 px-2 bg-default-100 hover:bg-default-200 rounded text-default-800 hover:text-default-900 text-[11px] transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Form State */}
            <section>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowState((v) => !v)}
                  className="text-default-700 uppercase tracking-wider text-[10px] flex items-center gap-1 hover:text-default-900 transition-colors"
                >
                  Form State
                  <span className="text-default-600">{showState ? "▲" : "▼"}</span>
                </button>
                <div className="flex gap-1">
                  {editedJson !== null ? (
                    <>
                      <button
                        onClick={() => {
                          setEditedJson(null)
                          setStateError(null)
                        }}
                        className="py-0.5 px-2 bg-default-100 hover:bg-default-200 rounded text-[11px] text-default-800 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleApply}
                        className="py-0.5 px-2 bg-primary hover:brightness-110 text-white rounded text-[11px] font-semibold transition-colors"
                      >
                        Apply
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCopy}
                      className="py-0.5 px-2 bg-default-100 hover:bg-default-200 rounded text-[11px] text-default-800 transition-colors"
                    >
                      {copyStatus === "copied" ? "Copied!" : copyStatus === "error" ? "Failed" : "Copy"}
                    </button>
                  )}
                </div>
              </div>

              {showState && (
                <div className="mt-2">
                  <textarea
                    value={editedJson ?? JSON.stringify(formValues, null, 2)}
                    onChange={(e) => {
                      setEditedJson(e.target.value)
                      setStateError(null)
                    }}
                    className="w-full h-48 p-2 bg-default-100 text-default-800 rounded text-[10px] leading-relaxed resize-none border border-default-300 focus:outline-none focus:border-primary font-mono"
                  />
                  {stateError && <div className="text-danger text-[10px] mt-1">{stateError}</div>}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
