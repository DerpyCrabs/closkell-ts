import { ParserAST, Span } from './types.ts'

export type ASTParsingErrorTypes =
  | 'No expressions found'
  | "String literal doesn't end"
  | "List doesn't end"
  | "Vector doesn't end"
  | "Map doesn't end"
  | "Quote can't be followed by whitespace"
  | "Unquote can't be followed by whitespace"
  | "Skip can't be followed by whitespace"
  | "Invalid number format"
export type ASTParsingError = { error: ASTParsingErrorTypes; span: Span; lastPosition: number }

export type ASTParsingResult = { result: ParserAST } | ASTParsingError

export function parseFile(source: string): ASTParsingResult[] {
  const results = []
  let position = 0
  while (position !== source.length) {
    const result = parseExpression(source, position)
    const newPosition = 'error' in result ? result.lastPosition : result.result.span.end
    position = consumeWhitespace(source, newPosition)
    results.push(result)
  }
  return results
}

export function parseToAST(source: string): ASTParsingResult {
  if (source.trim() === '') {
    return { error: 'No expressions found', span: { start: 0, end: source.length }, lastPosition: source.length }
  } else {
    return parseExpression(source, 0)
  }
}

function parseExpression(source: string, position: number): ASTParsingResult {
  let currentPosition = position
  let consumptionState: null | { source: string; start: number; sourceType: ParserAST['kind'] } = null
  while (true) {
    let currentChar = source[currentPosition]
    if (currentPosition === source.length) {
      if (consumptionState === null) {
        return {
          error: 'No expressions found',
          span: { start: position, end: source.length },
          lastPosition: source.length,
        }
      } else {
        return produceExpression(consumptionState.sourceType, consumptionState.source, {
          start: consumptionState.start,
          end: currentPosition,
        })
      }
    } else if (consumptionState !== null) {
      if (consumptionState.sourceType === 'number') {
        if (isNumber(currentChar) || (currentChar === '.' && !consumptionState.source.includes('.'))) {
          consumptionState.source = `${consumptionState.source}${currentChar}`
          currentPosition += 1
          continue
        } else {
          // If the number ends with a dot, remove it
          if (consumptionState.source.endsWith('.')) {
            consumptionState.source = consumptionState.source.slice(0, -1)
            return produceExpression(consumptionState.sourceType, consumptionState.source, {
              start: consumptionState.start,
              end: currentPosition - 1,
            })
          }
          return produceExpression(consumptionState.sourceType, consumptionState.source, {
            start: consumptionState.start,
            end: currentPosition,
          })
        }
      } else if (consumptionState.sourceType === 'string') {
        if (currentChar === '"') {
          return produceExpression(consumptionState.sourceType, `${consumptionState.source}${currentChar}`, {
            start: consumptionState.start,
            end: currentPosition + 1,
          })
        } else {
          consumptionState.source = `${consumptionState.source}${currentChar}`
        }
      } else if (consumptionState.sourceType === 'atom') {
        if (isAllowedAtomChar(currentChar)) {
          consumptionState.source = `${consumptionState.source}${currentChar}`
        } else {
          return produceExpression(consumptionState.sourceType, consumptionState.source, {
            start: consumptionState.start,
            end: currentPosition,
          })
        }
      } else if (consumptionState.sourceType === 'list') {
        const innerExpressions = parseInnerExpressions(source, currentPosition, ')')
        if ('error' in innerExpressions) {
          return innerExpressions
        }
        currentPosition = innerExpressions.newPosition
        currentChar = source[currentPosition]
        if (currentChar !== ')') {
          return {
            error: "List doesn't end",
            span: {
              start: consumptionState.start,
              end: currentPosition + 1,
            },
            lastPosition: currentPosition + 1,
          }
        } else {
          return {
            result: {
              kind: 'list',
              value: innerExpressions.expressions,
              span: {
                start: consumptionState.start,
                end: currentPosition + 1,
              },
            },
          }
        }
      } else if (consumptionState.sourceType === 'vector') {
        const innerExpressions = parseInnerExpressions(source, currentPosition, ']')
        if ('error' in innerExpressions) {
          return innerExpressions
        }
        currentPosition = innerExpressions.newPosition
        currentChar = source[currentPosition]
        if (currentChar !== ']') {
          return {
            error: "Vector doesn't end",
            span: {
              start: consumptionState.start,
              end: currentPosition + 1,
            },
            lastPosition: currentPosition + 1,
          }
        } else {
          return {
            result: {
              kind: 'vector',
              value: innerExpressions.expressions,
              span: {
                start: consumptionState.start,
                end: currentPosition + 1,
              },
            },
          }
        }
      } else if (consumptionState.sourceType === 'map') {
        const innerExpressions = parseInnerExpressions(source, currentPosition, '}')
        if ('error' in innerExpressions) {
          return innerExpressions
        }
        currentPosition = innerExpressions.newPosition
        currentChar = source[currentPosition]
        if (currentChar !== '}') {
          return {
            error: "Map doesn't end",
            span: {
              start: consumptionState.start,
              end: currentPosition + 1,
            },
            lastPosition: currentPosition + 1,
          }
        } else {
          return {
            result: {
              kind: 'map',
              value: innerExpressions.expressions,
              span: {
                start: consumptionState.start,
                end: currentPosition + 1,
              },
            },
          }
        }
      }
    } else {
      if (isWhitespace(currentChar)) {
        // skip whitespace
      } else if (currentChar === ';') {
        const endOfLineIndex = Array.from(source.slice(currentPosition + 1)).findIndex((c) => c === '\n')
        if (endOfLineIndex !== -1) {
          currentPosition = currentPosition + 1 + endOfLineIndex
        } else {
          return {
            error: 'No expressions found',
            span: { start: position, end: source.length },
            lastPosition: source.length,
          }
        }
      } else if (currentChar === '-') {
        // Check if this is a negative number or a minus operator
        const nextChar = source[currentPosition + 1]
        const prevChar = currentPosition > 0 ? source[currentPosition - 1] : null
        
        if (isNumber(nextChar)) {
          // It's a negative number, start consuming it
          consumptionState = { source: currentChar, start: currentPosition, sourceType: 'number' }
        } else if (nextChar === '-') {
          // Double minus sign is invalid
          return {
            error: 'Invalid number format',
            span: { start: currentPosition, end: currentPosition + 2 },
            lastPosition: currentPosition + 2,
          }
        } else if ((isWhitespace(nextChar) || nextChar === undefined) && prevChar !== '(') {
          // Standalone minus is invalid, but allow it if it's the first character after an opening parenthesis
          return {
            error: 'Invalid number format',
            span: { start: currentPosition, end: currentPosition + 1 },
            lastPosition: currentPosition + 1,
          }
        } else {
          // It's a minus operator in an expression
          return {
            result: {
              kind: 'atom',
              value: '-',
              span: { start: currentPosition, end: currentPosition + 1 }
            }
          }
        }
      } else if (currentChar === '.') {
        // Check if this starts a number
        const nextChar = source[currentPosition + 1]
        if (isNumber(nextChar)) {
          consumptionState = { source: '0.', start: currentPosition, sourceType: 'number' }
        } else {
          // It's a dot operator in an expression
          return {
            result: {
              kind: 'atom',
              value: '.',
              span: { start: currentPosition, end: currentPosition + 1 }
            }
          }
        }
      } else if (currentChar === "'") {
        if (isWhitespace(source[currentPosition + 1])) {
          return {
            error: "Quote can't be followed by whitespace",
            span: { start: currentPosition, end: currentPosition + 2 },
            lastPosition: currentPosition + 2,
          }
        } else {
          const quotedExpression = parseExpression(source, currentPosition + 1)
          if ('error' in quotedExpression) {
            return quotedExpression
          } else {
            return {
              result: {
                kind: 'list',
                value: [
                  { kind: 'atom', value: 'quote', span: { start: currentPosition, end: currentPosition + 1 } },
                  quotedExpression.result,
                ],
                span: { start: currentPosition, end: quotedExpression.result.span.end },
              },
            }
          }
        }
      } else if (currentChar === '~') {
        if (isWhitespace(source[currentPosition + 1])) {
          return {
            error: "Unquote can't be followed by whitespace",
            span: { start: currentPosition, end: currentPosition + 2 },
            lastPosition: currentPosition + 2,
          }
        } else {
          const quotedExpression = parseExpression(source, currentPosition + 1)
          if ('error' in quotedExpression) {
            return quotedExpression
          } else {
            return {
              result: {
                kind: 'list',
                value: [
                  { kind: 'atom', value: 'unquote', span: { start: currentPosition, end: currentPosition + 1 } },
                  quotedExpression.result,
                ],
                span: { start: currentPosition, end: quotedExpression.result.span.end },
              },
            }
          }
        }
      } else if (currentChar === '#' && source.length - 1 > currentPosition && source[currentPosition + 1] === '_') {
        if (isWhitespace(source[currentPosition + 2])) {
          return {
            error: "Unquote can't be followed by whitespace",
            span: { start: currentPosition, end: currentPosition + 2 },
            lastPosition: currentPosition + 2,
          }
        } else {
          const quotedExpression = parseExpression(source, currentPosition + 2)
          if ('error' in quotedExpression) {
            return quotedExpression
          } else {
            return {
              result: {
                kind: 'list',
                value: [
                  { kind: 'atom', value: 'skip', span: { start: currentPosition, end: currentPosition + 2 } },
                  quotedExpression.result,
                ],
                span: { start: currentPosition, end: quotedExpression.result.span.end },
              },
            }
          }
        }
      } else if (currentChar === '(') {
        consumptionState = { start: currentPosition, sourceType: 'list', source: currentChar }
      } else if (currentChar === '[') {
        consumptionState = { start: currentPosition, sourceType: 'vector', source: currentChar }
      } else if (currentChar === '{') {
        consumptionState = { start: currentPosition, sourceType: 'map', source: currentChar }
      } else if (isNumberStart(currentChar)) {
        consumptionState = { source: currentChar, start: currentPosition, sourceType: 'number' }
      } else if (currentChar === '"') {
        consumptionState = { start: currentPosition, sourceType: 'string', source: currentChar }
      } else if (currentChar === '#') {
        if (isWhitespace(source[currentPosition + 1])) {
          return {
            error: "Skip can't be followed by whitespace",
            span: { start: currentPosition, end: currentPosition + 2 },
            lastPosition: currentPosition + 2,
          }
        } else {
          consumptionState = { start: currentPosition, sourceType: 'atom', source: currentChar }
        }
      } else if (isAllowedAtomFirstChar(currentChar)) {
        consumptionState = { start: currentPosition, sourceType: 'atom', source: currentChar }
      } else {
        console.log(source.slice(0, currentPosition))
        console.log(`\x1b[1;31m${currentChar}\x1b[0m`)
        console.log(source.slice(currentPosition + 1))
        throw new Error(`parseExpression: not implemented`)
      }
    }
    currentPosition += 1
  }
}

function parseInnerExpressions(
  source: string,
  currentPosition: number,
  endChar: string
): ASTParsingError | { expressions: ParserAST[]; newPosition: number } {
  const innerExpressions: ParserAST[] = []
  let currentChar = source[currentPosition]
  while (currentChar !== endChar && currentPosition !== source.length) {
    const nextExpression = parseExpression(source, currentPosition)
    if ('error' in nextExpression) {
      return nextExpression
    } else {
      innerExpressions.push(nextExpression.result)
      const newPosition = consumeWhitespace(source, nextExpression.result.span.end)
      currentPosition = newPosition
      currentChar = source[currentPosition]
    }
  }
  return { expressions: innerExpressions, newPosition: currentPosition }
}

function consumeWhitespace(source: string, currentPosition: number): number {
  let newPosition = currentPosition
  while (isWhitespace(source[newPosition]) && newPosition < source.length) {
    newPosition += 1
  }
  return newPosition
}

function isWhitespace(source: string): boolean {
  return [' ', '\n', '\t', ',', '\r'].includes(source)
}

function isNumber(char: string): boolean {
  return /[0-9]/.test(char)
}

function isNumberStart(char: string): boolean {
  return /[0-9]/.test(char)
}

function isAllowedAtomFirstChar(char: string): boolean {
  return Array.from('!$%&|*+-/:<=>?^_').includes(char) || /\w/.test(char)
}

function isAllowedAtomChar(char: string): boolean {
  return isAllowedAtomFirstChar(char) || char === '.' || /\d/.test(char)
}

function produceExpression(sourceType: ParserAST['kind'], source: string, span: Span): ASTParsingResult {
  if (sourceType === 'number') {
    return { result: { kind: 'number', value: Number(source), span } }
  } else if (sourceType === 'string') {
    if (source[0] === '"' && source[source.length - 1] === '"') {
      return { result: { kind: 'string', value: source.slice(1, -1), span } }
    } else {
      return { error: "String literal doesn't end", span, lastPosition: span.end }
    }
  } else if (sourceType === 'atom') {
    return { result: { kind: 'atom', value: source, span } }
  } else {
    throw new Error('produceExpression: not implemented')
  }
}
