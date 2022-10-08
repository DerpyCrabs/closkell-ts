import { ParserAST, PAtom, PList, PVector, Span } from './types.ts'

export type ExecutableModule = {
  isExecutable: true
  expressions: ParserAST[]
}

export type ImportableModule = {
  isExecutable: false
  definitions: { name: string; expression: ParserAST; nameSpan: Span; expressionSpan: Span; isPublic: boolean }[]
}

export type Module = {
  url: string
  imports: {
    url: string
    kind: 'unqualified' | 'qualified' | 'unqualifiedAllowlist'
    bindings?: { name: string; span: Span }[]
    name?: string
    span: Span
  }[]
} & (ExecutableModule | ImportableModule)

export type ParseModuleError = { error: string; span: Span }
export type ParseModuleResult = { result: Module } | ParseModuleError

export function parseModule(url: string, expressions: ParserAST[]): ParseModuleResult {
  if (
    expressions[0].kind !== 'list' ||
    expressions[0].value[0].kind !== 'atom' ||
    (expressions[0].value[0].value !== 'executable' && expressions[0].value[0].value !== 'module')
  ) {
    return {
      result: {
        url,
        imports: [],
        isExecutable: true,
        expressions: expressions,
      },
    }
  }

  const header = expressions[0]

  if (
    header.value[0].kind !== 'atom' ||
    (header.value[0].value !== 'executable' && header.value[0].value !== 'module')
  ) {
    return {
      error: `Expected module or executable, got ${expressions[0].value[0].value}`,
      span: expressions[0].value[0].span,
    }
  }

  const isExecutableModule = header.value[0].value === 'executable'

  if (isExecutableModule) {
    const imports = parseImports(header.value.slice(1))
    if ('error' in imports) {
      return imports
    }
    return {
      result: {
        url,
        imports: imports.result,
        isExecutable: true,
        expressions: expressions.slice(1),
      },
    }
  } else {
    if (header.value.length < 2) {
      return { error: "Module doesn't have exports", span: header.span }
    }
    const exportsVector = header.value[1]
    if (exportsVector.kind !== 'vector') {
      return { error: 'Expected module exports vector', span: exportsVector.span }
    }
    const maybeBadExport = exportsVector.value.find((e) => e.kind !== 'atom')
    if (maybeBadExport) {
      return { error: `Expected atom, got ${maybeBadExport.kind}`, span: maybeBadExport.span }
    }
    const exportedDefinitions = exportsVector.value.map((e) => (e as PAtom).value)

    const imports = parseImports(header.value.slice(2))
    if ('error' in imports) {
      return imports
    }

    const exportBindings = expressions.slice(1)
    const maybeBadBinding = exportBindings.find((b) => b.kind !== 'vector' || b.value[0].kind !== 'atom')
    if (maybeBadBinding) {
      return { error: 'Invalid binding', span: maybeBadBinding.span }
    }
    const moduleDefinitions = (exportBindings as PList[]).map((b) => ({
      name: b.value[0].value as string,
      expression: b.value[1],
      nameSpan: b.value[0].span,
      expressionSpan: b.value[1].span,
      isPublic: exportedDefinitions.includes(b.value[0].value as string),
    }))
    const maybeNonexistingExport = exportsVector.value.find(
      (d) => !moduleDefinitions.map((d) => d.name).includes((d as PAtom).value)
    )
    if (maybeNonexistingExport) {
      return { error: `Can't find definition of ${maybeNonexistingExport}`, span: maybeNonexistingExport.span }
    }

    return {
      result: {
        url,
        isExecutable: false,
        imports: imports.result,
        definitions: moduleDefinitions,
      },
    }
  }
}

function parseImports(imports: ParserAST[]): { result: Module['imports'] } | ParseModuleError {
  const maybeNotVector = imports.find((i) => i.kind !== 'vector')
  if (maybeNotVector) {
    return { error: `Expected vector found ${maybeNotVector.kind}`, span: maybeNotVector.span }
  }
  const parsedImports = imports.map((i) => parseImport(i as PVector))
  const maybeImportError = parsedImports.find((i) => 'error' in i)
  if (maybeImportError) {
    return maybeImportError as ParseModuleError
  }
  return { result: parsedImports.map((i) => (i as { result: Module['imports'][number] }).result) }
}

export function parseImport(importVector: PVector): { result: Module['imports'][number] } | ParseModuleError {
  // ["./module1" as moduleName]
  // ["./module1" unqualified]
  // ["./module1" unqualified [f1 f2]]
  const validationResult = validateImport(importVector)
  if ('error' in validationResult) {
    return validationResult
  }

  const moduleUrl = importVector.value[0] as PAtom
  const kindDescriminator = importVector.value[1]
  if (kindDescriminator.value === 'as') {
    const moduleName = importVector.value[2] as PAtom
    return {
      result: {
        url: moduleUrl.value,
        kind: 'qualified',
        span: importVector.span,
        name: moduleName.value,
      },
    }
  } else {
    const allowlist = importVector.value[2] as PVector
    if (allowlist) {
      return {
        result: {
          url: moduleUrl.value,
          kind: 'unqualifiedAllowlist',
          span: importVector.span,
          bindings: allowlist.value.map((a) => ({ name: (a as PAtom).value, span: a.span })),
        },
      }
    } else {
      return {
        result: {
          url: moduleUrl.value,
          kind: 'unqualified',
          span: importVector.span,
        },
      }
    }
  }
}

function validateImport(importVector: PVector): { result: PVector } | ParseModuleError {
  if (importVector.value.length < 1) {
    return { error: 'Expected import declaration', span: importVector.span }
  }
  if (importVector.value.length < 2) {
    return { error: "Import declaration doesn't have kind descriptor", span: importVector.span }
  }
  const moduleUrl = importVector.value[0]
  if (moduleUrl.kind !== 'string') {
    return { error: `Expected module url string got ${moduleUrl.kind}`, span: moduleUrl.span }
  }
  const kindDescriminator = importVector.value[1]
  if (kindDescriminator.kind !== 'atom') {
    return { error: `Expected atom got ${kindDescriminator.kind}`, span: kindDescriminator.span }
  }
  if (kindDescriminator.value === 'as') {
    if (importVector.value.length < 3) {
      return { error: 'Expected module name in import definition', span: importVector.span }
    }
    const moduleName = importVector.value[2]
    if (moduleName.kind !== 'atom') {
      return { error: `Expected atom got ${moduleName.kind}`, span: moduleName.span }
    }
    return {
      result: importVector,
    }
  } else if (kindDescriminator.value === 'unqualified') {
    const allowlist = importVector.value[2]
    if (allowlist) {
      if (allowlist.kind !== 'vector') {
        return { error: `Expected vector got ${allowlist.kind}`, span: allowlist.span }
      }
      const maybeNotAtom = allowlist.value.find((a) => a.kind !== 'atom')
      if (maybeNotAtom) {
        return { error: `Expected atom got ${maybeNotAtom.kind}`, span: maybeNotAtom.span }
      }
      return {
        result: importVector,
      }
    } else {
      return { result: importVector }
    }
  } else {
    return { error: `Expected as or unqualified got ${kindDescriminator.value}`, span: kindDescriminator.span }
  }
}
