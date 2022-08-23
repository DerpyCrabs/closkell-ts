import { assertEquals } from 'asserts'
import { evaluateExpression, EvaluationError } from './evaluation.ts'
import { intrinsics } from './intrinsics.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { EvalAST } from './types.ts'

Deno.test('Primitive functions', async (t) => {
  await t.step('Arithmetic operations', () => {
    assertEquals(parseAndEval('(+ 3 (- 5 2 1))'), { result: { kind: 'number', value: 5 } })
    assertEquals(parseAndEval('(* 3 2 (/ 6 2 1))'), { result: { kind: 'number', value: 18 } })
  })

  await t.step('String operations', () => {
    assertEquals(parseAndEval('(string/concat "t" "d" "k")'), { result: { kind: 'string', value: 'tdk' } })
  })
})

Deno.test('User-defined functions', async (t) => {
  await t.step('defining functions', () => {
    const fnDef = (parseAndEval('(fn [a b] (+ a b))') as any).result
    assertEquals(fnDef.kind, 'function')
    assertEquals(fnDef.arguments, ['a', 'b'])
    assertEquals(fnDef.body, {
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

  await t.step('calling defined function', () => {
    assertEquals(parseAndEval('((fn [a b] (+ a b)) 2 3)'), { result: { kind: 'number', value: 5 } })
  })
})

Deno.test('Booleans', async (t) => {
  await t.step('using if', () => {
    assertEquals(parseAndEval('(if true 5 3)'), {
      result: {
        kind: 'number',
        span: {
          end: 10,
          start: 9,
        },
        value: 5,
      },
    })
    assertEquals(parseAndEval('(if (if true false true) 5 3)'), {
      result: { kind: 'number', value: 3, span: { start: 27, end: 28 } },
    })
    assertEquals(parseAndEval('(if 1 5 3)'), {
      error: 'Expected true or false, got number',
      span: { start: 4, end: 5 },
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
