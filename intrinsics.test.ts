import { describe, expect, test } from 'bun:test'
import { evaluateExpression, EvaluationError } from './evaluation'
import { intrinsics } from './intrinsics'
import { ASTParsingError, parseToAST } from './parsing'
import { EvalAST } from './types'

function parseAndEval(source: string): { result: EvalAST } | ASTParsingError | EvaluationError {
  const ast = parseToAST(source)
  if ('error' in ast) {
    return ast
  }
  return evaluateExpression(ast.result, intrinsics)
}

describe('intrinsics', () => {
  describe('arithmetic operations', () => {
    test('addition', () => {
      expect(parseAndEval('(+ 1 2 3)')).toEqual({ result: { kind: 'number', value: 6 } })
    })

    test('subtraction', () => {
      expect(parseAndEval('(- 10 3 2)')).toEqual({ result: { kind: 'number', value: 5 } })
    })

    test('multiplication', () => {
      expect(parseAndEval('(* 2 3 4)')).toEqual({ result: { kind: 'number', value: 24 } })
    })

    test('division', () => {
      expect(parseAndEval('(/ 24 2 3)')).toEqual({ result: { kind: 'number', value: 4 } })
    })
  })

  describe('comparison operations', () => {
    test('equality', () => {
      expect(parseAndEval('(= 1 1)')).toEqual({ result: { kind: 'atom', value: 'true' } })
      expect(parseAndEval('(= 1 2)')).toEqual({ result: { kind: 'atom', value: 'false' } })
    })

    test('inequality', () => {
      expect(parseAndEval('(!= 1 2)')).toEqual({ result: { kind: 'atom', value: 'true' } })
      expect(parseAndEval('(!= 1 1)')).toEqual({ result: { kind: 'atom', value: 'false' } })
    })

    test('greater than', () => {
      expect(parseAndEval('(> 2 1)')).toEqual({ result: { kind: 'atom', value: 'true' } })
      expect(parseAndEval('(> 1 2)')).toEqual({ result: { kind: 'atom', value: 'false' } })
    })

    test('less than', () => {
      expect(parseAndEval('(< 1 2)')).toEqual({ result: { kind: 'atom', value: 'true' } })
      expect(parseAndEval('(< 2 1)')).toEqual({ result: { kind: 'atom', value: 'false' } })
    })
  })

  describe('string operations', () => {
    test('string concatenation', () => {
      expect(parseAndEval('(string/concat "hello" " " "world")')).toEqual({ result: { kind: 'string', value: 'hello world' } })
    })
  })

  describe('error handling', () => {
    test('type mismatch in arithmetic operations', () => {
      expect(parseAndEval('(+ 1 "2")')).toEqual({
        error: 'Expected number, received string',
        span: { start: 5, end: 8 }
      })
    })

    test('type mismatch in comparison operations', () => {
      expect(parseAndEval('(= 1 "1")')).toEqual({
        error: 'Expected number, received string',
        span: { start: 5, end: 8 }
      })
    })

    test('type mismatch in string operations', () => {
      expect(parseAndEval('(string/concat "hello" 123)')).toEqual({
        error: 'Expected string, received number',
        span: { start: 23, end: 26 }
      })
    })
  })
}) 