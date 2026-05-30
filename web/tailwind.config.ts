import type { Config } from 'tailwindcss'

export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            maxWidth: {
                content: 'var(--content-max-w, 960px)'
            },
            colors: {
                hp: {
                    primary: 'var(--hp-primary)',
                    'primary-hover': 'var(--hp-primary-hover)',
                    'primary-subtle': 'var(--hp-primary-subtle)',
                    success: 'var(--hp-success)',
                    'success-subtle': 'var(--hp-success-subtle)',
                    warning: 'var(--hp-warning)',
                    'warning-subtle': 'var(--hp-warning-subtle)',
                    danger: 'var(--hp-danger)',
                    'danger-subtle': 'var(--hp-danger-subtle)',
                    canvas: 'var(--hp-canvas)',
                    'surface-0': 'var(--hp-surface-0)',
                    'surface-1': 'var(--hp-surface-1)',
                    'surface-2': 'var(--hp-surface-2)',
                    'surface-3': 'var(--hp-surface-3)',
                },
            },
            fontFamily: {
                sans: ['var(--hp-font-sans)'],
                mono: ['var(--hp-font-mono)'],
            },
            spacing: {
                'hp-1': 'var(--hp-space-1)',
                'hp-2': 'var(--hp-space-2)',
                'hp-3': 'var(--hp-space-3)',
                'hp-4': 'var(--hp-space-4)',
                'hp-5': 'var(--hp-space-5)',
                'hp-6': 'var(--hp-space-6)',
                'hp-8': 'var(--hp-space-8)',
                'hp-10': 'var(--hp-space-10)',
                'hp-12': 'var(--hp-space-12)',
            },
            borderRadius: {
                'hp-sm': 'var(--hp-radius-sm)',
                'hp-md': 'var(--hp-radius-md)',
                'hp-lg': 'var(--hp-radius-lg)',
                'hp-xl': 'var(--hp-radius-xl)',
                'hp-full': 'var(--hp-radius-full)',
            },
            boxShadow: {
                'hp-xs': 'var(--hp-shadow-xs)',
                'hp-sm': 'var(--hp-shadow-sm)',
                'hp-md': 'var(--hp-shadow-md)',
                'hp-lg': 'var(--hp-shadow-lg)',
                'hp-focus': 'var(--hp-shadow-focus)',
            },
            transitionDuration: {
                'hp-fast': 'var(--hp-duration-fast)',
                'hp-normal': 'var(--hp-duration-normal)',
                'hp-slow': 'var(--hp-duration-slow)',
            },
            transitionTimingFunction: {
                'hp-default': 'var(--hp-ease-default)',
                'hp-spring': 'var(--hp-ease-spring)',
            },
        }
    },
    plugins: []
} satisfies Config
