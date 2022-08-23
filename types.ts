export type Span = {
  start: number
  end: number
}

export type PString = {
  kind: 'string'
  value: string
}
export type PAtom = {
  kind: 'atom'
  value: string
}
export type PNumber = {
  kind: 'number'
  value: number
}

export type PList = {
  kind: 'list'
  value: ParserAST[]
}

export type PVector = {
  kind: 'vector'
  value: ParserAST[]
}

export type PMap = {
  kind: 'map'
  value: ParserAST[]
}

export type ParserAST = (PString | PAtom | PNumber | PList | PVector | PMap) & { span: Span }

export type EString = {
  kind: 'string'
  value: string
}
export type EAtom = {
  kind: 'atom'
  value: string
}
export type ENumber = {
  kind: 'number'
  value: number
}

export type EList = {
  kind: 'list'
  value: EvalAST[]
  env?: Binding[]
}

export type EVector = {
  kind: 'vector'
  value: EvalAST[]
  env?: Binding[]
}

export type EMap = {
  kind: 'map'
  value: EvalAST[]
  env?: Binding[]
}

export type EFunction = {
  kind: 'function'
  body: EvalAST
  arguments: string[]
  env: Binding[]
}

export type EIntrinsicFunction = {
  kind: 'intrinsicFunction'
  value: (args: EvalAST[]) => { result: EvalAST } | { error: string; span?: Span }
}

export type EvalAST = (EString | EAtom | ENumber | EList | EVector | EMap | EFunction | EIntrinsicFunction) & {
  span?: Span
}

export type Binding = { name: string; value: EvalAST }

export type MString = {
  kind: 'string'
  value: string
}
export type MAtom = {
  kind: 'atom'
  value: string
}
export type MNumber = {
  kind: 'number'
  value: number
}

export type MList = {
  kind: 'list'
  value: MacrosAST[]
  env?: MacrosBinding[]
}

export type MVector = {
  kind: 'vector'
  value: MacrosAST[]
  env?: MacrosBinding[]
}

export type MMap = {
  kind: 'map'
  value: MacrosAST[]
  env?: MacrosBinding[]
}

export type MFunction = {
  kind: 'function'
  body: MacrosAST
  arguments: string[]
  env: MacrosBinding[]
}

export type MMacro = {
  kind: 'macro'
  body: MacrosAST
  arguments: string[]
  env: MacrosBinding[]
}

export type MacrosAST = (
  | MString
  | MAtom
  | MNumber
  | MList
  | MVector
  | MMap
  | MFunction
  | EIntrinsicFunction
  | MMacro
) & {
  span?: Span
}

export type MacrosBinding = { name: string; value: MacrosAST }
