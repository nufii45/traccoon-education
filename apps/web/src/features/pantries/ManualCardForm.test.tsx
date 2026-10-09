import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ManualCardForm } from './ManualCardForm'

const fill = () => {
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Where does the Krebs cycle take place?' } })
  ;['Cytoplasm', 'Mitochondrial matrix', 'Nucleus', 'Ribosome'].forEach((value, index) => {
    fireEvent.change(screen.getByLabelText(`Manual option ${index + 1}`), { target: { value } })
  })
}

describe('ManualCardForm', () => {
  it('works with no PDF: no source fields, no preselected answer', () => {
    const onSave = vi.fn()
    render(<ManualCardForm onCancel={vi.fn()} onSave={onSave} sourcePages={[]} />)

    expect(screen.queryByLabelText(/Cite a page/)).toBeNull()
    expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)

    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick the correct answer.')
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Mark option B correct'))
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ correctIndex: 1, sourceQuote: '', generationMethod: 'manual' }))
  })

  it('offers an optional citation when the pantry has pages', () => {
    render(
      <ManualCardForm
        onCancel={vi.fn()}
        onSave={vi.fn()}
        sourcePages={[{ id: 'page-1', pageNumber: 1, text: 'The Krebs cycle takes place in the mitochondrial matrix.' }]}
      />,
    )
    expect(screen.getByLabelText('Cite a page (optional)')).toHaveValue('')
    expect(screen.getByLabelText('Exact quote from that page (optional)')).toHaveValue('')
  })
})
