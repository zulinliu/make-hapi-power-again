import { useLongPress } from './useLongPress'

export function useContextMenu(onContextMenu: (pos: { x: number; y: number }) => void) {
    return useLongPress({ onLongPress: onContextMenu, onClick: undefined })
}
