import React, { useState, useEffect, useMemo } from 'react';
import { Crown, RotateCcw, Menu, X, Trophy, Cpu, User, Settings } from 'lucide-react';
import { BoardState, Move, Player, Position, GameMode, Difficulty } from './types.ts';
import { initializeBoard, getValidMoves, hasAnyJumps, getAiMove, BOARD_SIZE } from './logic.ts';

export default function App() {
  const [board, setBoard] = useState<BoardState>(initializeBoard());
  const [turn, setTurn] = useState<Player>('red');
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Game Settings
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Multi-jump state
  const [mustJumpFrom, setMustJumpFrom] = useState<Position | null>(null);

  // AI Turn Effect
  useEffect(() => {
    if (gameMode === 'ai' && turn === 'black' && !winner) {
      setIsAiThinking(true);
      // Small delay for realism and to let UI render
      const timer = setTimeout(() => {
        const move = getAiMove(board, 'black', difficulty, mustJumpFrom);
        if (move) {
          executeMove(move);
        } else {
          // AI has no moves, Red wins
          setWinner('red');
        }
        setIsAiThinking(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [turn, board, mustJumpFrom, winner, gameMode, difficulty]);

  const validMoves = useMemo(() => {
    if (!selectedPos) return [];
    if (isAiThinking) return []; // Disable interaction during AI turn
    if (gameMode === 'ai' && turn === 'black') return []; // Disable interaction during AI turn

    if (mustJumpFrom && (selectedPos.row !== mustJumpFrom.row || selectedPos.col !== mustJumpFrom.col)) {
      return [];
    }
    
    const moves = getValidMoves(board, selectedPos);
    
    if (mustJumpFrom) {
      return moves.filter(m => m.isJump);
    }

    const globalJumpAvailable = hasAnyJumps(board, turn);
    if (globalJumpAvailable) {
       return moves.filter(m => m.isJump);
    }

    return moves;
  }, [board, selectedPos, mustJumpFrom, turn, isAiThinking, gameMode]);

  const handleSquareClick = (row: number, col: number) => {
    if (winner || isAiThinking) return;
    if (gameMode === 'ai' && turn === 'black') return;

    const clickedPiece = board[row][col];
    const isCurrentPlayerPiece = clickedPiece?.player === turn;

    if (isCurrentPlayerPiece) {
      if (mustJumpFrom) return;

      const globalJumpAvailable = hasAnyJumps(board, turn);
      if (globalJumpAvailable) {
        const moves = getValidMoves(board, { row, col });
        if (!moves.some(m => m.isJump)) {
          // Cannot select this piece because another piece must jump
          return;
        }
      }
      
      setSelectedPos({ row, col });
      return;
    }

    if (!clickedPiece && selectedPos) {
      const move = validMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        executeMove(move);
      }
    }
  };

  const executeMove = (move: Move) => {
    const newBoard = board.map(r => r.map(c => c ? { ...c } : null));
    const piece = newBoard[move.from.row][move.from.col]!;

    newBoard[move.to.row][move.to.col] = piece;
    newBoard[move.from.row][move.from.col] = null;

    if (move.isJump && move.jumpedPiece) {
      newBoard[move.jumpedPiece.row][move.jumpedPiece.col] = null;
    }

    if (!piece.isKing) {
      if ((piece.player === 'red' && move.to.row === 0) || 
          (piece.player === 'black' && move.to.row === BOARD_SIZE - 1)) {
        piece.isKing = true;
      }
    }

    setBoard(newBoard);

    if (move.isJump) {
      const followUpMoves = getValidMoves(newBoard, move.to, true).filter(m => m.isJump);
      if (followUpMoves.length > 0) {
        setMustJumpFrom(move.to);
        setSelectedPos(move.to);
        return;
      }
    }

    setMustJumpFrom(null);
    setSelectedPos(null);
    const nextTurn = turn === 'red' ? 'black' : 'red';
    setTurn(nextTurn);
    checkWinCondition(newBoard, nextTurn);
  };

  const checkWinCondition = (currentBoard: BoardState, nextPlayer: Player) => {
    let hasPieces = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (currentBoard[r][c]?.player === nextPlayer) {
          hasPieces = true;
          break;
        }
      }
    }

    if (!hasPieces) {
      setWinner(nextPlayer === 'red' ? 'black' : 'red');
      return;
    }

    let hasMoves = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (currentBoard[r][c]?.player === nextPlayer) {
          const moves = getValidMoves(currentBoard, { row: r, col: c });
          if (moves.length > 0) {
            hasMoves = true;
            break;
          }
        }
      }
    }

    if (!hasMoves) {
      setWinner(nextPlayer === 'red' ? 'black' : 'red');
    }
  };

  const resetGame = () => {
    setBoard(initializeBoard());
    setTurn('red');
    setWinner(null);
    setSelectedPos(null);
    setMustJumpFrom(null);
    setIsMenuOpen(false);
  };

  return (
    <div className="relative w-full h-screen bg-stone-900 flex flex-col items-center justify-center font-sans">
      
      {/* Collapsible Menu */}
      <div className={`absolute top-4 left-4 z-50 transition-all duration-300 ${isMenuOpen ? 'w-72' : 'w-12'}`}>
        <div className="bg-stone-800 border border-stone-700 rounded-lg shadow-xl overflow-hidden">
          <div 
            className="h-12 flex items-center justify-between px-3 cursor-pointer hover:bg-stone-700 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <span className="font-bold text-stone-200 flex items-center gap-2"><Settings size={18}/> Settings</span> : <Menu className="text-stone-200" />}
            {isMenuOpen && <X className="w-5 h-5 text-stone-400" />}
          </div>
          
          {isMenuOpen && (
            <div className="p-4 space-y-6">
              {/* Game Mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Game Mode</label>
                <div className="flex bg-stone-900 p-1 rounded-lg">
                  <button 
                    onClick={() => setGameMode('pvp')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-colors ${gameMode === 'pvp' ? 'bg-stone-700 text-white shadow' : 'text-stone-500 hover:text-stone-300'}`}
                  >
                    <User size={14} /> PvP
                  </button>
                  <button 
                    onClick={() => setGameMode('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-colors ${gameMode === 'ai' ? 'bg-stone-700 text-white shadow' : 'text-stone-500 hover:text-stone-300'}`}
                  >
                    <Cpu size={14} /> vs AI
                  </button>
                </div>
              </div>

              {/* Difficulty (Only for AI) */}
              {gameMode === 'ai' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">AI Difficulty</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`py-1.5 rounded text-xs capitalize transition-colors ${difficulty === d ? 'bg-amber-700 text-white' : 'bg-stone-900 text-stone-500 hover:bg-stone-700'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="h-px bg-stone-700 my-2" />

              <button 
                onClick={resetGame}
                className="w-full flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-900 py-2 rounded transition-colors"
              >
                <RotateCcw size={16} /> Reset Board
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex flex-col items-center gap-6">
        {/* Header / Status */}
        <div className="flex items-center gap-8 text-2xl font-bold text-stone-200">
          <div className={`flex flex-col items-center gap-1 transition-opacity ${turn === 'red' ? 'opacity-100' : 'opacity-50'}`}>
            <div className={`px-4 py-2 rounded-lg transition-all ${turn === 'red' ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-stone-800'}`}>
              Red
            </div>
            <span className="text-xs text-stone-500 font-normal">YOU</span>
          </div>

          <div className="text-stone-600 text-lg font-mono">VS</div>

          <div className={`flex flex-col items-center gap-1 transition-opacity ${turn === 'black' ? 'opacity-100' : 'opacity-50'}`}>
            <div className={`px-4 py-2 rounded-lg transition-all ${turn === 'black' ? 'bg-stone-950 border border-stone-700 shadow-[0_0_15px_rgba(0,0,0,0.5)]' : 'bg-stone-800'}`}>
              Black
            </div>
            <span className="text-xs text-stone-500 font-normal">
              {gameMode === 'ai' ? (isAiThinking ? 'Thinking...' : `AI (${difficulty})`) : 'PLAYER 2'}
            </span>
          </div>
        </div>

        {/* Board */}
        <div className="relative p-3 bg-[#5c4033] rounded-lg shadow-2xl">
          <div className="grid grid-cols-8 gap-0 border-4 border-[#3e2b22]">
            {board.map((row, rIndex) => (
              row.map((piece, cIndex) => {
                const isDark = (rIndex + cIndex) % 2 === 1;
                const isSelected = selectedPos?.row === rIndex && selectedPos?.col === cIndex;
                const isValidMove = validMoves.some(m => m.to.row === rIndex && m.to.col === cIndex);

                return (
                  <div
                    key={`${rIndex}-${cIndex}`}
                    onClick={() => handleSquareClick(rIndex, cIndex)}
                    className={`
                      w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 
                      flex items-center justify-center relative
                      ${isDark ? 'bg-[#8b5a2b]' : 'bg-[#eecfa1]'}
                      ${isValidMove ? 'cursor-pointer' : ''}
                    `}
                  >
                    {/* Highlight Valid Move Target */}
                    {isValidMove && (
                      <div className="absolute w-4 h-4 bg-green-500/50 rounded-full animate-pulse pointer-events-none" />
                    )}

                    {/* Piece */}
                    {piece && (
                      <div className={`
                        w-[80%] h-[80%] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.4),inset_0_-4px_4px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.3)]
                        flex items-center justify-center transition-transform duration-200
                        ${piece.player === 'red' 
                          ? 'bg-gradient-to-br from-red-500 to-red-700 ring-1 ring-red-900' 
                          : 'bg-gradient-to-br from-stone-700 to-stone-900 ring-1 ring-black'}
                        ${isSelected ? 'scale-110 ring-4 ring-yellow-400 z-10' : ''}
                        ${mustJumpFrom && piece === board[mustJumpFrom.row][mustJumpFrom.col] ? 'ring-4 ring-orange-500' : ''}
                        cursor-pointer
                      `}>
                        <div className={`w-[70%] h-[70%] rounded-full border-2 opacity-30 ${piece.player === 'red' ? 'border-red-900' : 'border-stone-500'}`}></div>
                        {piece.isKing && (
                          <Crown className={`absolute w-3/5 h-3/5 ${piece.player === 'red' ? 'text-red-950' : 'text-stone-400'}`} strokeWidth={2.5} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>
      </div>

      {/* Winner Overlay */}
      {winner && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-stone-800 p-8 rounded-2xl shadow-2xl text-center border border-stone-600 max-w-sm mx-4">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">
              {winner === 'draw' ? 'Game Drawn!' : `${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins!`}
            </h2>
            <p className="text-stone-400 mb-6">
              {gameMode === 'ai' && winner === 'black' ? 'The AI outsmarted you.' : 'Congratulations!'}
            </p>
            <button 
              onClick={resetGame}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}