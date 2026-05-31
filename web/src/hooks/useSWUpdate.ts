import { useCallback, useEffect, useState } from 'react'

type UpdateSWFn = (reloadPage?: boolean) => Promise<void>

interface SWUpdateState {
    updateAvailable: boolean
    applying: boolean
    applyUpdate: () => void
}

export function useSWUpdate(): SWUpdateState {
    const [updateAvailable, setUpdateAvailable] = useState(false)
    const [updateSW, setUpdateSW] = useState<UpdateSWFn | null>(null)
    const [applying, setApplying] = useState(false)

    useEffect(() => {
        const handleUpdate = (event: Event) => {
            const detail = (event as CustomEvent<{ updateSW: UpdateSWFn }>).detail
            if (detail?.updateSW) {
                setUpdateSW(() => detail.updateSW)
                setUpdateAvailable(true)
            }
        }

        window.addEventListener('sw-update-available', handleUpdate)
        return () => window.removeEventListener('sw-update-available', handleUpdate)
    }, [])

    const applyUpdate = useCallback(() => {
        if (!updateSW || applying) return
        setApplying(true)
        updateSW(true)
    }, [updateSW, applying])

    return { updateAvailable, applying, applyUpdate }
}
