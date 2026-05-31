import type { KimiPermissionMode } from '@hapipower/protocol/types';

export type PermissionMode = KimiPermissionMode;

export interface KimiMode {
    permissionMode: PermissionMode;
    model?: string;
}
