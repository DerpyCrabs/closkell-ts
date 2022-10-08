import { EList, EvalAST, MacrosAST } from './types.ts'

export type TypeGuard<Input, Output extends Input> = (value: Input) => value is Output

export function and<I, O extends I, O2 extends O>(f: TypeGuard<I, O>, g: TypeGuard<O, O2>): TypeGuard<I, O2> {
  return (value: I): value is O2 => f(value) && g(value)
}

export function isAtomWithValue<Value extends string>(
  value: Value
): <Expression extends EvalAST>(expression: Expression) => expression is Expression & { kind: 'atom'; value: Value } {
  return <Expression extends EvalAST>(e: Expression): e is Expression & { kind: 'atom'; value: Value } => {
    return e.kind === 'atom' && e.value === value
  }
}

export function isList<Expression extends EvalAST>(expression: Expression): expression is Expression & EList {
  return expression.kind === 'list'
}

export function isBoolean<Expression extends EvalAST | MacrosAST>(
  e: Expression
): e is typeof e & { kind: 'atom'; value: 'false' | 'true' } {
  return e.kind === 'atom' && (e.value === 'false' || e.value === 'true')
}

export function firstElemMatches<Expression extends EList, Elem extends EList['value'][0], O extends Elem>(
  f: TypeGuard<Elem, O>
): (list: Expression) => list is Expression & { value: [O, ...EvalAST[]] } {
  return (list): list is Expression & { value: [O, ...EvalAST[]] } => f(list.value[0] as Elem) as boolean
}

export const isFunctionDef = and(isList, firstElemMatches(isAtomWithValue('fn')))
export const isIfBlock = and(isList, firstElemMatches(isAtomWithValue('if')))
export const isLetBlock = and(isList, firstElemMatches(isAtomWithValue('let')))
