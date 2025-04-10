import { EvalAST, Binding, Span, EAtom, EFunction } from './types.ts'
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
      result: { 
        kind: 'function', 
        env, 
        body, 
        arguments: (args.value as EAtom[]).map((a) => a.value),
        span: expression.span
      }
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
  } else if (expression.kind === 'list' && expression.value.length > 0) {
    const evaluatedExpressionsWithErrors = expression.value.map((e) => evaluateExpression(e, env))
    const errors = evaluatedExpressionsWithErrors.filter((e) => 'error' in e)
    if (errors.length !== 0) {
      return errors[0] // TODO return all errors
    }
    const evaluatedExpressions = (evaluatedExpressionsWithErrors as { result: EvalAST }[]).map((e: { result: EvalAST }) => e.result)
    const first = evaluatedExpressions[0]
    if (first.kind === 'atom' && first.value.startsWith(':')) {
      // Handle keyword lookup
      if (evaluatedExpressions.length !== 2) {
        return { error: `Expected exactly one argument for keyword lookup, got ${evaluatedExpressions.length - 1}`, span: expression.span }
      }
      const target = evaluatedExpressions[1]
      if (target.kind !== 'map') {
        return { error: `Expected map for keyword lookup, got ${target.kind}`, span: expression.span }
      }
      const key = first.value.slice(1)
      for (let i = 0; i < target.value.length; i += 2) {
        const mapKey = target.value[i]
        if (mapKey.kind === 'atom' && mapKey.value === `:${key}`) {
          return { result: target.value[i + 1] }
        }
      }
      return { error: `Key not found: ${first.value}`, span: expression.span }
    }
    if (first.kind !== 'function' && first.kind !== 'intrinsicFunction') {
      return { error: `Expression not callable: ${first.kind}`, span: first.span }
    }
    const fn = first
    const args = evaluatedExpressions.slice(1)
    if (fn.kind === 'intrinsicFunction') {
      return fn.value(args)
    } else if (fn.kind === 'function') {
      if (args.length > fn.arguments.length) {
        return { error: `Expected ${fn.arguments.length} arguments, got ${args.length}`, span: expression.span }
      }
      
      // Create new bindings for the provided arguments
      const newEnv: Binding[] = [
        ...fn.env,
        ...fn.arguments.slice(0, args.length).map((arg: string, i: number): Binding => ({
          name: arg,
          value: args[i]
        }))
      ]
      
      if (args.length === fn.arguments.length) {
        // All arguments provided, evaluate the body
        const result = evaluateExpression(fn.body, newEnv)
        if ('error' in result) {
          return result
        }
        // If the result is a function, update its environment
        if (result.result.kind === 'function') {
          return {
            result: {
              ...result.result,
              env: newEnv
            }
          }
        }
        return result
      } else {
        // Partial application - return a new function with remaining arguments
        return {
          result: {
            kind: 'function' as const,
            env: newEnv,
            arguments: fn.arguments.slice(args.length),
            body: fn.body,
            span: fn.span
          }
        }
      }
    }
    // This branch should never be reached due to the type guard above
    return { error: 'Unexpected function kind', span: expression.span }
  } else if (expression.kind === 'vector') {
    const evaluatedExpressionsWithErrors = expression.value.map((e) => evaluateExpression(e, env))
    const errors = evaluatedExpressionsWithErrors.filter((e) => 'error' in e)
    if (errors.length !== 0) {
      return errors[0] // TODO return all errors
    }
    const evaluatedExpressions = (evaluatedExpressionsWithErrors as { result: EvalAST }[]).map((e) => e.result)
    return {
      result: {
        kind: 'vector',
        value: evaluatedExpressions,
        span: expression.span
      }
    }
  } else if (expression.kind === 'atom') {
    if (isBoolean(expression)) {
      return { result: expression }
    }
    if (expression.value === 'nil') {
      return { result: expression }
    }
    if (expression.value.startsWith(':')) {
      // Handle keyword lookup
      const binding = env.findLast((b) => b.name === expression.value)
      if (binding) {
        return { result: binding.value }
      }
      return { result: expression }
    }
    const binding = env.findLast((b) => b.name === expression.value)
    if (!binding) {
      return { error: `Unknown atom ${expression.value}`, span: expression.span }
    }
    if (isFunctionDef(binding.value)) {
      return evaluateExpression(binding.value, env)
    }
    return { result: binding.value }
  } else if (expression.kind === 'map') {
    const evaluatedExpressionsWithErrors = expression.value.map((e) => evaluateExpression(e, env))
    const errors = evaluatedExpressionsWithErrors.filter((e) => 'error' in e)
    if (errors.length !== 0) {
      return errors[0] // TODO return all errors
    }
    const evaluatedExpressions = (evaluatedExpressionsWithErrors as { result: EvalAST }[]).map((e) => e.result)
    return {
      result: {
        kind: 'map',
        value: evaluatedExpressions,
        span: expression.span
      }
    }
  } else {
    return { result: expression }
  }
}
