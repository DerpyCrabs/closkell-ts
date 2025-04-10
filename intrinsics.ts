import { EIntrinsicFunction, ENumber, EString, Binding, EvalAST, EList, EAtom, EVector, EMap } from './types.ts'
import { evaluateExpression } from './evaluation.ts'
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
    name: '=',
    value: nAryNumberBooleanOperation((a, b) => a === b),
  },
  {
    name: '!=',
    value: nAryNumberBooleanOperation((a, b) => a !== b),
  },
  {
    name: '>',
    value: nAryNumberBooleanOperation((a, b) => a > b),
  },
  {
    name: '<',
    value: nAryNumberBooleanOperation((a, b) => a < b),
  },
  {
    name: '<=',
    value: nAryNumberBooleanOperation((a, b) => a <= b),
  },
  {
    name: '>=',
    value: nAryNumberBooleanOperation((a, b) => a >= b),
  },
  {
    name: 'string/concat',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length < 1) {
          return { error: 'Expected at least one argument' }
        }
        const notString = args.find(a => a.kind !== 'string')
        if (notString) {
          return { 
            error: `Expected string, received ${notString.kind}`,
            span: 'span' in notString ? notString.span : undefined
          }
        }
        const result = args.map(a => (a as EString).value).join('')
        return {
          result: {
            kind: 'string',
            value: result
          }
        }
      }
    }
  },
  {
    name: 'empty?',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length !== 1) {
          return { error: 'Expected exactly one argument' }
        }
        const arg = args[0]
        if (arg.kind === 'list' || arg.kind === 'vector') {
          return {
            result: {
              kind: 'atom',
              value: (arg.value.length === 0) ? 'true' : 'false'
            }
          }
        }
        return { error: `Expected list or vector, received ${arg.kind}` }
      }
    }
  },
  {
    name: 'nil?',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length !== 1) {
          return { error: 'Expected exactly one argument' }
        }
        const arg = args[0]
        if (arg.kind === 'atom' && (arg as EAtom).value === 'nil') {
          return {
            result: {
              kind: 'atom',
              value: 'true'
            }
          }
        }
        return {
          result: {
            kind: 'atom',
            value: 'false'
          }
        }
      }
    }
  },
  {
    name: 'get',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length !== 2) {
          return { error: 'Expected exactly two arguments' }
        }
        const [collection, key] = args
        
        // Handle lists and vectors
        if (collection.kind === 'list' || collection.kind === 'vector') {
          if (key.kind !== 'number') {
            return { error: `Expected number for index, received ${key.kind}` }
          }
          const value = collection.kind === 'list' ? 
            (collection as EList).value : 
            (collection as EVector).value
          const index = (key as ENumber).value
          if (index < 0 || index >= value.length) {
            return { error: 'Index out of bounds' }
          }
          const result = value[index]
          // Remove span information from the result
          if ('span' in result) {
            const { span, ...rest } = result
            return { result: rest as EvalAST }
          }
          return { result }
        }
        
        // Handle maps
        if (collection.kind === 'map') {
          if (key.kind !== 'atom') {
            return { error: `Expected keyword for map lookup, received ${key.kind}` }
          }
          const mapEntries = (collection as EMap).value
          const keyStr = (key as EAtom).value
          
          // Handle keyword lookups (e.g. :value)
          for (let i = 0; i < mapEntries.length; i += 2) {
            const mapKey = mapEntries[i]
            if (mapKey.kind === 'atom' && (mapKey as EAtom).value === keyStr) {
              const result = mapEntries[i + 1]
              // Remove span information from the result
              if ('span' in result) {
                const { span, ...rest } = result
                return { result: rest as EvalAST }
              }
              return { result }
            }
          }
          return { error: `Key not found: ${keyStr}` }
        }
        
        return { error: `Cannot get from ${collection.kind}` }
      }
    }
  },
  {
    name: 'type',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length !== 1) {
          return { error: 'Expected exactly one argument' }
        }
        const arg = args[0]
        let typeStr: string
        switch (arg.kind) {
          case 'number':
            typeStr = 'number'
            break
          case 'string':
            typeStr = 'string'
            break
          case 'atom':
            typeStr = 'atom'
            break
          case 'list':
            typeStr = 'list'
            break
          case 'vector':
            typeStr = 'vector'
            break
          case 'map':
            typeStr = 'map'
            break
          case 'function':
            typeStr = 'function'
            break
          case 'intrinsicFunction':
            typeStr = 'intrinsicFunction'
            break
          default:
            typeStr = 'unknown'
        }
        return {
          result: {
            kind: 'atom',
            value: typeStr
          }
        }
      }
    }
  },
  {
    name: 'and',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length < 2) {
          return { error: 'Expected at least two arguments' }
        }
        for (const arg of args) {
          if (arg.kind !== 'atom') {
            return { error: `Expected atom, received ${arg.kind}` }
          }
          if ((arg as EAtom).value === 'false') {
            return {
              result: {
                kind: 'atom',
                value: 'false'
              }
            }
          }
        }
        return {
          result: {
            kind: 'atom',
            value: 'true'
          }
        }
      }
    }
  },
  {
    name: 'first',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length !== 1) {
          return { error: 'Expected exactly one argument' }
        }
        const arg = args[0]
        if (arg.kind === 'list' || arg.kind === 'vector') {
          if (arg.value.length === 0) {
            return { error: 'Cannot get first element of empty collection' }
          }
          return { result: arg.value[0] }
        }
        return { error: `Expected list or vector, received ${arg.kind}` }
      }
    }
  },
  {
    name: 'rest',
    value: {
      kind: 'intrinsicFunction',
      value: (args: EvalAST[]) => {
        if (args.length !== 1) {
          return { error: 'Expected exactly one argument' }
        }
        const arg = args[0]
        if (arg.kind === 'list' || arg.kind === 'vector') {
          if (arg.value.length === 0) {
            return { error: 'Cannot get rest of empty collection' }
          }
          return {
            result: {
              kind: arg.kind,
              value: arg.value.slice(1)
            }
          }
        }
        return { error: `Expected list or vector, received ${arg.kind}` }
      }
    }
  }
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

function nAryNumberBooleanOperation(binaryOp: (a: number, b: number) => boolean): EIntrinsicFunction {
  return {
    kind: 'intrinsicFunction',
    value: (args: EvalAST[]) => {
      if (args.every((a) => a.kind === 'number')) {
        const numbers = args.map((a) => (a as ENumber).value);
        const result = R.all(([a, b]) => binaryOp(a, b), R.zip(numbers, numbers.slice(1)));
        return {
          result: {
            kind: 'atom',
            value: result ? 'true' : 'false',
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
