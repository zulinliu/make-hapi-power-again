import { join } from 'path'
import { tmpdir } from 'os'

export const HAPI_POWER_BLOBS_DIR_NAME = 'hapi-power-blobs'

export function getHapiPowerBlobsDir(): string {
    return join(tmpdir(), HAPI_POWER_BLOBS_DIR_NAME)
}
