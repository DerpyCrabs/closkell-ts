import { expect, test } from 'bun:test'
import { evaluateExpression, EvaluationError } from './evaluation.ts'
import { intrinsics } from './intrinsics.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { EFunction, EvalAST } from './types.ts'

test('Primitive functions', () => {
  test('Arithmetic operations', () => {
    expect(parseAndEval('(+ 3 (- 5 2 1))')).toEqual({ result: { kind: 'number', value: 5 } })
    expect(parseAndEval('(* 3 2 (/ 6 2 1))')).toEqual({ result: { kind: 'number', value: 18 } })
    expect(parseAndEval('(> 5 1)')).toEqual({ result: { kind: 'atom', value: 'true' } })
    expect(parseAndEval('(< 5 1)')).toEqual({ result: { kind: 'atom', value: 'false' } })
  })

  test('String operations', () => {
    expect(parseAndEval('(string/concat "t" "d" "k")')).toEqual({ result: { kind: 'string', value: 'tdk' } })
  })
})

test('User-defined functions', () => {
  test('defining functions', () => {
    const fnDef = (parseAndEval('(fn [a b] (+ a b))') as { result: EFunction }).result
    expect(fnDef.kind).toBe('function')
    expect(fnDef.arguments).toEqual(['a', 'b'])
    expect(fnDef.body).toEqual({
      kind: 'list',
      span: {
        end: 17,
        start: 10,
      },
      value: [
        {
          kind: 'atom',
          span: {
            end: 12,
            start: 11,
          },
          value: '+',
        },
        {
          kind: 'atom',
          span: {
            end: 14,
            start: 13,
          },
          value: 'a',
        },
        {
          kind: 'atom',
          span: {
            end: 16,
            start: 15,
          },
          value: 'b',
        },
      ],
    })
  })

  test('calling defined function', () => {
    expect(parseAndEval('((fn [a b] (+ a b)) 2 3)')).toEqual({ result: { kind: 'number', value: 5 } })
  })
})

test('Booleans', () => {
  test('using if', () => {
    expect(parseAndEval('(if true 5 3)')).toEqual({
      result: {
        kind: 'number',
        span: {
          end: 10,
          start: 9,
        },
        value: 5,
      },
    })
    expect(parseAndEval('(if (if true false true) 5 3)')).toEqual({
      result: { kind: 'number', value: 3, span: { start: 27, end: 28 } },
    })
    expect(parseAndEval('(if 1 5 3)')).toEqual({
      error: 'Expected true or false, got number',
      span: { start: 4, end: 5 },
    })

    expect(parseAndEval('(if (= 5 5) 5 3)')).toEqual({
      result: { kind: 'number', value: 5, span: { start: 12, end: 13 } },
    })
  })
})

test('let expression', () => {
  test('single binding let', () => {
    expect(parseAndEval('(let [a 5] a)')).toEqual({ result: { kind: 'number', value: 5, span: { start: 8, end: 9 } } })

    expect(parseAndEval('(let [a (fn [a] (+ a a))] (a 5))')).toEqual({ result: { kind: 'number', value: 10 } })
  })

  test('multiple bindings let', () => {
    expect(parseAndEval('(let [a 5 b 10] (+ a b))')).toEqual({ result: { kind: 'number', value: 15 } })

    expect(parseAndEval('(let [a (fn [a] (+ a a)) b (fn [a b] (+ a b))] (b (a 5) 7))')).toEqual({
      result: { kind: 'number', value: 17 },
    })
  })

  test('recursive function definition in let', () => {
    expect(parseAndEval('(let [a (fn [n] (if (= n 0) 7 (+ 1 (a (- n 1)))))] (a 5))')).toEqual({
      result: { kind: 'number', value: 12 },
    })
  })
})

function parseAndEval(source: string): { result: EvalAST } | ASTParsingError | EvaluationError {
  const ast = parseToAST(source)
  if ('error' in ast) {
    return ast
  }
  return evaluateExpression(ast.result, intrinsics)
}
