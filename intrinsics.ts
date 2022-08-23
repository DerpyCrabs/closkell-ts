import { EIntrinsicFunction, ENumber, EString, Binding, EvalAST } from './types.ts'
import * as R from 'ramda'

export const intrinsics: Binding[] = [
  {
    name: '+',
    value: nAryNumberOperation((a, b) => a + b),
  },
  {
    name: '-',
    value: nAryNumberOperation((a, b) => a - b),
  },
  {
    name: '*',
    value: nAryNumberOperation((a, b) => a * b),
  },
  {
    name: '/',
    value: nAryNumberOperation((a, b) => a / b),
  },
  {
    name: 'string/concat',
    value: nAryStringOperation((a, b) => a + b),
  },
]

function nAryNumberOperation(binaryOp: (a: number, b: number) => number): EIntrinsicFunction {
  return {
    kind: 'intrinsicFunction',
    value: (args: EvalAST[]) => {
      if (args.every((a) => a.kind === 'number')) {
        return {
          result: {
            kind: 'number',
            value: R.reduce(
              binaryOp,
              (args[0] as ENumber).value,
              args.slice(1).map((a) => (a as ENumber).value)
            ),
          },
        }
      } else {
        const notNumber = args.find((a) => a.kind !== 'number') as EvalAST
        return {
          error: `Expected number, received ${notNumber.kind}`,
          span: 'span' in notNumber ? notNumber.span : undefined,
        }
      }
    },
  }
}

function nAryStringOperation(binaryOp: (a: string, b: string) => string): EIntrinsicFunction {
  return {
    kind: 'intrinsicFunction',
    value: (args: EvalAST[]) => {
      if (args.every((a) => a.kind === 'string')) {
        return {
          result: {
            kind: 'string',
            value: R.reduce(
              binaryOp,
              (args[0] as EString).value,
              args.slice(1).map((a) => (a as EString).value)
            ),
          },
        }
      } else {
        const notString = args.find((a) => a.kind !== 'string') as EvalAST
        return {
          error: `Expected string, received ${notString.kind}`,
          span: 'span' in notString ? notString.span : undefined,
        }
      }
    },
  }
}
