import { TokenizerContent } from './tokenizer'

export type Position = {
    line: number,
    column: number
}

export type SourceLocation = {
    start: Position,
    end: Position
}

export type BaseAST = {
    loc: SourceLocation
}

export type OperationValues = '¬' | '~' | '∧' | '^' | '∨' | '→' | '↔' | '⊕'

export enum OperationKey {
    Negation = 'Negation',
    Conjunction = 'Conjunction',
    Disjunction = 'Disjunction',
    Conditional = 'Conditional',
    Biconditional = 'Biconditional',
    XOR = 'XOR',
    None = 'None'
}

export type Proposition = {
    type: 'Proposition',
    value: string
    negatived: boolean,
}
export interface Operation extends BaseAST {
    key: OperationKey;
    value: string;
    type: 'Operation';
}

export type SubExpression = {
    type: 'SubExpression',
    negatived: boolean,
    body: Node[]
}

export type Node = (Proposition | Operation | SubExpression) & BaseAST

export type AnalyzerOptions<T extends string | TokenizerContent> = 
  T extends string
    ? { input: T; tokenizer?: never }
    : { input?: never; tokenizer: TokenizerContent }
