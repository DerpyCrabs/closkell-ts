import { assertEquals } from 'asserts'
import { evaluateExpression, EvaluationError } from './evaluation.ts'
import { intrinsics } from './intrinsics.ts'
import { ASTParsingError, parseToAST } from './parsing.ts'
import { EvalAST } from './types.ts'

Deno.test('Primitive functions', async (t) => {
  await t.step('Arithmetic operations', () => {
    assertEquals(parseAndEval('(+ 3 (- 5 2 1))'), { result: { kind: 'number', value: 5 } })
    assertEquals(parseAndEval('(* 3 2 (/ 6 2 1))'), { result: { kind: 'number', value: 18 } })
    assertEquals(parseAndEval('(> 5 1)'), { result: { kind: 'atom', value: 'true' } })
    assertEquals(parseAndEval('(< 5 1)'), { result: { kind: 'atom', value: 'false' } })
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

    assertEquals(parseAndEval('(if (= 5 5) 5 3)'), {
      result: { kind: 'number', value: 5, span: { start: 12, end: 13 } },
    })
  })
})

Deno.test('let expression', async (t) => {
  await t.step('single binding let', () => {
    assertEquals(parseAndEval('(let [a 5] a)'), { result: { kind: 'number', value: 5, span: { start: 8, end: 9 } } })

    assertEquals(parseAndEval('(let [a (fn [a] (+ a a))] (a 5))'), { result: { kind: 'number', value: 10 } })
  })

  await t.step('multiple bindings let', () => {
    assertEquals(parseAndEval('(let [a 5 b 10] (+ a b))'), { result: { kind: 'number', value: 15 } })

    assertEquals(parseAndEval('(let [a (fn [a] (+ a a)) b (fn [a b] (+ a b))] (b (a 5) 7))'), {
      result: { kind: 'number', value: 17 },
    })
  })

  await t.step('recursive function definition in let', () => {
    assertEquals(parseAndEval('(let [a (fn [n] (if (= n 0) 7 (+ 1 (a (- n 1)))))] (a 5))'), {
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
