import { expect, test, describe } from 'bun:test'
import { evaluateExpression, EvaluationError } from './evaluation.ts'
import { intrinsics } from './intrinsics.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { EFunction, EvalAST } from './types.ts'

describe('evaluation', () => {
  describe('primitive functions', () => {
    describe('arithmetic operations', () => {
      test('addition and subtraction', () => {
        expect(parseAndEval('(+ 3 (- 5 2 1))')).toEqual({ result: { kind: 'number', value: 5 } })
      })

      test('multiplication and division', () => {
        expect(parseAndEval('(* 3 2 (/ 6 2 1))')).toEqual({ result: { kind: 'number', value: 18 } })
      })

      test('comparison operations', () => {
        expect(parseAndEval('(> 5 1)')).toEqual({ result: { kind: 'atom', value: 'true' } })
        expect(parseAndEval('(< 5 1)')).toEqual({ result: { kind: 'atom', value: 'false' } })
      })
    })

    describe('string operations', () => {
      test('string concatenation', () => {
        expect(parseAndEval('(string/concat "t" "d" "k")')).toEqual({ result: { kind: 'string', value: 'tdk' } })
      })
    })
  })

  describe('user-defined functions', () => {
    describe('function definition', () => {
      test('basic function definition', () => {
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

      test('function application', () => {
        expect(parseAndEval('((fn [a b] (+ a b)) 2 3)')).toEqual({ result: { kind: 'number', value: 5 } })
      })
    })
  })

  describe('booleans', () => {
    describe('if expressions', () => {
      test('basic if expression', () => {
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
      })

      test('nested if expressions', () => {
        expect(parseAndEval('(if (if true false true) 5 3)')).toEqual({
          result: { kind: 'number', value: 3, span: { start: 27, end: 28 } },
        })
      })

      test('non-boolean condition', () => {
        expect(parseAndEval('(if 1 5 3)')).toEqual({
          error: 'Expected true or false, got number',
          span: { start: 4, end: 5 },
        })
      })

      test('if with comparison', () => {
        expect(parseAndEval('(if (= 5 5) 5 3)')).toEqual({
          result: { kind: 'number', value: 5, span: { start: 12, end: 13 } },
        })
      })
    })
  })

  describe('let expressions', () => {
    describe('single binding', () => {
      test('basic let binding', () => {
        expect(parseAndEval('(let [a 5] a)')).toEqual({ result: { kind: 'number', value: 5, span: { start: 8, end: 9 } } })
      })

      test('let with function definition', () => {
        expect(parseAndEval('(let [a (fn [a] (+ a a))] (a 5))')).toEqual({ result: { kind: 'number', value: 10 } })
      })
    })

    describe('multiple bindings', () => {
      test('basic multiple bindings', () => {
        expect(parseAndEval('(let [a 5 b 10] (+ a b))')).toEqual({ result: { kind: 'number', value: 15 } })
      })

      test('multiple function bindings', () => {
        expect(parseAndEval('(let [a (fn [a] (+ a a)) b (fn [a b] (+ a b))] (b (a 5) 7))')).toEqual({
          result: { kind: 'number', value: 17 },
        })
      })
    })

    describe('recursive functions', () => {
      test('recursive function in let', () => {
        expect(parseAndEval('(let [a (fn [n] (if (= n 0) 7 (+ 1 (a (- n 1)))))] (a 5))')).toEqual({
          result: { kind: 'number', value: 12 },
        })
      })
    })
  })

  describe('error handling', () => {
    describe('function definition errors', () => {
      test('wrong number of arguments', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'fn' },
            { kind: 'vector', value: [] }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Incomplete function definition')
        }
      })

      test('non-vector arguments', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'fn' },
            { kind: 'list', value: [] },
            { kind: 'number', value: 42 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Function arguments should be in vector')
        }
      })

      test('invalid argument types', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'fn' },
            { kind: 'vector', value: [{ kind: 'number', value: 42 }] },
            { kind: 'number', value: 42 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Invalid argument')
        }
      })
    })

    describe('let expression errors', () => {
      test('incomplete let definition', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'let' },
            { kind: 'vector', value: [] }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Incomplete let definition')
        }
      })

      test('non-vector bindings', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'let' },
            { kind: 'list', value: [] },
            { kind: 'number', value: 42 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Expected vector as first let argument, got list')
        }
      })

      test('odd number of bindings', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'let' },
            { kind: 'vector', value: [{ kind: 'atom', value: 'x' }] },
            { kind: 'number', value: 42 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Incomplete let binding')
        }
      })

      test('non-atom binding names', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'let' },
            { kind: 'vector', value: [
              { kind: 'number', value: 42 },
              { kind: 'number', value: 42 }
            ] },
            { kind: 'number', value: 42 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Expected atom got number')
        }
      })
    })

    describe('if expression errors', () => {
      test('non-boolean condition', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'if' },
            { kind: 'number', value: 42 },
            { kind: 'number', value: 1 },
            { kind: 'number', value: 2 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Expected true or false, got number')
        }
      })

      test('wrong number of arguments', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'atom', value: 'if' },
            { kind: 'atom', value: 'true' },
            { kind: 'number', value: 1 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('If takes 3 arguments, got 2')
        }
      })
    })

    describe('list evaluation errors', () => {
      test('non-function expressions', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'number', value: 42 },
            { kind: 'number', value: 1 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toContain('Expression not callable: number')
        }
      })

      test('wrong number of arguments for function calls', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'list', value: [
              { kind: 'atom', value: 'fn' },
              { kind: 'vector', value: [{ kind: 'atom', value: 'x' }] },
              { kind: 'atom', value: 'x' }
            ] },
            { kind: 'number', value: 1 },
            { kind: 'number', value: 2 }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Expected 1 arguments, got 2')
        }
      })

      test('error propagation from subexpressions', () => {
        const expr: EvalAST = {
          kind: 'list',
          value: [
            { kind: 'list', value: [
              { kind: 'atom', value: 'fn' },
              { kind: 'vector', value: [{ kind: 'atom', value: 'x' }] },
              { kind: 'atom', value: 'x' }
            ] },
            { kind: 'atom', value: 'unknown' }
          ],
          span: { start: 0, end: 0 }
        }
        const result = evaluateExpression(expr, [])
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error).toBe('Unknown atom unknown')
        }
      })
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
