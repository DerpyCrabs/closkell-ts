import { EvalAST, MacrosAST, MacrosBinding, MAtom, Span } from './types.ts'

export type MacroExpansionError = { error: string; span?: Span }
export type MacroExpansionResult = { result: MacrosAST } | MacroExpansionError

export function expandMacros(expression: MacrosAST, env: MacrosBinding[]): MacroExpansionResult {
  if (
    expression.kind === 'list' &&
    expression.value.length !== 0 &&
    expression.value[0].kind === 'atom' &&
    expression.value[0].value === 'macro'
  ) {
    if (expression.value.length !== 3) {
      return { error: 'Non complete macro definition', span: expression.span }
    }
    const args = expression.value[1]
    if (args.kind !== 'vector') {
      return { error: 'Macro arguments should be in vector', span: args.span }
    }
    const invalidArg = args.value.find((a) => a.kind !== 'atom')
    if (invalidArg) {
      return { error: 'Invalid argument', span: invalidArg.span }
    }
    const body = expression.value[2]
    return {
      result: { kind: 'macro', env: env, body, arguments: (args.value as MAtom[]).map((a) => a.value) },
    }
  } else {
    return { result: expression }
  }
}
