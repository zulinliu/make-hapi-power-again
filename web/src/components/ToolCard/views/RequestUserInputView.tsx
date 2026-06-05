import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import {
    parseRequestUserInputInput,
    parseRequestUserInputAnswers
} from '@/components/ToolCard/requestUserInput'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { cn } from '@/lib/utils'

function getSelectionMark(isSelected: boolean): string {
    return isSelected ? '●' : '○'
}

function parseResultAsAnswers(result: unknown): unknown {
    // tool.result from history may be a JSON string
    if (typeof result === 'string') {
        try {
            return JSON.parse(result)
        } catch {
            return undefined
        }
    }
    return result
}

export function RequestUserInputView(props: ToolViewProps) {
    const parsed = parseRequestUserInputInput(props.block.tool.input)
    const questions = parsed.questions
    // Try permission.answers first (live), fall back to tool.result (history)
    const rawAnswers = props.block.tool.permission?.answers ?? parseResultAsAnswers(props.block.tool.result) ?? undefined
    const parsedAnswers = rawAnswers ? parseRequestUserInputAnswers(rawAnswers) : null
    const hasAnswers = parsedAnswers && Object.keys(parsedAnswers).length > 0

    if (questions.length === 0) {
        return null
    }

    return (
        <div className="flex flex-col gap-3">
            {questions.map((q) => {
                const answer = parsedAnswers?.[q.id]
                const isPureTextQuestion = q.options.length === 0

                return (
                    <div key={q.id} className="rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
                        {q.question ? (
                            <div>
                                <MarkdownRenderer content={q.question} />
                            </div>
                        ) : null}

                        {isPureTextQuestion ? (
                            // Pure text question - show the answer directly
                            hasAnswers && answer?.userNote ? (
                                <div className="mt-3">
                                    <div className="rounded-md border border-[--hp-success] bg-[--hp-success-subtle] px-2 py-2">
                                        <div className="flex items-start gap-2">
                                            <span className="shrink-0 text-sm text-[--hp-success]">●</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-[--hp-success] font-medium break-words">
                                                    {answer.userNote}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null
                        ) : (
                            // Question with options
                            <div className="mt-3 flex flex-col gap-1">
                                {q.options.map((opt, optIdx) => {
                                    const isSelected = answer?.selected === opt.label

                                    return (
                                        <div
                                            key={optIdx}
                                            className={cn(
                                                "rounded-md border px-2 py-2",
                                                isSelected
                                                    ? "border-[--hp-success] bg-[--hp-success-subtle]"
                                                    : "border-[var(--app-border)]"
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                {hasAnswers && (
                                                    <span className={cn(
                                                        "shrink-0 text-sm",
                                                        isSelected
                                                            ? "text-[--hp-success]"
                                                            : "text-[var(--app-hint)]"
                                                    )}>
                                                        {getSelectionMark(isSelected)}
                                                    </span>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className={cn(
                                                        "[&_.aui-md]:text-sm",
                                                        isSelected
                                                            ? "[&_.aui-md]:text-[--hp-success] [&_.aui-md]:font-medium"
                                                            : "[&_.aui-md]:text-[var(--app-fg)]"
                                                    )}>
                                                        <MarkdownRenderer content={opt.label} />
                                                    </div>
                                                    {opt.description ? (
                                                        <div className="mt-0.5 [&_.aui-md]:text-xs [&_.aui-md]:text-[var(--app-hint)]">
                                                            <MarkdownRenderer content={opt.description} />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* Show user note if present */}
                                {hasAnswers && answer?.userNote ? (
                                    <div className="mt-2 rounded-md border border-[--hp-info] bg-[--hp-info-subtle] px-2 py-2">
                                        <div className="flex items-start gap-2">
                                            <span className="shrink-0 text-xs text-[--hp-info]">📝</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs text-[var(--app-hint)]">Note:</div>
                                                <div className="text-sm text-[--hp-info] break-words">
                                                    {answer.userNote}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
