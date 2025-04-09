import { EvalAST, Binding, Span, EAtom } from './types.ts'
import * as R from 'ramda'
import { isBoolean, isFunctionDef, isIfBlock, isLetBlock, isList } from './matchers.ts'

export type EvaluationError = { error: string; span?: Span }
export type EvaluationResult = { result: EvalAST } | EvaluationError

export function evaluateExpression(
  expression: EvalAST,
  env: Binding[]
): { result: EvalAST } | { error: string; span?: Span } {
  if (isFunctionDef(expression)) {
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
      result: { kind: 'function', env: env, body, arguments: (args.value as EAtom[]).map((a) => a.value) },
    }
  } else if (isLetBlock(expression)) {
    if (expression.value.length !== 3) {
      return { error: 'Incomplete let definition', span: expression.span }
    }
    if (expression.value[1].kind !== 'vector') {
      return {
        error: `Expected vector as first let argument, got ${expression.value[1].kind}`,
        span: expression.value[1].span,
      }
    }
    if (expression.value[1].value.length % 2 !== 0) {
      return {
        error: `Incomplete let binding`,
        span: expression.value[1].span,
      }
    }
    const bindingPairs: [EvalAST, EvalAST][] = R.splitEvery(2, expression.value[1].value) as [EvalAST, EvalAST][]
    const incorrectBind = bindingPairs.map((p) => p[0]).find((b) => b.kind !== 'atom')
    if (incorrectBind) {
      return { error: `Expected atom got ${incorrectBind.kind}`, span: incorrectBind.span }
    }
    const evaluatedBindingPairs = bindingPairs.map(
      (p) =>
        [
          p[0],
          evaluateExpression(p[1], [
            ...env,
            ...bindingPairs.map((p) => ({
              name: (p[0] as EAtom).value,
              value: p[1],
            })),
          ]),
        ] as const
    )
    const evaluatedBindError = evaluatedBindingPairs.find((p) => 'error' in p[1])
    if (evaluatedBindError) {
      return evaluatedBindError[1]
    }
    return evaluateExpression(expression.value[2], [
      ...env,
      ...evaluatedBindingPairs.map((p) => ({
        name: (p[0] as EAtom).value,
        value: (p[1] as { result: EvalAST }).result,
      })),
    ])
  } else if (isIfBlock(expression)) {
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
  } else if (isList(expression)) {
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
    const binding = env.findLast((b) => b.name === expression.value)
    if (binding) {
      if (isFunctionDef(binding.value)) {
        return evaluateExpression(binding.value, env)
      } else {
        return { result: binding.value }
      }
    } else {
      return { error: `Unknown atom ${expression.value}`, span: expression.span }
    }
  } else {
    return { result: expression }
  }
}
