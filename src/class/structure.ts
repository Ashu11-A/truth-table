import { writeFile } from 'fs/promises'
import { BaseAST, Node, OperationKey, Proposition } from '../types/analyzer.js'
import { StructureJson } from '../types/structure.js'

/**
 * Represents a logical structure that can parse input expressions
 * and generate corresponding values for a truth table.
 *
 * @export
 * @class Structure
 * @typedef {Structure}
 */
export class Structure {
  /**
   * The list of unique variables extracted from the input expression.
   * 
   * @type {string[]}
   */
  public columns: number = 0
  public rows: number = 0
  public structure: StructureJson[] = []
  public propositions: string[] = []
  private values: StructureJson[] = []

  constructor(public ast: Node[]) {
    this.propositions = this.getPropositions().map((element) => element.value)
    this.columns = this.propositions.length
    // Faz 2 elevado ao numero de colunas
    this.rows = 2 ** this.columns
    this.generate()
  }

  /**
   * Parses the input expression to extract variables and generate the truth table values.
   * 
   * @returns {Structure} The current instance of the Structure class with parsed values.
   */
  generate(): Structure {
    for (let row = 0; row < this.rows; row++) {
      const rowValues: Record<string, boolean> = {}
      /**
       * Isso carrega todas as variáveis do ambiente
       * Ex:
       * {
       *   p: true,
       *   q: false,
       *   r: false
       * }
       */
      this.propositions.map((proposition, column) => rowValues[proposition] = !this.getTruthValue(row, column, this.columns))

      // Adiciona valores das proposições
      for (let column = 0; column < this.columns; column++) {
        this.addRowValues({
          type: 'Variable',
          element: this.propositions[column],
          value: rowValues[this.propositions[column]],
          column,
          row,
          position: `${row}x${column}`
        })
      }

      const negatives = this.getPropositions().filter((propositions) => propositions.negatived)
      for (const element of negatives) {
        const column = this.values.findIndex((value) => value.element === element.value)
        const value = `~${element.value}`
        this.propositions.push(value)
        this.addRowValues({
          type: 'VariableNegative',
          element: value,
          value: !rowValues[this.propositions[column]],
          column: this.columns,
          row,
          position: `${row}x${this.columns}`
        })
      }

      // Calcula e adiciona o resultado da expressão lógica
      this.evaluateExpression(this.ast, rowValues).map(({ expression, value }, index) => {
        if (value === undefined) return
        this.propositions.push(expression)

        this.addRowValues({
          type: 'Result',
          element: expression,
          value,
          column: this.columns + negatives.length + index,
          row,
          position: `${row}x${this.columns + negatives.length + index}`
        })
      })
    }

    this.structure = this.values
    this.propositions = Array.from(new Set(this.propositions)) // Remove duplicatas recorrentes de this.evaluateExpression
    this.columns = this.propositions.length
    return this
  }

  private addRowValues(options: StructureJson) {
    this.values.push(options)
  }

  /**
   * Avalia uma expressão lógica dada uma lista de valores booleanos.
   *
   * @param {Node[]} expression - A expressão lógica representada como uma lista de nós.
   * @param {boolean[]} values - Os valores booleanos associados às proposições.
   * @returns {{ expression: string, value: boolean }} - O resultado da avaliação, incluindo a expressão como string e o valor booleano.
   */
  evaluateExpression(expression: Node[], values: Record<string, boolean>): { expression: string, value: boolean, values: boolean[], type: OperationKey }[] {
    let index = 0
    const input: string[] = []
    const expressions: { expression: string, value: boolean, values: boolean[], type: OperationKey }[] = []

    /**
     * Obtém o próximo nó na expressão com base no índice fornecido.
     * 
     * @param {number | undefined} defaultIndex - O índice do próximo nó a ser recuperado.
     * @returns {Node | undefined} - O próximo nó ou undefined se não houver próximo nó.
     */
    const getNode = (defaultIndex?: number): Node | undefined => {
      const indexx = defaultIndex ?? index
      return expression[indexx]
    }

    // Função auxiliar para processar uma operação
    const processOperation = (opType: OperationKey, currentValues: boolean[]): boolean => {
      /**
       * Obtem a expreção anterior para possibilitar a valdação com o nova operação
       */
      const before = expressions[expressions.length - 1]
      if (before !== undefined) currentValues = [before.value, ...currentValues]
  
      // Processa a fórmula com base no tipo de operação
      const processed = this.processFormula(currentValues, opType)
      expressions.push({ expression: input.join(' '), value: processed, values: currentValues, type: opType })

      return processed
    }

    const evaluateRecursively = (): boolean => {
      const results: boolean[] = []
      let currentOperation: OperationKey | undefined = undefined
      
      while (index < expression.length) {
        const node = getNode()
        if (!node) break

        switch (node.type) {
        case 'Proposition': {
          const proposition = node.negatived ? `~${node.value}` : node.value
          const value = values[node.value]
          const result = node.negatived ? !value : value
  
          input.push(proposition)
          results.push(result)
          break
        }
        case 'Operation': {
          /**
           * Se o tipo da operação seguinte for diferente do tipo atual, interrompe o loop,
           * pois queremos processar diferentes tipos de operação separadamente.
           */
          if (currentOperation !== undefined && currentOperation !== node.key as OperationKey) {
            processOperation(currentOperation, results)
            results.length = 0
          }
          currentOperation = node.key as OperationKey
          input.push(node.value)
          break
        }
        case 'SubExpression': {
          const subResult = this.evaluateExpression(node.body, values)
          const displayName = `(${subResult[0].expression})`

          subResult.forEach((values) => expressions.push({ ...values, expression: values.expression }))
          input.push(displayName)

          results.push(...subResult.map((result) => result.value))
          break
        }
        }
        
        index++
      }
      return processOperation(currentOperation as OperationKey, results)
    }
    evaluateRecursively()

    return expressions
  }

  /**
   * Processa uma fórmula com base em um tipo de operação específico.
   *
   * @param {boolean[]} propositions - Lista de valores booleanos representando as proposições.
   * @param {OperationKey} type - O tipo de operação a ser aplicada.
   * @returns {boolean} - O resultado da fórmula após a aplicação da operação.
   */
  processFormula(propositions: boolean[], type: OperationKey): boolean {
    switch (type) {
    // ~p (Negação)
    case OperationKey.Negation: {
      return !propositions[0]
    }
    // p ^ q (Conjunção)
    case OperationKey.Conjunction: {
      return propositions.every((prop) => prop === true)
    }
    // p v q (Disjunção)
    case OperationKey.Disjunction: {
      return propositions.reduce((acc, current) => acc || current)
    }
    // p -> q (Condicional)
    case OperationKey.Conditional: {
      return propositions.reduce((acc, current) => !acc || current)
    }
    // p <-> q (Bicondicional)
    case OperationKey.Biconditional: {
      return propositions.reduce((acc, current) => acc === current)
    }
    case OperationKey.XOR:
      return propositions.reduce((acc, current) =>  acc !== current)
    case OperationKey.None:
      return false
    }
  }

  /**
   * Obtém uma lista de proposições únicas a partir de uma árvore de sintaxe abstrata (Analyzer).
   *
   * @param {Node[]} [ast] - A árvore de sintaxe abstrata a ser processada. Se não fornecida, usa a Analyzer interna.
   * @returns {string[]} - Uma lista de proposições únicas.
   */
  getPropositions(ast?: Node[]): (Proposition & BaseAST)[] {
    ast = (ast ?? this.ast)
    let propositions:(Proposition & BaseAST)[] = []

    /**
     * Processa os elementos da árvore de sintaxe abstrata para coletar as proposições.
     *
     * @param {Node[]} elements - A lista de nós a ser processada.
     */
    const process = (elements: Node[]) => {
      for (const element of elements) {
        if (element.type === 'Proposition') propositions.push(element)
        if (element.type === 'SubExpression') process(element.body)
      }
    }
    process(ast)
    
    // Se existir algum element, que é negativo, apenas deixe a representação negativa
    const propositionMap = new Map<string, Proposition & BaseAST>()

    for (const proposition of propositions) {
      const key = proposition.value // Usar o valor da proposição como chave
      if (!propositionMap.has(key)) {
        // Se não existe ainda, adicionar a proposição
        propositionMap.set(key, proposition)
      } else if (proposition.negatived) {
        // Se já existe uma proposição com o mesmo valor, preferir a negativa (negatived: true)
        propositionMap.set(key, proposition)
      }
    }

    propositions = [...propositionMap.values()]
    return propositions
  }

  /**
   * Determines the truth value for a given row and column in the truth table.
   * 
   * @param {number} row - The current row index in the truth table.
   * @param {number} column - The current column index in the truth table.
   * @param {number} totalColumns - The total number of columns in the truth table.
   * @returns {boolean} The truth value for the specified row and column.
   */
  getTruthValue(row: number, column: number, totalColumns: number): boolean {
    // Calcular o número total de combinações (2^column), para determinar quando alternar entre true/false
    const alternatingFactor = 2 ** (totalColumns - column - 1)

    // Se a linha atual estiver dentro do grupo "true" para essa variável, retorna true
    // Caso contrário, retorna false
    return Math.floor(row / alternatingFactor) % 2 === 1
  }

  /**
   * Saves the generated structure in a file in JSON format
   * 
   * @async
   * @param {string} path - The path to the file where the JSON content will be saved.
   * @returns {Promise<void>} A promise that resolves when the file has been successfully saved.
   */
  async save(path: string): Promise<void> {
    if (this.structure === undefined) throw new Error('Structure is undefined, use the generate function before save!')
    await writeFile(path, JSON.stringify(this.structure, null, 2))
  }
}
