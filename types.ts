export type Span = {
  start: number
  end: number
}

export type PString = {
  kind: 'string'
  value: string
  span: Span
}
export type PAtom = {
  kind: 'atom'
  value: string
  span: Span
}
export type PNumber = {
  kind: 'number'
  value: number
  span: Span
}

export type PList = {
  kind: 'list'
  value: ParserAST[]
  span: Span
}

export type PVector = {
  kind: 'vector'
  value: ParserAST[]
  span: Span
}

export type PMap = {
  kind: 'map'
  value: ParserAST[]
  span: Span
}

export type ParserAST = PString | PAtom | PNumber | PList | PVector | PMap

export type EString = {
  kind: 'string'
  value: string
  span?: Span
}
export type EAtom = {
  kind: 'atom'
  value: string
  span?: Span
}
export type ENumber = {
  kind: 'number'
  value: number
  span?: Span
}

export type EList = {
  kind: 'list'
  value: EvalAST[]
  env?: Binding[]
  span?: Span
}

export type EVector = {
  kind: 'vector'
  value: EvalAST[]
  env?: Binding[]
  span?: Span
}

export type EMap = {
  kind: 'map'
  value: EvalAST[]
  env?: Binding[]
  span?: Span
}

export type EFunction = {
  kind: 'function'
  body: EvalAST
  arguments: string[]
  env: Binding[]
  span?: Span
}

export type EIntrinsicFunction = {
  kind: 'intrinsicFunction'
  value: (args: EvalAST[]) => { result: EvalAST } | { error: string; span?: Span }
  span?: Span
}

export type EvalAST = EString | EAtom | ENumber | EList | EVector | EMap | EFunction | EIntrinsicFunction

export type Binding = { name: string; value: EvalAST }

export type MString = {
  kind: 'string'
  value: string
  span?: Span
}
export type MAtom = {
  kind: 'atom'
  value: string
  span?: Span
}
export type MNumber = {
  kind: 'number'
  value: number
  span?: Span
}

export type MList = {
  kind: 'list'
  value: MacrosAST[]
  env?: MacrosBinding[]
  span?: Span
}

export type MVector = {
  kind: 'vector'
  value: MacrosAST[]
  env?: MacrosBinding[]
  span?: Span
}

export type MMap = {
  kind: 'map'
  value: MacrosAST[]
  env?: MacrosBinding[]
  span?: Span
}

export type MFunction = {
  kind: 'function'
  body: MacrosAST
  arguments: string[]
  env: MacrosBinding[]
  span?: Span
}

export type MMacro = {
  kind: 'macro'
  body: MacrosAST
  arguments: string[]
  env: MacrosBinding[]
  name: string
  span?: Span
}

export type MacrosAST = MString | MAtom | MNumber | MList | MVector | MMap | MFunction | EIntrinsicFunction | MMacro

export type MacrosBinding = { name: string; value: MacrosAST }
