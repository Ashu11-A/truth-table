import { writeFile } from 'fs/promises'
import {
  biconditionalExpressions,
  conditionalExpressions,
  conjunctionExpressions,
  disjunctionExpressions,
  lettersAllowed,
  negationExpressions,
  operationsAllowed,
  xorExpressions
} from '../index.js'
import {
  ErrorType,
  NotInstantiatedError,
  UndeterminedError,
  UnexpectedError
} from '../lib/error.js'
import {
  AnalyzerOptions,
  Node,
  OperationKey,
  OperationValues
} from '../types/analyzer.js'
import { TokenizerContent, Tokenizer as TokenizerType } from '../types/tokenizer.js'
import { Method } from './Methods.js'
import { Tokenizer } from './Tokenizer.js'

export class Analyzer<T extends string | Tokenizer>{
  public tokenizer: TokenizerContent
  public ast: Node[] = []
  static parseIndex = 0
  public input?: string

  constructor({ input, tokenizer }: AnalyzerOptions<T>) {
    if (typeof input === 'string') {
      const tokenizer = new Tokenizer(input)
      this.tokenizer = { exceptions: tokenizer.exceptions, tokens: tokenizer.tokens }
    } else {
      this.tokenizer = tokenizer
    }
  }

  /**
   * Analisa os tokens gerados pela função `tokenize`, valida-os e constrói a Analyzer (Abstract Syntax Tree) com base nos tokens válidos.
   * Os tokens são categorizados como 'Proposition' (para letras), 'Operation' (para operadores) ou 'SubExpression' (para conjuntos).
   * A Analyzer resultante é um array de nós, onde cada nó contém o valor, tipo, e a posição do token.
   *
   * @returns {Node[]} Retorna a Analyzer gerada
   */
  parse(tokens?: TokenizerType[], index?: number): Node[] {
    if (this.tokenizer.exceptions.length > 0) throw new Error(this.tokenizer.exceptions.map((erro) => erro.message).join('\n'))

    tokens = tokens ?? this.tokenizer.tokens
    let actualIndex = index ?? Analyzer.parseIndex
    const ast: Node[] = []

    while (actualIndex < tokens.length) {
      const { value, loc } = tokens[actualIndex]

      switch (true) {
      case lettersAllowed.includes(value): {
        const result = Method.execute({
          type: 'Proposition',
          ast: this,
          index: actualIndex,
          tokens,
        })
        if (result === undefined) throw new NotInstantiatedError({ method: 'Proposition', loc })
        if (isError(result)) throw result

        ast.push(result)
        break
      }
      case (operationsAllowed.includes(value) && !negationExpressions.includes(value)): {
        // Caso seja uma negativa de uma Preposição, ele deve ser pulado,
        // já que ele será anexado à Preposição com o elemento negado
        const result = Method.execute({
          type: 'Operation',
          ast: this,
          index: actualIndex,
          tokens,
        })
        if (result === undefined)
          throw new NotInstantiatedError({ method: 'Operation', loc })
        if (isError(result)) throw result

        ast.push(result)
        break
      }
      case value === '(': {
        const result = Method.execute({
          type: 'SubExpression',
          ast: this,
          index: actualIndex,
          tokens
        })
        if (result === undefined)
          throw new NotInstantiatedError({ method: 'SubExpression', loc })
        if (isError(result)) throw result

        ast.push(result)
        actualIndex = Analyzer.parseIndex + 1
        break
      }
      default: {
        if (negationExpressions.includes(value) || value === ')') break
        throw new UndeterminedError({ value, loc })
      }
      }
      actualIndex++
      Analyzer.parseIndex++
    }

    const error = this.validation(ast)
    if (error !== undefined) throw error

    this.ast = ast
    return ast
  }

  getOperationKey(value: OperationValues): OperationKey {
    return negationExpressions.includes(value)
      ? OperationKey.Negation
      : conjunctionExpressions.includes(value)
        ? OperationKey.Conjunction
        : disjunctionExpressions.includes(value)
          ? OperationKey.Disjunction
          : conditionalExpressions.includes(value)
            ? OperationKey.Conditional
            : biconditionalExpressions.includes(value)
              ? OperationKey.Biconditional
              : xorExpressions.includes(value)
                ? OperationKey.XOR
                : OperationKey.None
  }

  getNegatived(tokens: TokenizerType[], index: number) {
    return negationExpressions.includes(tokens[index - 1]?.value)
  }

  validation(ast: Node[]): ErrorType | undefined {
    const process = (expressions: Node[]): ErrorType | undefined => {
      let index = 0

      while (index < expressions.length) {
        const element = expressions[index]
        const nextElement = expressions[index + 1]

        switch (element.type) {
        case 'Proposition': {
          if (nextElement !== undefined && nextElement?.type !== 'Operation')
            throw new UnexpectedError({
              origin: element.type,
              expected: ['Operation'],
              unexpected: nextElement.type,
              loc: nextElement.loc,
            }).toJSON()
          index++

          break
        }
        case 'Operation': {
          /**
             * Só ocorre quando se é usado um elemento não permidido, tipo uma caracter especial ou letra não categorizada
             * Error: P ^ =
             * Correct: P ^ Q
             */
          if (element.key === 'None')
            throw new UnexpectedError({
              origin: element.key,
              expected: ['Proposition', 'SubExpression'],
              unexpected: nextElement.type,
              loc: nextElement.loc,
            }).toJSON()

          /**
             * Se após um elemento Operation não for um dos elementos Proposition ou SubExpression
             * Error: P ^ ^
             * Correct: P ^ Q
             */
          if (
            nextElement !== undefined &&
              !['Proposition', 'SubExpression'].includes(nextElement?.type)
          )
            throw new UnexpectedError({
              origin: nextElement.type,
              expected: ['Proposition', 'SubExpression'],
              unexpected: nextElement.type,
              loc: nextElement.loc,
            }).toJSON()

          /**
             * Caso após um elemento Operation não houver nenhum outro elemento
             * Error: P ^ Q ^
             * Correct: P ^ Q ^ R
             */
          if (nextElement === undefined)
            throw new UnexpectedError({
              origin: element.type,
              expected: ['Proposition', 'SubExpression'],
              unexpected: 'None',
              loc: element.loc,
            }).toJSON()

          index++

          break
        }
        case 'SubExpression': {
          process(element.body)
          /**
             * Se após a declaração de um conjunto, houver algo, isso deve ser um operador.
             * Error: (P ^ Q) P
             * Correct: (P ^ Q) ^ P
             */
          if (
            nextElement !== undefined &&
              !['Operation'].includes(nextElement?.type)
          )
            throw new UnexpectedError({
              origin: element.type,
              expected: ['Operation'],
              unexpected: nextElement.type,
              loc: nextElement.loc,
            }).toJSON()
          index++

          break
        }
        }
      }
      return
    }
    return process(ast)
  }

  /**
   * Saves the current Analyzer to a file in JSON format.
   *
   * @async
   * @param {string} path - The path to the file where the JSON content will be saved.
   * @returns {Promise<void>} A promise that resolves when the file has been successfully saved.
   */
  async save(path: string): Promise<void> {
    if (this.ast === undefined)
      throw new Error(
        'Analyzer is undefined, use the parser function before saving, or an error occurred while parsing.',
      )
    await writeFile(path, JSON.stringify(this.ast, null, 2))
  }
}

export function isError(data: ErrorType[] | Node[] | Node | ErrorType): data is ErrorType {
  const errorCodes = [
    'Unexpected',
    'NotInstantiated',
    'Undetermined',
    'WasExperienced',
  ]

  if (Array.isArray(data)) {
    return data.every((item) => 'code' in item && errorCodes.includes(item.code))
  }
  return 'code' in data && errorCodes.includes(data['code'])
}
