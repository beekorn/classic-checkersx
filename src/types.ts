export type Player = 'red' | 'black';

export interface Piece {
  player: Player;
  isKing: boolean;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  isJump: boolean;
  jumpedPiece?: Position;
}

export type BoardState = (Piece | null)[][];

export type GameMode = 'pvp' | 'ai';
export type Difficulty = 'easy' | 'medium' | 'hard';