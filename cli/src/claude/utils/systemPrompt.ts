import { trimIdent } from "@/utils/trimIdent";

/**
 * Base system prompt shared across all configurations
 */
const BASE_SYSTEM_PROMPT = (() => trimIdent(`
    ALWAYS when you start a new chat - you must call a tool "mcp__hapi_power__change_title" to set a chat title. When you think chat title is not relevant anymore - call the tool again to change it. When chat name is too generic and you have a change to make it more specific - call the tool again to change it. This title is needed to easily find the chat in the future. Help human.
    When you create or find a local image file that the user should see, call the tool "mcp__hapi_power__display_image" with the image path so Hapi Power can show it inline.
`))();

export const systemPrompt = BASE_SYSTEM_PROMPT;
