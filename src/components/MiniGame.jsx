import React, { useEffect, useRef, useState } from 'react';

const BEST_KEY = 'lv-tool:minigame-best';
const AREA_W = 280;
const AREA_H = 160;
const START_MS = 1100;
const MIN_MS = 350;
const START_SIZE = 34;
const MIN_SIZE = 16;

function randomPos(size) {
  return {
    x: Math.random() * (AREA_W - size),
    y: Math.random() * (AREA_H - size),
  };
}

// Extrem simples Reaktionsspiel: Punkt anklicken bevor die Zeit abläuft.
// Jeder Treffer macht die nächste Runde etwas schneller und den Punkt
// etwas kleiner - wird also von Runde zu Runde spürbar schwerer.
export default function MiniGame() {
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY)) || 0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(START_SIZE);
  const [roundMs, setRoundMs] = useState(START_MS);
  const [gameOver, setGameOver] = useState(false);
  const timerRef = useRef(null);

  function clearTimer() {
    clearTimeout(timerRef.current);
  }

  function spawnRound(nextSize, nextMs) {
    setPos(randomPos(nextSize));
    clearTimer();
    timerRef.current = setTimeout(() => {
      setGameOver(true);
      setRunning(false);
    }, nextMs);
  }

  function start() {
    setScore(0);
    setSize(START_SIZE);
    setRoundMs(START_MS);
    setGameOver(false);
    setRunning(true);
    spawnRound(START_SIZE, START_MS);
  }

  function hit() {
    const nextScore = score + 1;
    const nextMs = Math.max(MIN_MS, roundMs * 0.93);
    const nextSize = Math.max(MIN_SIZE, size - 1);
    setScore(nextScore);
    setRoundMs(nextMs);
    setSize(nextSize);
    if (nextScore > best) {
      setBest(nextScore);
      localStorage.setItem(BEST_KEY, String(nextScore));
    }
    spawnRound(nextSize, nextMs);
  }

  useEffect(() => clearTimer, []);

  return (
    <div className="minigame">
      <div className="minigame-header">
        <span>⚡ Reaktionsspiel</span>
        <span className="minigame-score">
          Score: {score} · Best: {best}
        </span>
      </div>
      <div className="minigame-area" style={{ width: AREA_W, height: AREA_H }}>
        {running && !gameOver && (
          <button
            className="minigame-dot"
            style={{ width: size, height: size, left: pos.x, top: pos.y }}
            onClick={hit}
          />
        )}
        {!running && (
          <div className="minigame-overlay">
            {gameOver ? (
              <>
                <div>Vorbei! Score: {score}</div>
                <button onClick={start}>Nochmal</button>
              </>
            ) : (
              <button onClick={start}>Spiel starten</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
