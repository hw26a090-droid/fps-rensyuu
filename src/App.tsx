import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Timer, 
  Trophy, 
  Zap, 
  RotateCcw, 
  Info, 
  Sparkles, 
  History, 
  TrendingUp, 
  Trash2,
  CheckCircle,
  AlertCircle,
  Flame,
  Activity,
  Calendar,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// game states
enum GameState {
  IDLE = "IDLE",
  WAITING = "WAITING",
  ACTIVE = "ACTIVE",
  RESULT = "RESULT"
}

interface ScoreRecord {
  id: string;
  time: number;
  date: string;
  hz?: number;
}

export default function App() {
  const [status, setStatus] = useState<GameState>(GameState.IDLE);
  const [isCircleVisible, setIsCircleVisible] = useState<boolean>(false);
  const [reactionTime, setReactionTime] = useState<number | null>(null); // Stores average score of 5 rounds
  const [history, setHistory] = useState<ScoreRecord[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>("RD-992-B");

  // New states for the 5-round game mode
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [lastRoundResult, setLastRoundResult] = useState<number | null>(null);
  const [foulRounds, setFoulRounds] = useState<number[]>([]);

  // Refresh rate configurations
  const [refreshRate, setRefreshRate] = useState<number>(240);
  const [detectedHz, setDetectedHz] = useState<number | null>(null);
  const [showThresholds, setShowThresholds] = useState<boolean>(true);

  const timeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Generate random lab session ID on mount
  useEffect(() => {
    const randomHex = Math.floor(100 + Math.random() * 900);
    const suffix = ["A", "B", "C", "X", "Y"][Math.floor(Math.random() * 5)];
    setSessionId(`LAB-${randomHex}-${suffix}`);
  }, []);

  // Load refresh rate from storage if available
  useEffect(() => {
    try {
      const savedHz = localStorage.getItem("reaction_tester_refreshrate");
      if (savedHz) {
        setRefreshRate(Number(savedHz));
      }
    } catch (e) {
      console.error("Local storage read for refresh rate failed", e);
    }
  }, []);

  // Frame rate (refresh rate) automated detector
  useEffect(() => {
    let start: number | null = null;
    let frames = 0;
    let rafId: number;

    const measure = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      frames++;

      if (elapsed < 1000) {
        rafId = requestAnimationFrame(measure);
      } else {
        const measuredHz = Math.round((frames * 1000) / elapsed);
        setDetectedHz(measuredHz);

        const savedHz = localStorage.getItem("reaction_tester_refreshrate");
        if (!savedHz) {
          const standardHzs = [60, 75, 90, 120, 144, 165, 240, 280, 360, 500];
          const closestHz = standardHzs.reduce((prev, curr) => 
            Math.abs(curr - measuredHz) < Math.abs(prev - measuredHz) ? curr : prev
          );
          if (Math.abs(closestHz - measuredHz) <= 15) {
            setRefreshRate(closestHz);
          } else {
            setRefreshRate(measuredHz > 30 ? measuredHz : 60);
          }
        }
      }
    };

    rafId = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  const changeRefreshRate = (hz: number) => {
    setRefreshRate(hz);
    try {
      localStorage.setItem("reaction_tester_refreshrate", String(hz));
    } catch (e) {
      console.error("Local storage save for refresh rate failed", e);
    }
  };

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("reaction_tester_scores");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Local storage access failed", e);
    }
  }, []);

  // Save history to localStorage
  const saveHistory = (newHistory: ScoreRecord[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("reaction_tester_scores", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save to local storage", e);
    }
  };

  // Helper to format date with "M/D H:mm" format (e.g., 6/10 14:32)
  const formatRecordDate = (dateObj: Date): string => {
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const hours = dateObj.getHours().toString().padStart(2, "0");
    const minutes = dateObj.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // Determine performance rank based on average reaction time (with Refresh-Rate offset calibration)
  const getRank = (avgTime: number, hz: number = refreshRate) => {
    const offset = hz === 240 ? 0 : (500 / hz) - 2.1;

    if (avgTime <= 150 + offset) {
      return {
        name: "最高",
        color: "text-rose-400 border-rose-500/30 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.35)]"
      };
    }
    if (avgTime <= 170 + offset) {
      return {
        name: "とても良い",
        color: "text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
      };
    }
    if (avgTime <= 190 + offset) {
      return {
        name: "良い",
        color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
      };
    }
    if (avgTime <= 220 + offset) {
      return {
        name: "平均以上",
        color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
      };
    }
    if (avgTime <= 260 + offset) {
      return {
        name: "平均",
        color: "text-blue-400 border-blue-500/30 bg-blue-500/10 shadow-[0_0_20px_rgba(96,165,250,0.35)]"
      };
    }
    if (avgTime <= 320 + offset) {
      return {
        name: "平均以下",
        color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_20px_rgba(129,140,248,0.2)]"
      };
    }
    if (avgTime <= 400 + offset) {
      return {
        name: "遅い",
        color: "text-yellow-500/95 border-yellow-500/20 bg-yellow-500/5 shadow-none"
      };
    }
    if (avgTime <= 500 + offset) {
      return {
        name: "とても遅い",
        color: "text-slate-400 border-slate-700 bg-slate-800/20 shadow-none"
      };
    }
    return {
      name: "練習が必要",
      color: "text-rose-500/90 border-rose-950 bg-rose-950/10 shadow-none"
    };
  };

  // Get performance thresholds calibrated for current refresh rate
  const getThresholdList = (hz: number) => {
    const os = hz === 240 ? 0 : (500 / hz) - 2.1;
    const f = (val: number) => {
      const res = val + os;
      return (Math.round(res * 10) / 10).toFixed(1);
    };

    return [
      { name: "最高", range: `${f(150)} ms 以下`, color: "text-rose-400 border-rose-500/20 bg-rose-500/5" },
      { name: "とても良い", range: `${f(150)} ms 超 〜 ${f(170)} ms`, color: "text-amber-400 border-amber-500/20 bg-amber-500/5" },
      { name: "良い", range: `${f(170)} ms 超 〜 ${f(190)} ms`, color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
      { name: "平均以上", range: `${f(190)} ms 超 〜 ${f(220)} ms`, color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5" },
      { name: "平均", range: `${f(220)} ms 超 〜 ${f(260)} ms`, color: "text-blue-400 border-blue-500/20 bg-blue-500/5" },
      { name: "平均以下", range: `${f(260)} ms 超 〜 ${f(320)} ms`, color: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5" },
      { name: "遅い", range: `${f(320)} ms 超 〜 ${f(400)} ms`, color: "text-yellow-500/90 border-yellow-500/15 bg-yellow-500/5" },
      { name: "とても遅い", range: `${f(400)} ms 超 〜 ${f(500)} ms`, color: "text-slate-400 border-slate-700 bg-slate-800/10" },
      { name: "練習が必要", range: `${f(500)} ms 超`, color: "text-rose-500/90 border-rose-950 bg-rose-950/10" }
    ];
  };

  // Starts a completely new 5-round testing play session
  const startFullGame = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setCurrentRound(1);
    setRoundScores([]);
    setLastRoundResult(null);
    setFoulRounds([]);
    setReactionTime(null);
    setIsCircleVisible(false);
    setStatus(GameState.WAITING);

    // Random duration for the 1st round
    const randomDelay = 1500 + Math.random() * 2500;

    timeoutRef.current = window.setTimeout(() => {
      requestAnimationFrame(() => {
        startTimeRef.current = performance.now();
        setIsCircleVisible(true);
        setStatus(GameState.ACTIVE);
      });
    }, randomDelay);
  }, []);

  // Starts the next round within the ongoing session
  const startNextRound = useCallback((nextRoundIndex: number, currentScores: number[]) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setCurrentRound(nextRoundIndex);
    setLastRoundResult(null);
    setIsCircleVisible(false);
    setStatus(GameState.WAITING);

    const randomDelay = 1500 + Math.random() * 2500;

    timeoutRef.current = window.setTimeout(() => {
      requestAnimationFrame(() => {
        startTimeRef.current = performance.now();
        setIsCircleVisible(true);
        setStatus(GameState.ACTIVE);
      });
    }, randomDelay);
  }, []);

  // Core Game: Handles pointer interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Avoid double triggering
    e.preventDefault();

    if (status === GameState.ACTIVE) {
      const clickTime = performance.now();
      const difference = clickTime - startTimeRef.current;
      
      const roundedTime = Math.round(difference * 10) / 10; // 1 decimal precision
      const updatedScores = [...roundScores, roundedTime];
      
      setIsCircleVisible(false);
      setLastRoundResult(roundedTime);
      setRoundScores(updatedScores);
      setStatus(GameState.RESULT);

      if (updatedScores.length < 5) {
        // Automatically queue the next round after displaying intermediate round score for 1.5 seconds
        timeoutRef.current = window.setTimeout(() => {
          startNextRound(updatedScores.length + 1, updatedScores);
        }, 1500);
      } else {
        // 5 Rounds completely finished. Calc average
        const scoreSum = updatedScores.reduce((acc, c) => acc + c, 0);
        const calculatedAverage = Math.round((scoreSum / 5) * 10) / 10;
        setReactionTime(calculatedAverage);

        const newRecord: ScoreRecord = {
          id: Math.random().toString(36).substring(2, 11),
          time: calculatedAverage,
          date: formatRecordDate(new Date()),
          hz: refreshRate
        };

        saveHistory([newRecord, ...history]);
      }
    } else if (status === GameState.WAITING) {
      // Early clicking before circle display is treated as "お手つき" with a penalty score of 1000ms.
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      const roundedTime = 1000;
      const updatedScores = [...roundScores, roundedTime];
      
      setIsCircleVisible(false);
      setLastRoundResult(roundedTime);
      setFoulRounds(prev => [...prev, roundScores.length]);
      setRoundScores(updatedScores);
      setStatus(GameState.RESULT);

      if (updatedScores.length < 5) {
        timeoutRef.current = window.setTimeout(() => {
          startNextRound(updatedScores.length + 1, updatedScores);
        }, 1550); // Give a slightly longer gap for "お手つき" display so progress feels smooth
      } else {
        // 5 Rounds completely finished with this foul
        const scoreSum = updatedScores.reduce((acc, c) => acc + c, 0);
        const calculatedAverage = Math.round((scoreSum / 5) * 10) / 10;
        setReactionTime(calculatedAverage);

        const newRecord: ScoreRecord = {
          id: Math.random().toString(36).substring(2, 11),
          time: calculatedAverage,
          date: formatRecordDate(new Date()),
          hz: refreshRate
        };

        saveHistory([newRecord, ...history]);
      }
    }
  };

  // Keyboard shortcut support: Space to start/retry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // prevent browser scrolling
        if (status === GameState.IDLE || (status === GameState.RESULT && roundScores.length === 5)) {
          startFullGame();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [status, roundScores, startFullGame]);

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Compute Statistics
  const attemptsCount = history.length;
  const bestTime = attemptsCount > 0 ? Math.min(...history.map((h) => h.time)) : null;
  const avgTime = attemptsCount > 0 
    ? Math.round(history.reduce((acc, curr) => acc + curr.time, 0) / attemptsCount) 
    : null;

  // Clear Game History
  const clearHistory = () => {
    saveHistory([]);
    setShowClearConfirm(false);
  };

  // Helper values for custom SVG graph with premium cyber glow lines
  const renderSvgGraph = () => {
    const records = [...history].reverse(); // oldest to newest
    if (records.length < 2) return null;

    const width = 500;
    const height = 150;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const minScore = Math.min(...records.map(r => r.time));
    const maxScore = Math.max(...records.map(r => r.time));
    const scoreRange = maxScore - minScore === 0 ? 100 : maxScore - minScore;

    // Create coordinates
    const points = records.map((record, index) => {
      const x = paddingLeft + (index / (records.length - 1)) * chartWidth;
      // y is inverted because SVG origin 0,0 is at top left
      const y = paddingTop + chartHeight - ((record.time - minScore) / scoreRange) * chartHeight;
      return { x, y, time: record.time, id: record.id };
    });

    const pathData = points.reduce((acc, p, index) => {
      return acc + (index === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
    }, "");

    return (
      <div className="w-full h-full min-h-[160px] relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Horizontal Grid lines */}
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#334155" strokeWidth="1.5" />

          {/* Axes labels */}
          <text x={paddingLeft - 8} y={paddingTop + 4} fill="#64748b" fontSize="9" textAnchor="end" className="font-mono">{Math.round(maxScore)}</text>
          <text x={paddingLeft - 8} y={paddingTop + chartHeight / 2 + 4} fill="#64748b" fontSize="9" textAnchor="end" className="font-mono">{Math.round((maxScore + minScore) / 2)}</text>
          <text x={paddingLeft - 8} y={paddingTop + chartHeight + 4} fill="#64748b" fontSize="9" textAnchor="end" className="font-mono">{Math.round(minScore)}</text>

          {/* Line Path */}
          <path
            d={pathData}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
          />

          {/* Area under the line */}
          <path
            d={`${pathData} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`}
            fill="url(#chart-gradient)"
            opacity="0.12"
          />

          {/* Points dots */}
          {points.map((p) => (
            <g key={p.id} className="group cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                fill="#020617"
                stroke="#22d3ee"
                strokeWidth="2"
                className="transition-all duration-200 hover:r-5 hover:stroke-cyan-300"
              />
              {/* Tooltip on hovering point */}
              <rect
                x={p.x - 22}
                y={p.y - 28}
                width="44"
                height="18"
                rx="4"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="1"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
              />
              <text
                x={p.x}
                y={p.y - 16}
                fill="#38bdf8"
                fontSize="9"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 font-mono font-bold transition-opacity duration-150 pointer-events-none"
              >
                {Math.round(p.time)}
              </text>
            </g>
          ))}

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between antialiased selection:bg-cyan-500/20 selection:text-cyan-300 relative overflow-hidden">
      
      {/* Sci-fi immersive background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[50%] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Upper Laboratory Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md py-5 px-6 md:px-12 flex justify-between items-center shrink-0 shadow-[0_1px_15px_rgba(0,0,0,0.5)] z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-mono font-black text-xl shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            μ
          </div>
          <div>
            <h1 className="text-sm md:text-base font-black tracking-[0.3em] text-cyan-400 uppercase leading-none font-sans">
              REFLEX LABORATORY v1.0
            </h1>
            <p className="text-[10px] text-slate-500 font-mono font-semibold tracking-wider mt-1.5 uppercase">
              HIGH-PRECISION BENCHMARK UTILITY
            </p>
          </div>
        </div>
        
        {/* Session ID status with sci-fi terminal vibe */}
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/60 border border-slate-800 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400 font-medium">{sessionId}</span>
          </div>
          <div className="text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>LATENCY: OPTIMAL</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start z-10">
        
        {/* Center / Left Panel Game space */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Refresh Rate Calibration Control */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col gap-3.5 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 font-sans">
                <div className="p-1 px-2 rounded bg-cyan-400/10 text-cyan-400 text-[10px] font-mono border border-cyan-500/20 font-bold">
                  CALIBRATION
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">基準リフレッシュレート設定</h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    モニターの描画速度に合わせて判定基準を自動または手動で調整します
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                {detectedHz !== null && (
                  <span className="text-[10px] font-mono font-bold text-slate-500 border border-slate-900 bg-slate-950/40 rounded-lg px-2 py-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block animate-pulse" />
                    実測: <strong className="text-cyan-400 font-extrabold">{detectedHz}Hz</strong>
                  </span>
                )}
                <select
                  value={refreshRate}
                  onChange={(e) => changeRefreshRate(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer hover:border-slate-700"
                >
                  {[60, 75, 90, 120, 144, 165, 240, 280, 360, 500].map((hz) => (
                    <option key={hz} value={hz}>
                      {hz}Hz {hz === 240 ? "(240Hz基準)" : ""} {detectedHz !== null && Math.abs(detectedHz - hz) <= 15 ? "(自動検出)" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowThresholds(!showThresholds)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold transition-all border border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 px-2.5 py-1.5 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  {showThresholds ? "基準表を閉じる" : "基準表を表示"}
                </button>
              </div>
            </div>

            {/* Threshold Reference Table */}
            {showThresholds && (
              <div className="border-t border-slate-900/60 pt-3 mt-0.5">
                <div className="text-[10px] font-bold text-slate-400 mb-2 flex items-center justify-between gap-1">
                  <span>{refreshRate}Hzモニター向け 判定基準値一覧</span>
                  <span className="text-slate-500 text-[9px] font-normal font-mono">
                    {refreshRate === 240 ? "基準 (オフセットなし)" : `基準オフセット: +${((500 / refreshRate) - 2.1).toFixed(1)}ms`}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {getThresholdList(refreshRate).map((t, idx) => (
                    <div 
                      key={idx} 
                      className={`flex flex-col p-1.5 px-2.5 rounded-xl border text-left transition-colors duration-150 ${t.color}`}
                    >
                      <span className="text-[9px] font-sans font-extrabold tracking-tight">{t.name}</span>
                      <span className="text-[10px] font-mono tracking-tight font-bold opacity-90 mt-0.5">{t.range}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reaction Arena Card */}
          <div 
            id="reaction-arena-container"
            onPointerDown={handlePointerDown}
            className={`w-full min-h-[440px] md:min-h-[480px] rounded-3xl border transition-all duration-300 relative overflow-hidden select-none flex flex-col items-center justify-center ${
              status === GameState.IDLE 
                ? "bg-slate-900/40 border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-xs" 
                : status === GameState.WAITING 
                ? "bg-slate-950/60 border-rose-500/20 shadow-[inset_0_0_50px_rgba(244,63,94,0.05)] cursor-not-allowed"
                : status === GameState.ACTIVE
                ? "bg-cyan-950/10 border-cyan-500/40 cursor-crosshair shadow-[inset_0_0_60px_rgba(34,211,238,0.1)]"
                : "bg-slate-900/40 border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
            }`}
          >
            {/* Immersive cyber scanning backdrop lines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Current Round Badge */}
            {status !== GameState.IDLE && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-[10px] font-mono font-bold tracking-wider text-cyan-400 flex items-center gap-1.5 shadow-sm z-20">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>ROUND {currentRound}/5</span>
              </div>
            )}

            {/* Glowing screen visual feedback */}
            <AnimatePresence>
              {status === GameState.WAITING && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-radial-[circle_at_center,rgba(244,63,94,0.06)_0%,transparent_80%] pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* Target Circle (RequestAnimationFrame Synchronized Display) */}
            <div 
              style={{ display: isCircleVisible ? 'flex' : 'none' }} 
              className="absolute inset-0 bg-transparent flex flex-col items-center justify-center p-4 pointer-events-none z-30"
            >
              {/* Massive neon glowing interactive target */}
              <div className="relative flex items-center justify-center">
                {/* Outward pulsing ring */}
                <div className="absolute w-[360px] h-[360px] md:w-[410px] md:h-[410px] rounded-full bg-cyan-500/15 animate-ping duration-1000" />
                <div className="absolute w-80 h-80 md:w-92 md:h-92 rounded-full border border-cyan-400/40 animate-pulse" />
                
                {/* Core Circle resembling precision lab targeting systems */}
                <div className="relative w-64 h-64 md:w-76 md:h-76 rounded-full bg-cyan-400 flex flex-col items-center justify-center text-slate-950 font-sans shadow-[0_0_80px_rgba(34,211,238,0.7),inset_0_0_25px_rgba(255,255,255,0.6)] border-4 border-white">
                  <Flame className="w-12 h-12 mb-2 animate-bounce text-slate-950" />
                  <span className="font-black text-3xl md:text-4xl tracking-wider select-none pr-1 uppercase leading-none">
                    CLICK!
                  </span>
                  <div className="h-px w-24 bg-slate-950/30 my-2" />
                  <span className="text-[10px] font-bold tracking-widest opacity-80 uppercase">
                    TOUCH ANYWHERE
                  </span>
                </div>
              </div>
            </div>

            {/* Interaction screens */}
            <div className="flex flex-col items-center p-5 text-center max-w-lg w-full relative z-20 pointer-events-auto">
              
              {/* IDLE State View */}
              {status === GameState.IDLE && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.1)] mb-6">
                    <Timer className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3 tracking-wider uppercase font-sans">
                    REFLEX TEST START
                  </h3>
                  
                  {/* Step instructions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full mb-5 mt-2">
                    {/* Step 1 */}
                    <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-3 flex flex-col items-center text-center transition-all hover:border-slate-800/80">
                      <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-500 text-[10px] font-black text-slate-950 rounded-full flex items-center justify-center font-sans">1</span>
                        <Timer className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h4 className="text-xs font-black text-slate-200">待つ</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight font-medium">
                        円が出るまで画面を注視
                      </p>
                      <span className="text-[9px] text-slate-500 mt-1 block font-medium font-mono">
                        (ランダム約1.5〜4秒)
                      </span>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-3 flex flex-col items-center text-center transition-all hover:border-slate-800/80">
                      <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-500 text-[10px] font-black text-slate-950 rounded-full flex items-center justify-center font-sans">2</span>
                        <Zap className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h4 className="text-xs font-black text-slate-200">即クリック</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight font-medium">
                        円が出たら素早くタップ
                      </p>
                      <span className="text-[9px] text-slate-500 mt-1 block font-medium">
                        (画面のどこでもOK)
                      </span>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-3 flex flex-col items-center text-center transition-all hover:border-slate-800/80">
                      <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-500 text-[10px] font-black text-slate-950 rounded-full flex items-center justify-center font-sans">3</span>
                        <Trophy className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h4 className="text-xs font-black text-slate-200">スコア算出</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight font-medium">
                        5ラウンドの平均で測定
                      </p>
                      <span className="text-[9px] text-slate-500 mt-1 block font-medium font-mono">
                        (測定単位: ms)
                      </span>
                    </div>
                  </div>

                  {/* Warning label */}
                  <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-rose-400 bg-rose-950/20 border border-rose-950/40 rounded-xl px-4 py-2 mb-8 max-w-sm w-full mx-auto">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>⚠️ フライングはお手つき(そのラウンドは1000ms)</span>
                  </div>
                  
                  <button
                    id="btn-start"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent parent callbacks
                      startFullGame();
                    }}
                    className="group relative inline-flex items-center gap-3 px-10 py-4 bg-cyan-500 hover:bg-cyan-400 font-extrabold tracking-[0.2em] text-slate-950 uppercase rounded-xl transition-all duration-200 cursor-pointer hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] active:scale-97 text-sm"
                  >
                    <span>テスト開始</span>
                    <Sparkles className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
                  </button>
                  <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-5">
                    OR PRESS [ SPACEBAR ] KEY TO BIND
                  </p>
                </motion.div>
              )}

              {/* WAITING State View */}
              {status === GameState.WAITING && (
                <div className="flex flex-col items-center pointer-events-none select-none">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="font-mono text-sm tracking-[0.4em] font-extrabold text-rose-500/90 uppercase">
                      WAIT...
                    </span>
                  </div>
                </div>
              )}

              {/* ACTIVE State (Circular overlay visual is rendered separately) */}
              {status === GameState.ACTIVE && (
                <div className="pointer-events-none select-none">
                  <h3 className="text-transparent">CLICK NOW</h3>
                </div>
              )}

              {/* RESULT State View */}
              {status === GameState.RESULT && (
                <>
                  {/* Case A: Between rounds (1st to 4th round result) */}
                  {roundScores.length < 5 && lastRoundResult !== null && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center"
                    >
                      <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-1 font-mono">
                        ROUND {roundScores.length} RESULT
                      </span>
                      
                      {foulRounds.includes(roundScores.length - 1) ? (
                        <>
                          {/* Digital glowing timer dashboard showing お手つき in red */}
                          <div className="flex flex-col items-center mb-4">
                            <span className="text-5xl md:text-6xl font-black tracking-tight text-rose-500 select-all [text-shadow:0_0_25px_rgba(244,63,94,0.4)]">
                              お手つき!
                            </span>
                            <span className="text-sm font-semibold font-mono text-rose-400/80 mt-1">
                              1000 ms ペナルティ
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Digital glowing timer dashboard */}
                          <div className="flex items-baseline mb-4 text-white">
                            <span className="text-6xl md:text-7xl font-black font-mono tracking-tighter text-cyan-400 select-all [text-shadow:0_0_25px_rgba(34,211,238,0.3)]">
                              {lastRoundResult}
                            </span>
                            <span className="text-xl font-black font-mono tracking-wider ml-1.5 text-cyan-400">
                              ms
                            </span>
                          </div>
                        </>
                      )}
                      
                      {/* Automatical countdown loader */}
                      <div className="mt-4 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block mr-1" />
                          <span>まもなく自動的に次のラウンドへ進みます...</span>
                        </div>
                        <div className="w-48 h-1 bg-slate-950 rounded-full overflow-hidden mt-1.5 border border-slate-900">
                          <motion.div 
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 1.5, ease: "linear" }}
                            className="h-full bg-cyan-400"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Case B: Final scores calculation (All 5 rounds complete) */}
                  {roundScores.length === 5 && reactionTime !== null && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center w-full"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 tracking-[0.2em] uppercase mb-1 font-mono">
                        <Trophy className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                        <span>TEST TIMELINE COMPLETED</span>
                      </div>
                      
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider font-mono uppercase mb-1">
                        5-ROUND AVERAGE (今回のスコア)
                      </span>

                      {/* Giant Average Reaction value & Evaluation Rank Badge */}
                      <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-4 mt-2 bg-slate-950/40 border border-slate-900/60 rounded-3xl py-4 px-8 w-full max-w-sm">
                        <div className="flex items-baseline text-white">
                          <span className="text-5xl md:text-6xl font-black font-mono tracking-tighter text-amber-400 select-all [text-shadow:0_0_25px_rgba(245,158,11,0.25)]">
                            {reactionTime}
                          </span>
                          <span className="text-lg font-black font-mono tracking-wider ml-1.5 text-amber-400">
                             ms
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">
                            RANK
                          </span>
                          <div className={`px-3 h-14 min-w-[5.5rem] rounded-2xl border text-[11px] md:text-xs font-bold font-sans flex items-center justify-center tracking-wide shadow-sm whitespace-nowrap ${getRank(reactionTime, refreshRate).color}`}>
                            {getRank(reactionTime, refreshRate).name}({refreshRate}Hz基準)
                          </div>
                        </div>
                      </div>



                      {/* Details of individual rounds */}
                      <div className="w-full bg-slate-950/60 border border-slate-900 rounded-2xl p-4 mb-6 text-left">
                        <h4 className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-3 flex items-center justify-between border-b border-slate-900 pb-2">
                          <span>5回の反応時間一覧</span>
                          <span className="text-[9px] text-slate-500 font-normal">INDIVIDUAL SAMPLES</span>
                        </h4>
                        <div className="grid grid-cols-5 gap-2">
                          {roundScores.map((score, idx) => {
                            const isFoul = foulRounds.includes(idx);
                            if (isFoul) {
                              return (
                                <div key={idx} className="flex flex-col items-center bg-rose-950/20 border border-rose-500/20 rounded-xl py-2 px-1 relative shadow-sm text-center">
                                  <span className="text-[9px] font-mono font-bold text-rose-400/80 mb-1">#{idx + 1}</span>
                                  <span className="text-[10px] font-extrabold text-rose-400 tracking-tighter leading-tight">お手つき</span>
                                  <span className="text-[9px] font-mono font-medium text-rose-500/95 mt-0.5 whitespace-nowrap">(1000ms)</span>
                                </div>
                              );
                            }
                            return (
                              <div key={idx} className="flex flex-col items-center bg-slate-900/60 border border-slate-800/60 rounded-xl py-2 px-1 relative shadow-sm">
                                <span className="text-[9px] font-mono font-bold text-slate-500 mb-1">#{idx + 1}</span>
                                <span className="text-xs font-bold font-mono text-slate-200">{score}</span>
                                <span className="text-[8px] font-mono text-cyan-400 mt-0.5">ms</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          id="btn-retry"
                          onClick={(e) => {
                            e.stopPropagation(); // prevent parent click callback
                            startFullGame();
                          }}
                          className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl transition-all font-black tracking-wider cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] text-xs uppercase"
                        >
                          <RotateCcw className="w-4 h-4 text-slate-950 group-hover:rotate-45 transition-transform" />
                          <span>もう一度プレイ</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono tracking-wider mt-5">
                        OR HOTKEY [ SPACEBAR ] TO RESTART
                      </p>
                    </motion.div>
                  )}
                </>
              )}

            </div>
          </div>

          {/* Quick Technical Specs Info Box */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 shadow-inner flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-cyan-950/50 text-cyan-400 flex-shrink-0 border border-cyan-800/20">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1 font-mono">
                LAB SPECIFICATIONS / SYSTEM CALIBRATION
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                当システムは、インプット遅延を限界までそぎ落とす設計を採用しています。一般的なクリック検出（MouseUp）ではなく、指が接触した極限タイミングを捉える <strong>PointerDown</strong> イベントによる先行サンプリングを実施。さらに、描画サイクルとの同期ズレを防ぐ <strong>requestAnimationFrame</strong> による同期制御と <strong>performance.now()</strong>（マイクロ秒ベースの高精度タイマー）を直結させることで、OS・ブラウザ依存のタイム測定ラグをクリアに補正しています。
              </p>
            </div>
          </div>

        </div>

        {/* Sidebar Panel: Metrics and Records history */}
        <div className="col-span-1 flex flex-col gap-6">
          
          {/* Quick Stats Grid with cyan accents */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Average time */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 shadow-sm relative">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold font-mono tracking-widest text-slate-500 uppercase">AVG RATE</span>
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="flex items-baseline mt-2">
                <span className="text-2xl font-black font-mono tracking-tight text-white select-all">
                  {avgTime ? avgTime : "---"}
                </span>
                <span className="text-[10px] font-bold ml-1 text-cyan-400 uppercase font-mono">
                  ms
                </span>
              </div>
              <p className="text-[9px] text-slate-500 font-sans mt-2.5 leading-none font-medium">
                SAMPLED AT {attemptsCount} SESSIONS
              </p>
            </div>

            {/* Best Record */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 shadow-sm relative">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold font-mono tracking-widest text-slate-500 uppercase">PEAK SPEED</span>
                <Trophy className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              </div>
              <div className="flex items-baseline mt-2">
                <span className="text-2xl font-black font-mono tracking-tight text-amber-400 select-all">
                  {bestTime ? bestTime : "---"}
                </span>
                <span className="text-[10px] font-bold ml-1 text-amber-500 uppercase font-mono">
                  ms
                </span>
              </div>
              <p className="text-[9px] text-slate-500 font-sans mt-2.5 leading-none font-medium flex items-center gap-1">
                {bestTime ? (
                  <>
                    <CheckCircle className="w-2.5 h-2.5 text-amber-400" />
                    <span>OPTIMAL SCORE</span>
                  </>
                ) : (
                  "NO RECORDED LOGS"
                )}
              </p>
            </div>

          </div>

          {/* Graph Progress (Cyber Theme) */}
          {history.length >= 2 && (
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-2 font-mono">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  SPEED MATRIX GRAPH
                </h4>
                <span className="text-[9px] text-slate-500 font-mono uppercase">LOWER = FASTER</span>
              </div>
              <div className="aspect-[16/10] w-full flex items-center justify-center p-2.5 bg-slate-950/60 rounded-xl border border-slate-900/80">
                {renderSvgGraph()}
              </div>
            </div>
          )}

          {/* Score History List Card */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[460px]">
            <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-900 flex flex-col gap-3 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-bold text-slate-300 tracking-widest uppercase flex items-center gap-2 font-mono">
                  <History className="w-4 h-4 text-cyan-400" />
                  スコア履歴 ({attemptsCount})
                </h4>
                
                {attemptsCount > 0 && (
                  <div className="relative">
                    {showClearConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-rose-400 font-bold font-sans hidden sm:inline">履歴をすべてリセットしますか？</span>
                        <button 
                          onClick={clearHistory}
                          className="text-rose-400 hover:text-rose-300 px-2.5 py-1 bg-rose-500/15 border border-rose-500/30 rounded-lg cursor-pointer text-[10px] font-bold transition-colors"
                        >
                          はい(消去)
                        </button>
                        <button 
                          onClick={() => setShowClearConfirm(false)}
                          className="text-slate-400 hover:text-slate-300 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer text-[10px] font-bold transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/30 rounded-xl transition-all font-bold cursor-pointer text-[11px]"
                        title="履歴をリセット"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>履歴をリセット</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Outstanding Self-Best Score Display Banner */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.08)]">
                <div className="flex items-center gap-2 text-amber-400">
                  <Trophy className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest uppercase font-mono">PERSONAL BEST</span>
                </div>
                <span id="best-score-display" className="text-sm font-black font-mono text-amber-300 tracking-wider">
                  {bestTime !== null ? `BEST: ${bestTime}ms` : "BEST: ---ms"}
                </span>
              </div>
            </div>

            {/* List entries */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-950 p-2.5 space-y-2 bg-slate-950/30">
              {history.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-slate-500 px-4">
                  <AlertCircle className="w-6 h-6 stroke-slate-700 mb-2.5 animate-pulse" />
                  <p className="text-xs font-mono font-bold tracking-wider uppercase mb-1">NO TELEMETRY DATA</p>
                  <p className="text-[10px] text-slate-600 max-w-[200px]">Begin testing sequence to populate high frequency reaction logs.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {history.map((item, index) => {
                    const playNum = attemptsCount - index;
                    const itemHz = item.hz || 240;
                    const rankInfo = getRank(item.time, itemHz);
                    const isBest = bestTime !== null && item.time === bestTime;
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`p-3 rounded-xl flex items-center justify-between border transition-all ${
                          isBest 
                            ? "bg-amber-950/20 hover:bg-amber-950/30 border-amber-500/40 ring-1 ring-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]" 
                            : "bg-slate-900/35 hover:bg-slate-900/70 border-slate-900/60 shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold shadow-inner border ${
                            isBest 
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30" 
                              : "bg-slate-950 text-slate-500 border-slate-800"
                          }`}>
                            #{playNum}
                          </span>
                          <div>
                            <div className="font-mono text-sm font-black flex items-baseline">
                              <span className={isBest ? "text-amber-400 animate-pulse" : "text-slate-100"}>
                                {item.time}
                              </span>
                              <span className={`text-[10px] font-bold ml-1 ${isBest ? "text-amber-500" : "text-cyan-400"}`}>
                                ms
                              </span>
                              {isBest && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-md bg-amber-500 text-[8px] font-extrabold text-slate-950 uppercase leading-none flex items-center gap-0.5 animate-pulse">
                                  👑 BEST
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span className="tracking-tight">{item.date} {item.time}ms {rankInfo.name}({itemHz}Hz基準)</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Evaluation rank badge */}
                        <div className="flex items-center flex-shrink-0 ml-2">
                          <span className={`px-2.5 py-1 min-w-[2.5rem] rounded-xl border font-bold flex items-center justify-center text-[9px] md:text-[10px] whitespace-nowrap shadow-sm tracking-tight ${rankInfo.color}`}>
                            {rankInfo.name}({itemHz}Hz)
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* Cyberpunk Status Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-5 px-6 md:px-12 text-center text-[10px] font-mono font-semibold tracking-widest uppercase flex-shrink-0 mt-8 text-slate-500 z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div>© 2026 REFLEX LABORATORY ACCREDITED BENCHMARK UTILITY</div>
          <div className="text-cyan-500/60">
            SYSTEM STATUS: <span className="text-emerald-400">ONLINE</span> &bull; RESOLUTION: sub-millisecond level (performance.now)
          </div>
        </div>
      </footer>

    </div>
  );
}
