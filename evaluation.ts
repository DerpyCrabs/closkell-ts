import { EvalAST, Binding, Span, EAtom } from './types.ts'

export type EvaluationError = { error: string; span?: Span }
export type EvaluationResult = { result: EvalAST } | EvaluationError

export function evaluateExpression(
  expression: EvalAST,
  env: Binding[]
): { result: EvalAST } | { error: string; span?: Span } {
  if (
    expression.kind === 'list' &&
    expression.value.length !== 0 &&
    expression.value[0].kind === 'atom' &&
    expression.value[0].value === 'fn'
  ) {
    if (expression.value.length !== 3) {
      return { error: 'Non complete function definition', span: expression.span }
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
      result: { kind: 'function', env: env, body, arguments: (args.value as EAtom[]).map((a) => a.value) },
    }
  } else if (
    expression.kind === 'list' &&
    expression.value.length !== 0 &&
    expression.value[0].kind === 'atom' &&
    expression.value[0].value === 'if'
  ) {
    const equationResult = evaluateExpression(expression.value[1], env)
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
      return evaluateExpression(expression.value[2], env)
    } else {
      return evaluateExpression(expression.value[3], env)
    }
  } else if (expression.kind === 'list') {
    const evaluatedExpressionsWithErrors = expression.value.map((e) => evaluateExpression(e, env))
    const errors = evaluatedExpressionsWithErrors.filter((e) => 'error' in e)
    if (errors.length !== 0) {
      return errors[0] // TODO return all errors
    }
    const evaluatedExpressions = (evaluatedExpressionsWithErrors as { result: EvalAST }[]).map((e) => e.result)
    if (evaluatedExpressions[0].kind !== 'function' && evaluatedExpressions[0].kind !== 'intrinsicFunction') {
      return { error: 'Expression not callable', span: evaluatedExpressions[0].span }
    }
    const fn = evaluatedExpressions[0]
    const args = evaluatedExpressions.slice(1)
    if (fn.kind === 'intrinsicFunction') {
      return fn.value(args)
    } else {
      if (fn.arguments.length !== args.length) {
        return { error: `Expected ${fn.arguments.length} arguments, got ${args.length}`, span: expression.span }
      }
      return evaluateExpression(fn.body, [...fn.env, ...fn.arguments.map((arg, i) => ({ name: arg, value: args[i] }))])
    }
  } else if (expression.kind === 'atom' && !isBoolean(expression)) {
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

function isBoolean(e: EvalAST): e is typeof e & { kind: 'atom'; value: 'false' | 'true' } {
  return e.kind === 'atom' && (e.value === 'false' || e.value === 'true')
}
