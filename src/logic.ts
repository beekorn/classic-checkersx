import { BoardState, Move, Piece, Player, Position, Difficulty } from './types.ts';

export const BOARD_SIZE = 8;

export const initializeBoard = (): BoardState => {
  const board: BoardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 3) board[row][col] = { player: 'black', isKing: false };
        if (row > 4) board[row][col] = { player: 'red', isKing: false };
      }
    }
  }
  return board;
};

export const isValidPos = (row: number, col: number) => 
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

export const getValidMoves = (board: BoardState, pos: Position, mustJump: boolean = false): Move[] => {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const moves: Move[] = [];
  const directions = piece.isKing 
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] 
    : piece.player === 'red' 
      ? [[-1, -1], [-1, 1]] 
      : [[1, -1], [1, 1]];

  // Check jumps first
  directions.forEach(([dRow, dCol]) => {
    const jumpRow = pos.row + dRow * 2;
    const jumpCol = pos.col + dCol * 2;
    const midRow = pos.row + dRow;
    const midCol = pos.col + dCol;

    if (isValidPos(jumpRow, jumpCol)) {
      const target = board[jumpRow][jumpCol];
      const mid = board[midRow][midCol];
      if (!target && mid && mid.player !== piece.player) {
        moves.push({
          from: pos,
          to: { row: jumpRow, col: jumpCol },
          isJump: true,
          jumpedPiece: { row: midRow, col: midCol }
        });
      }
    }
  });

  if (moves.length > 0 && mustJump) return moves;

  if (!mustJump || moves.length === 0) {
    directions.forEach(([dRow, dCol]) => {
      const newRow = pos.row + dRow;
      const newCol = pos.col + dCol;
      if (isValidPos(newRow, newCol)) {
        if (!board[newRow][newCol]) {
          moves.push({
            from: pos,
            to: { row: newRow, col: newCol },
            isJump: false
          });
        }
      }
    });
  }

  return moves;
};

export const hasAnyJumps = (board: BoardState, player: Player): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.player === player) {
        const moves = getValidMoves(board, { row: r, col: c });
        if (moves.some(m => m.isJump)) return true;
      }
    }
  }
  return false;
};

// --- AI Logic ---

// Helper to deep copy board
const cloneBoard = (board: BoardState): BoardState => 
  board.map(row => row.map(p => p ? { ...p } : null));

// Simulate a move and return the new state
export const simulateMove = (board: BoardState, move: Move, currentPlayer: Player) => {
  const newBoard = cloneBoard(board);
  const piece = newBoard[move.from.row][move.from.col]!;

  newBoard[move.to.row][move.to.col] = piece;
  newBoard[move.from.row][move.from.col] = null;

  if (move.isJump && move.jumpedPiece) {
    newBoard[move.jumpedPiece.row][move.jumpedPiece.col] = null;
  }

  // Promotion
  if (!piece.isKing) {
    if ((piece.player === 'red' && move.to.row === 0) || 
        (piece.player === 'black' && move.to.row === BOARD_SIZE - 1)) {
      piece.isKing = true;
    }
  }

  // Check for multi-jump
  let nextMustJumpFrom: Position | null = null;
  let nextTurn = currentPlayer === 'red' ? 'black' : 'red';

  if (move.isJump) {
    const followUpMoves = getValidMoves(newBoard, move.to, true).filter(m => m.isJump);
    if (followUpMoves.length > 0) {
      nextMustJumpFrom = move.to;
      nextTurn = currentPlayer; // Turn continues
    }
  }

  return { newBoard, nextTurn, nextMustJumpFrom };
};

// Heuristic Evaluation
const evaluateBoard = (board: BoardState, player: Player): number => {
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      let value = 10;
      if (piece.isKing) value = 30;

      // Positional bonuses (center control, back row safety)
      if (piece.player === 'red') {
        // Red wants to be at row 0
        value += (7 - r); 
        if (r === 7) value += 2; // Back row defense
      } else {
        // Black wants to be at row 7
        value += r;
        if (r === 0) value += 2; // Back row defense
      }

      // Center control
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) value += 2;

      if (piece.player === player) score += value;
      else score -= value;
    }
  }
  return score;
};

// Minimax with Alpha-Beta Pruning
const minimax = (
  board: BoardState, 
  depth: number, 
  alpha: number, 
  beta: number, 
  maximizingPlayer: boolean, 
  player: Player, 
  mustJumpFrom: Position | null
): number => {
  if (depth === 0) {
    return evaluateBoard(board, player);
  }

  // Generate all possible moves for the current state
  let possibleMoves: Move[] = [];
  
  if (mustJumpFrom) {
    possibleMoves = getValidMoves(board, mustJumpFrom, true).filter(m => m.isJump);
  } else {
    const currentPlayer = maximizingPlayer ? player : (player === 'red' ? 'black' : 'red');
    const globalJump = hasAnyJumps(board, currentPlayer);
    
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c]?.player === currentPlayer) {
          let moves = getValidMoves(board, { row: r, col: c });
          if (globalJump) moves = moves.filter(m => m.isJump);
          possibleMoves.push(...moves);
        }
      }
    }
  }

  if (possibleMoves.length === 0) {
    // No moves means loss for current player
    return maximizingPlayer ? -10000 : 10000;
  }

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of possibleMoves) {
      const { newBoard, nextTurn, nextMustJumpFrom } = simulateMove(board, move, player);
      
      // If turn continues (multi-jump), depth doesn't decrease, and we are still maximizing
      const isTurnContinuing = nextTurn === player;
      const nextDepth = isTurnContinuing ? depth : depth - 1;
      const nextMaximizing = isTurnContinuing ? true : false;

      const evalScore = minimax(newBoard, nextDepth, alpha, beta, nextMaximizing, player, nextMustJumpFrom);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    const opponent = player === 'red' ? 'black' : 'red';
    for (const move of possibleMoves) {
      const { newBoard, nextTurn, nextMustJumpFrom } = simulateMove(board, move, opponent);
      
      const isTurnContinuing = nextTurn === opponent;
      const nextDepth = isTurnContinuing ? depth : depth - 1;
      const nextMaximizing = isTurnContinuing ? false : true;

      const evalScore = minimax(newBoard, nextDepth, alpha, beta, nextMaximizing, player, nextMustJumpFrom);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getAiMove = (board: BoardState, player: Player, difficulty: Difficulty, mustJumpFrom: Position | null): Move | null => {
  // 1. Get all valid moves
  let possibleMoves: Move[] = [];
  if (mustJumpFrom) {
    possibleMoves = getValidMoves(board, mustJumpFrom, true).filter(m => m.isJump);
  } else {
    const globalJump = hasAnyJumps(board, player);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c]?.player === player) {
          let moves = getValidMoves(board, { row: r, col: c });
          if (globalJump) moves = moves.filter(m => m.isJump);
          possibleMoves.push(...moves);
        }
      }
    }
  }

  if (possibleMoves.length === 0) return null;

  // Easy: Random move
  if (difficulty === 'easy') {
    return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  // Medium/Hard: Minimax
  // Depth: Medium = 2, Hard = 4
  const depth = difficulty === 'medium' ? 2 : 4;
  let bestMove = possibleMoves[0];
  let maxEval = -Infinity;

  // Shuffle moves to add variety if scores are equal
  possibleMoves.sort(() => Math.random() - 0.5);

  for (const move of possibleMoves) {
    const { newBoard, nextTurn, nextMustJumpFrom } = simulateMove(board, move, player);
    
    const isTurnContinuing = nextTurn === player;
    const nextDepth = isTurnContinuing ? depth : depth - 1;
    const nextMaximizing = isTurnContinuing ? true : false;

    const evalScore = minimax(newBoard, nextDepth, -Infinity, Infinity, nextMaximizing, player, nextMustJumpFrom);
    
    if (evalScore > maxEval) {
      maxEval = evalScore;
      bestMove = move;
    }
  }

  return bestMove;
};
