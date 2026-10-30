import { useEffect, useState } from 'react'
import { Button } from '@nesso-how/ui'
import type { ActionContext } from '@nesso-how/plugin'
import './Quiz.css'

export function Quiz({ document, storage, viewId }: ActionContext) {
  const [step, setStep] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const key = `quiz:${viewId ?? 'all'}`

  useEffect(() => {
    void storage.list().then((records) => {
      const value = records.find((record) => record.key === key && record.conceptId === undefined)?.value
      setStep(typeof value === 'number' ? value : 0)
    })
  }, [storage, key])

  async function saveStep(next: number) {
    setStep(null)
    await storage.set(key, next)
    setRevealed(false)
    setStep(next)
  }

  if (step === null) return null

  const { concepts, relations, relationTypes } = document.getState().viewGraph
  const relation = relations[step]
  const relationType = relationTypes.find(({ id }) => id === relation?.predicate)
  const conceptLabel = (id: string) => concepts.find((item) => item.id === id)?.label || id
  const buttonLabel = !relation ? 'Completed' : revealed ? 'Next' : 'Show concept'

  return (
    <section className="quiz">
      <div className="quiz-card">
        <h1>Concept Quiz</h1>
        <p data-step>Step {Math.min(step + 1, relations.length)} / {relations.length}</p>
        {relation ? <>
          <p data-question>{conceptLabel(relation.source)} — {relationType?.label || relation.predicate} → ?</p>
          <p data-answer role="status">{revealed ? conceptLabel(relation.target) : ''}</p>
        </> : <p data-result role="status">{relations.length ? 'Quiz complete!' : 'This view has no relations.'}</p>}
        <footer>
          <Button variant="outline" onClick={() => void saveStep(0)}>Reset</Button>
          <Button disabled={!relation} onClick={() => revealed ? void saveStep(step + 1) : setRevealed(true)}>{buttonLabel}</Button>
        </footer>
      </div>
    </section>
  )
}
