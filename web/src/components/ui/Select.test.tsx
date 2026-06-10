import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

afterEach(() => cleanup())

describe('Select', () => {
    it('renders options and emits typed value changes', () => {
        const onChange = vi.fn()
        render(
            <Select
                label="Appearance"
                value="system"
                onChange={onChange}
                options={[
                    { value: 'system', label: 'System' },
                    { value: 'dark', label: 'Dark' },
                ]}
            />
        )

        fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'dark' } })

        expect(onChange).toHaveBeenCalledWith('dark')
    })

    it('preserves numeric option values', () => {
        const onChange = vi.fn()
        render(
            <Select
                label="Terminal font size"
                value={13}
                onChange={onChange}
                options={[
                    { value: 11, label: '11px' },
                    { value: 13, label: '13px' },
                    { value: 15, label: '15px' },
                ]}
            />
        )

        fireEvent.change(screen.getByLabelText('Terminal font size'), { target: { value: '15' } })

        expect(onChange).toHaveBeenCalledWith(15)
    })
})
