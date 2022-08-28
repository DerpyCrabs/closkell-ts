import { EvalAST, MacrosAST, MacrosBinding, MAtom, Span } from './types.ts'

export type MacroExpansionError = { error: string; span?: Span }
export type MacroExpansionResult = { result: MacrosAST } | MacroExpansionError

export function expandMacros(expression: MacrosAST, env: MacrosBinding[], evaluating = false): MacroExpansionResult {
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
  } else if (
    expression.kind === 'list' &&
    expression.value.length !== 0 &&
    expression.value[0].kind === 'atom' &&
    expression.value[0].value === 'unquote'
  ) {
    if (expression.value.length !== 2) {
      return { error: `Expected 1 argument, got ${expression.value.length - 1}`, span: expression.span }
    }
    return expandMacros(expression.value[1], env, true)
  } else if (
    expression.kind === 'list' &&
    expression.value.length !== 0 &&
    expression.value[0].kind === 'atom' &&
    expression.value[0].value === 'fn'
  ) {
    if (expression.value.length !== 3) {
      return { error: 'Incomplete function definition', span: expression.span }
    }
    const args = expression.value[1]
    if (args.kind !== 'vector') {
      return { error: 'Function arguments should be in vector', span: args.span }
    }
    const invalidArg = args.value.find((a) => a.kind !== 'atom')
    if (invalidArg) {
      return { error: 'Invalid argument', span: invalidArg.span }
    }
    const body = expression.value[2]
    return {
      result: { kind: 'function', env: env, body, arguments: (args.value as MAtom[]).map((a) => a.value) },
    }
  } else if (
    expression.kind === 'list' &&
    expression.value.length !== 0 &&
    expression.value[0].kind === 'atom' &&
    expression.value[0].value === 'if'
  ) {
    if (evaluating) {
      const equationResult = expandMacros(expression.value[1], env, evaluating)
      if ('error' in equationResult) {
        return equationResult
      }
      if (!isBoolean(equationResult.result)) {
        return { error: `Expected true or false, got ${equationResult.result.kind}`, span: equationResult.result.span }
      }
      if (expression.value.length !== 4) {
        return { error: `If takes 3 arguments, got ${expression.value.length - 1}`, span: expression.span }
      }
      if (equationResult.result.value === 'true') {
        return expandMacros(expression.value[2], env, evaluating)
      } else {
        return expandMacros(expression.value[3], env, evaluating)
      }
    } else {
      const results = expression.value.slice(1).map((e) => expandMacros(e, env, evaluating))
      if (results.some((r) => 'error' in r)) {
        return { error: results.filter((r) => 'error' in r).map((r) => (r as MacroExpansionError).error)[0] } // TODO return all errors
      }
      return {
        result: {
          ...expression,
          value: [expression.value[0], ...(results as { result: MacrosAST }[]).map((r) => r.result)],
        },
      }
    }
  } else if (expression.kind === 'list') {
    const evaluatedExpressionsWithErrors = expression.value.map((e) => expandMacros(e, env, evaluating))
    const errors = evaluatedExpressionsWithErrors.filter((e) => 'error' in e)
    if (errors.length !== 0) {
      return errors[0] // TODO return all errors
    }
    const evaluatedExpressions = (evaluatedExpressionsWithErrors as { result: MacrosAST }[]).map((e) => e.result)
    if (evaluating) {
      if (
        evaluatedExpressions[0].kind !== 'function' &&
        evaluatedExpressions[0].kind !== 'intrinsicFunction' &&
        evaluatedExpressions[0].kind !== 'macro'
      ) {
        return { error: 'Expression not callable', span: evaluatedExpressions[0].span }
      }
      const fn = evaluatedExpressions[0]
      const args = evaluatedExpressions.slice(1)
      if (fn.kind === 'intrinsicFunction') {
        return fn.value(args as EvalAST[])
      } else {
        if (fn.arguments.length !== args.length) {
          return { error: `Expected ${fn.arguments.length} arguments, got ${args.length}`, span: expression.span }
        }
        return expandMacros(
          fn.body,
          [...fn.env, ...fn.arguments.map((arg, i) => ({ name: arg, value: args[i] }))],
          evaluatedExpressions[0].kind === 'macro' ? false : evaluating
        )
      }
    } else {
      return { result: { ...expression, value: evaluatedExpressions } }
    }
  } else if (expression.kind === 'atom' && !isBoolean(expression) && evaluating) {
    const binding = env.find((b) => b.name === expression.value)
    if (binding) {
      return { result: binding.value }
    } else {
      return { error: `Unknown atom ${expression.value}`, span: expression.span }
    }
  } else {
    return { result: expression }
  }
}

function isBoolean(e: MacrosAST): e is typeof e & { kind: 'atom'; value: 'false' | 'true' } {
  return e.kind === 'atom' && (e.value === 'false' || e.value === 'true')
}

export function verifyNoMacros(expression: MacrosAST): EvalAST {
  if (
    expression.kind === 'list' &&
    expression.value.length !== 0 &&
    expression.value[0].kind === 'atom' &&
    expression.value[0].value === 'macro'
  ) {
    throw new Error(`Unexpected macro at ${JSON.stringify(expression.span)}`)
  } else if (expression.kind === 'macro') {
    throw new Error(`Unexpected macro at ${JSON.stringify(expression.span)}`)
  } else if (expression.kind === 'list' || expression.kind === 'vector' || expression.kind === 'map') {
    return { ...expression, value: expression.value.map(verifyNoMacros) } as EvalAST
  } else {
    return expression as EvalAST
  }
}
