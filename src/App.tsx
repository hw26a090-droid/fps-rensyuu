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
  Layers,
  Download,
  FileCode,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// game states
enum GameState {
  IDLE = "IDLE",
  WAITING = "WAITING",
  ACTIVE = "ACTIVE",
  RESULT = "RESULT"
}

// Web Audio API helper for synthesizing feedback sounds
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch((e) => console.error("AudioContext resume failed", e));
    }
  }

  // 1. 円が出現した瞬間に、短く高めの「ピッ」という音を鳴らす (視覚反応速度の妨げになるため、廃止/消音となりました)
  playSpawn() {
    // 視覚反応測定を阻害しないよう、無音化（廃止）
  }

  // 2. 円をクリックして反応時間が記録されたときに、軽い「ポン」という成功音を鳴らす
  playSuccess() {
    try {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(550, now); // 550Hz
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.15); // ちょっと周波数を下げてマイルドにポン

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18); // 180ms

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.error("Failed to play success sound", e);
    }
  }

  // 3. お手つき(フライング)したときに、低めの「ブー」という警告音を鳴らす
  playFoul() {
    try {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(140, now);

      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(143, now); // 少しデチューンして不協和音

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35); // 350ms

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.error("Failed to play foul sound", e);
    }
  }

  // 自動再生制限解除(Unlock)
  unlock() {
    try {
      this.initContext();
    } catch (e) {
      // ignore
    }
  }
}

const synth = new SoundSynthesizer();

type CircleColor = "cyan" | "green" | "pink" | "yellow" | "white";

const COLOR_PRESETS = [
  { id: "cyan" as CircleColor, name: "シアン", bgClass: "bg-cyan-400", textClass: "text-slate-950", borderClass: "border-cyan-400/20", pingBgClass: "bg-cyan-500/10", glowClass: "shadow-[0_0_50px_rgba(34,211,238,0.4)]" },
  { id: "green" as CircleColor, name: "緑", bgClass: "bg-emerald-400", textClass: "text-slate-950", borderClass: "border-emerald-400/20", pingBgClass: "bg-emerald-500/10", glowClass: "shadow-[0_0_50px_rgba(52,211,153,0.4)]" },
  { id: "pink" as CircleColor, name: "ピンク", bgClass: "bg-pink-400", textClass: "text-slate-950", borderClass: "border-pink-400/20", pingBgClass: "bg-pink-500/10", glowClass: "shadow-[0_0_50px_rgba(244,114,182,0.4)]" },
  { id: "yellow" as CircleColor, name: "黄色", bgClass: "bg-yellow-400", textClass: "text-slate-950", borderClass: "border-yellow-400/20", pingBgClass: "bg-yellow-500/10", glowClass: "shadow-[0_0_50px_rgba(250,204,21,0.4)]" },
  { id: "white" as CircleColor, name: "白", bgClass: "bg-white", textClass: "text-slate-950", borderClass: "border-white/20", pingBgClass: "bg-white/10", glowClass: "shadow-[0_0_50px_rgba(255,255,255,0.3)]" },
];

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
  const [circleColor, setCircleColor] = useState<CircleColor>("cyan");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // New states for the 5-round game mode
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [lastRoundResult, setLastRoundResult] = useState<number | null>(null);
  const [foulRounds, setFoulRounds] = useState<number[]>([]);

  // Refresh rate configurations
  const [refreshRate, setRefreshRate] = useState<number>(240);
  const [detectedHz, setDetectedHz] = useState<number | null>(null);
  const [showThresholds, setShowThresholds] = useState<boolean>(true);
  const [showTechSpecs, setShowTechSpecs] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("reaction_tester_showsettings");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const toggleSettings = () => {
    const nextVal = !showSettings;
    setShowSettings(nextVal);
    try {
      localStorage.setItem("reaction_tester_showsettings", String(nextVal));
    } catch (e) {
      console.error("Local storage save for showSettings failed", e);
    }
  };

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

  // Load circle color from localStorage if available
  useEffect(() => {
    try {
      const savedColor = localStorage.getItem("reaction_tester_circlecolor");
      if (savedColor && ["cyan", "green", "pink", "yellow", "white"].includes(savedColor)) {
        setCircleColor(savedColor as CircleColor);
      }
    } catch (e) {
      console.error("Local storage read for circle color failed", e);
    }
  }, []);

  // Load sound preference from localStorage if available
  useEffect(() => {
    try {
      const savedSound = localStorage.getItem("reaction_tester_soundenabled");
      if (savedSound !== null) {
        const isEnabled = savedSound === "true";
        setSoundEnabled(isEnabled);
        synth.enabled = isEnabled;
      }
    } catch (e) {
      console.error("Local storage read for sound preference failed", e);
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

  const changeCircleColor = (color: CircleColor) => {
    setCircleColor(color);
    try {
      localStorage.setItem("reaction_tester_circlecolor", color);
    } catch (e) {
      console.error("Local storage save for circle color failed", e);
    }
  };

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    synth.enabled = nextVal;
    try {
      localStorage.setItem("reaction_tester_soundenabled", String(nextVal));
    } catch (e) {
      console.error("Local storage save for sound preference failed", e);
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

  // Aborts the current session and returns cleanly to the starting IDLE screen
  const returnToStart = useCallback((e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus(GameState.IDLE);
    setCurrentRound(1);
    setRoundScores([]);
    setLastRoundResult(null);
    setFoulRounds([]);
    setReactionTime(null);
    setIsCircleVisible(false);
  }, []);

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
    setIsCircleVisible(true); // Show candidate circle container during waiting
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
    setIsCircleVisible(true); // Show candidate circle container during waiting
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
    synth.unlock();

    if (status === GameState.ACTIVE) {
      const clickTime = performance.now();
      const difference = clickTime - startTimeRef.current;
      
      const roundedTime = Math.round(difference * 10) / 10; // 1 decimal precision
      const updatedScores = [...roundScores, roundedTime];
      
      setIsCircleVisible(false);
      setLastRoundResult(roundedTime);
      setRoundScores(updatedScores);
      setStatus(GameState.RESULT);
      synth.playSuccess();

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
      synth.playFoul();

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
        synth.unlock();
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between antialiased selection:bg-cyan-500/20 selection:text-cyan-300 relative overflow-hidden">
      
      {/* Ambient soft glow - extremely minimal */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[30%] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Upper Simple Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md py-4 px-6 md:px-12 flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-slate-950 font-sans font-bold text-base shadow-[0_0_10px_rgba(34,211,238,0.2)]">
            R
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold tracking-wider text-zinc-100 font-sans">
              REFLEX LABORATORY
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono font-medium tracking-wider mt-1 uppercase">
              反応速度測定ラボ
            </p>
          </div>
        </div>
        
        {/* Clickable Settings button & Simple Session badge */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              showSettings 
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20" 
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700"
            }`}
            title="測定設定の切り替え"
          >
            <Settings className={`w-3.5 h-3.5 ${showSettings ? "animate-[spin_4s_linear_infinite]" : ""}`} />
            <span>{showSettings ? "設定を閉じる" : "設定を開く"}</span>
          </button>
          
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-zinc-400 font-medium font-mono">今回の測定部屋: {sessionId}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start z-10">
        
        {/* Center / Left Panel Game space */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Refresh Rate Calibration Control */}
          <AnimatePresence initial={false}>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.99, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", scale: 1, marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, scale: 0.99, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 flex flex-col gap-3.5 overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 font-sans">
                    <div className="p-1 px-2 rounded bg-cyan-500/10 text-cyan-400 text-[10px] border border-cyan-500/20 font-bold">
                      設定
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">画面（モニター）のタイプ設定</h4>
                      <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                        お使いの画面のなめらかさ（ヘルツ：Hz）に合わせて判定基準を自動で調整します
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {detectedHz !== null && (
                      <span className="text-[10px] font-mono font-bold text-zinc-500 border border-zinc-900 bg-zinc-950/40 rounded-lg px-2 py-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block animate-pulse" />
                        今の画面: <strong className="text-cyan-400 font-bold">{detectedHz}Hz</strong>
                      </span>
                    )}
                    <select
                      value={refreshRate}
                      onChange={(e) => changeRefreshRate(Number(e.target.value))}
                      className="bg-zinc-950 border border-zinc-800 text-cyan-400 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer hover:border-zinc-700"
                    >
                      {[60, 75, 90, 120, 144, 165, 240, 280, 360, 500].map((hz) => (
                        <option key={hz} value={hz}>
                          {hz}Hz {hz === 240 ? "(標準のなめらかさ)" : ""} {detectedHz !== null && Math.abs(detectedHz - hz) <= 15 ? "(おすすめ)" : ""}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowThresholds(!showThresholds)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold transition-all border border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 px-2.5 py-1.5 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      {showThresholds ? "判定ラインを閉じる" : "判定ラインを見る"}
                    </button>
                  </div>
                </div>

                {/* Circle Color Selector */}
                <div className="border-t border-zinc-900/40 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 font-sans">
                    <div className="p-1 px-2 rounded bg-cyan-500/10 text-cyan-400 text-[10px] border border-cyan-500/20 font-bold">
                      外観
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">円のカラー設定</h4>
                      <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                        円が飛び出してきたとき（たたいてよい時）の色をお好みで変更できます
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-start sm:self-auto bg-zinc-950/40 p-1.5 rounded-2xl border border-zinc-900/80">
                    {COLOR_PRESETS.map((p) => {
                      const isSelected = circleColor === p.id;
                      let bgBtn = "";
                      if (p.id === "cyan") bgBtn = "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]";
                      else if (p.id === "green") bgBtn = "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]";
                      else if (p.id === "pink") bgBtn = "bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.3)]";
                      else if (p.id === "yellow") bgBtn = "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.3)]";
                      else if (p.id === "white") bgBtn = "bg-white shadow-[0_0_8px_rgba(255,255,255,0.2)]";

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => changeCircleColor(p.id)}
                          className={`w-6 h-6 rounded-full ${bgBtn} flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                            isSelected 
                              ? "ring-2 ring-cyan-500 ring-offset-2 ring-offset-zinc-950 scale-105" 
                              : "opacity-40 hover:opacity-90"
                          }`}
                          title={p.name}
                        >
                          {isSelected && (
                            <span className="w-1.5 h-1.5 bg-zinc-950 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sound Toggle Selector */}
                <div className="border-t border-zinc-900/40 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 font-sans">
                    <div className="p-1 px-2 rounded bg-cyan-500/10 text-cyan-400 text-[10px] border border-cyan-500/20 font-bold">
                      音響
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">サウンド設定（効果音）</h4>
                      <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                        成功したときの音や、フライングしてしまったときの警告音の切り替え
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 self-start sm:self-auto bg-zinc-950/40 px-3 py-1.5 rounded-xl border border-zinc-900/80">
                    <button
                      type="button"
                      onClick={toggleSound}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        soundEnabled ? "bg-cyan-500" : "bg-zinc-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                          soundEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[10px] font-bold text-zinc-400 min-w-[24px]">
                      {soundEnabled ? "オン" : "オフ"}
                    </span>
                  </div>
                </div>

                {/* Threshold Reference Table */}
                {showThresholds && (
                  <div className="border-t border-zinc-900/60 pt-3 mt-0.5">
                    <div className="text-[10px] font-bold text-zinc-400 mb-2 flex items-center justify-between gap-1">
                      <span>{refreshRate}Hzの画面に合わせた合格ライン一覧 (ミリ秒＝1/1000秒単位)</span>
                      <span className="text-zinc-500 text-[9px] font-normal font-mono">
                        {refreshRate === 240 ? "通常測定（補正なし）" : `画面ズレの自動補正値: +${((500 / refreshRate) - 2.1).toFixed(1)}ms`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                      {getThresholdList(refreshRate).map((t, idx) => (
                        <div 
                          key={idx} 
                          className={`flex flex-col p-1.5 px-2.5 rounded-xl border text-left transition-colors duration-150 ${t.color}`}
                        >
                          <span className="text-[9px] font-sans font-bold tracking-tight">{t.name}</span>
                          <span className="text-[10px] font-mono tracking-tight font-bold opacity-90 mt-0.5">{t.range}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reaction Arena Card */}
          <div 
            id="reaction-arena-container"
            onPointerDown={handlePointerDown}
            className={`w-full min-h-[440px] md:min-h-[480px] rounded-3xl border transition-all duration-300 relative overflow-hidden select-none flex flex-col items-center justify-center ${
              status === GameState.IDLE 
                ? "bg-zinc-900/30 border-zinc-800 shadow-sm" 
                : status === GameState.WAITING 
                ? "bg-zinc-950/80 border-zinc-850 cursor-not-allowed"
                : status === GameState.ACTIVE
                ? "bg-zinc-900/40 border-cyan-500/20 cursor-crosshair"
                : "bg-zinc-900/30 border-zinc-800 shadow-sm"
            }`}
          >
            {/* Current Round Badge */}
            {status !== GameState.IDLE && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-zinc-950/90 border border-zinc-905 rounded-lg text-[10px] font-bold text-zinc-400 flex items-center gap-1.5 shadow-sm z-20">
                <span>第 {currentRound} / 5 回の挑戦</span>
              </div>
            )}

            {/* Back to Start Button */}
            {status !== GameState.IDLE && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  returnToStart(e);
                }}
                className="absolute top-4 right-4 px-3 py-1 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-cyan-400 rounded-lg flex items-center gap-1.5 shadow-sm z-30 transition-all cursor-pointer active:scale-95"
                title="計測を中断して最初のスタート画面に戻る"
              >
                <span>最初の画面に戻る</span>
              </button>
            )}

            {/* Target Circle (RequestAnimationFrame Synchronized Display) */}
            {isCircleVisible && (
              <div className="absolute inset-0 bg-transparent flex flex-col items-center justify-center p-4 pointer-events-none z-30">
                <div className="relative flex items-center justify-center">
                  {status === GameState.ACTIVE ? (
                    (() => {
                      const activePreset = COLOR_PRESETS.find(p => p.id === circleColor) || COLOR_PRESETS[0];
                      return (
                        <>
                          {/* Active state: Dynamic colored circle with simple appearance */}
                          <div className={`relative w-64 h-64 md:w-72 md:h-72 rounded-full ${activePreset.bgClass} flex flex-col items-center justify-center ${activePreset.textClass} font-sans ${activePreset.glowClass} border-2 border-white`}>
                            <Flame className={`w-10 h-10 mb-2 ${activePreset.textClass}`} />
                            <span className="font-bold text-3xl md:text-4xl tracking-widest select-none uppercase leading-none">
                              クリック！
                            </span>
                            <div className="h-px w-20 bg-slate-950/20 my-2" />
                            <span className="text-[10px] font-bold tracking-widest opacity-80">
                              画面をどこでもタップ
                            </span>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      {/* Waiting state: Small focus dot */}
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-500 relative" />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Interaction screens */}
            <div className="flex flex-col items-center p-5 text-center max-w-lg w-full relative z-20 pointer-events-auto">
              
              {/* IDLE State View */}
              {status === GameState.IDLE && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center text-cyan-400 mb-6">
                    <Timer className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-3 tracking-wider font-sans">
                    反応速度測定スタート
                  </h3>
                  
                  {/* Step instructions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full mb-5 mt-2">
                    {/* Step 1 */}
                    <div className="bg-[#0e0e11] border border-zinc-900 rounded-2xl p-3 flex flex-col items-center text-center">
                      <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-400 text-[10px] font-bold text-slate-950 rounded-full flex items-center justify-center font-sans">1</span>
                        <Timer className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h4 className="text-xs font-bold text-zinc-200">待つ</h4>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-tight font-medium">
                        円が出るまで画面を注視
                      </p>
                      <span className="text-[9px] text-zinc-500 mt-2 block font-medium">
                        (待つ長さ: 1.5〜4秒の間で毎回変わります)
                      </span>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-[#0e0e11] border border-zinc-900 rounded-2xl p-3 flex flex-col items-center text-center">
                      <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-400 text-[10px] font-bold text-slate-950 rounded-full flex items-center justify-center font-sans">2</span>
                        <Zap className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h4 className="text-xs font-bold text-zinc-200">タップ</h4>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-tight font-medium">
                        円が出たら素早くタップ
                      </p>
                      <span className="text-[9px] text-zinc-500 mt-2 block font-medium">
                        (画面のどこでもOK)
                      </span>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-[#0e0e11] border border-zinc-900 rounded-2xl p-3 flex flex-col items-center text-center">
                      <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-400 text-[10px] font-bold text-slate-950 rounded-full flex items-center justify-center font-sans">3</span>
                        <Trophy className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h4 className="text-xs font-bold text-zinc-200">記録を確認</h4>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-tight font-medium">
                        5回の平均タイムが記録に
                      </p>
                      <span className="text-[9px] text-zinc-500 mt-2 block font-medium font-mono">
                        (測定単位: ミリ秒=1/1000秒)
                      </span>
                    </div>
                  </div>

                  {/* Warning label */}
                  <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-rose-400 bg-rose-950/10 border border-rose-950/20 rounded-xl px-4 py-2 mb-8 max-w-sm w-full mx-auto font-sans">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>フライングはお手つきとなり、1.0秒（1000ms）のペナルティが加算されます</span>
                  </div>
                  
                  <button
                    id="btn-start"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent parent callbacks
                      synth.unlock();
                      startFullGame();
                    }}
                    className="group relative inline-flex items-center gap-2 px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 font-bold text-slate-950 rounded-xl transition-all duration-200 cursor-pointer active:scale-97 text-xs"
                  >
                    <span>測定開始</span>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                  </button>
                  <p className="text-[10px] text-zinc-500 tracking-wider mt-5">
                    またはキーボードの [ スペース ] キーでも開始できます
                  </p>
                </motion.div>
              )}

              {/* WAITING State View */}
              {status === GameState.WAITING && (
                <div className="flex flex-col items-center pointer-events-none select-none">
                  {/* Quiet state handled visually by grey circle */}
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
                      <span className="text-[10px] font-bold text-zinc-500 tracking-wider mb-2">
                        {roundScores.length}回目の測定結果
                      </span>
                      
                      {foulRounds.includes(roundScores.length - 1) ? (
                        <>
                          {/* Simple red penalty card for お手つき */}
                          <div className="flex flex-col items-center mb-4">
                            <span className="text-5xl md:text-6xl font-bold tracking-tight text-rose-500">
                              お手つき!
                            </span>
                            <span className="text-xs font-semibold text-rose-400 mt-1">
                              1.0秒（1000ms）ペナルティ加算
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Digital simple timer dashboard */}
                          <div className="flex items-baseline mb-4 text-zinc-100">
                            <span className="text-6xl md:text-7xl font-bold font-mono tracking-tighter text-cyan-400">
                              {lastRoundResult}
                            </span>
                            <span className="text-lg font-bold ml-1.5 text-cyan-400">
                              ms (ミリ秒)
                            </span>
                          </div>
                        </>
                      )}
                      
                      {/* Automatic countdown loader */}
                      <div className="mt-4 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                          <span>自動的に次の挑戦に進みます...</span>
                        </div>
                        <div className="w-48 h-1 bg-zinc-950 rounded-full overflow-hidden mt-1.5 border border-zinc-800">
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
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 tracking-wider mb-2">
                        <Trophy className="w-3.5 h-3.5 text-amber-405" />
                        <span>すべての測定が完了しました</span>
                      </div>
                      
                      <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1">
                        5回の平均タイム（今回の成績）
                      </span>

                      {/* Giant Average Reaction value & Evaluation Rank Badge */}
                      <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-4 mt-2 bg-zinc-950/80 border border-zinc-900 rounded-2xl py-4 px-8 w-full max-w-sm">
                        <div className="flex items-baseline text-zinc-100">
                          <span className="text-5xl md:text-6xl font-bold font-mono tracking-tighter text-amber-400">
                            {reactionTime}
                          </span>
                          <span className="text-base font-bold ml-1.5 text-amber-400">
                             ms (ミリ秒)
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold text-zinc-500 tracking-wider mb-1">
                            評価
                          </span>
                          <div className={`px-3.5 py-1.5 rounded-lg border text-[11px] md:text-xs font-bold font-sans flex items-center justify-center tracking-wide whitespace-nowrap ${getRank(reactionTime, refreshRate).color}`}>
                            {getRank(reactionTime, refreshRate).name}
                          </div>
                        </div>
                      </div>

                      {/* Details of individual rounds */}
                      <div className="w-full bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 mb-6 text-left">
                        <h4 className="text-[10px] font-bold text-zinc-400 mb-3 flex items-center justify-between border-b border-zinc-900 pb-2">
                          <span>5回の測定タイム一覧</span>
                        </h4>
                        <div className="grid grid-cols-5 gap-2">
                          {roundScores.map((score, idx) => {
                            const isFoul = foulRounds.includes(idx);
                            if (isFoul) {
                              return (
                                <div key={idx} className="flex flex-col items-center bg-rose-950/10 border border-rose-500/10 rounded-xl py-2 px-1 text-center">
                                  <span className="text-[9px] font-mono font-bold text-rose-455 mb-1">#{idx + 1}</span>
                                  <span className="text-[9px] font-bold text-rose-400 tracking-tighter">お手つき</span>
                                  <span className="text-[8px] font-mono text-rose-500 mt-0.5 whitespace-nowrap">(1.0秒ペナルティ)</span>
                                </div>
                              );
                            }
                            return (
                              <div key={idx} className="flex flex-col items-center bg-zinc-900/60 border border-zinc-800/60 rounded-xl py-2 px-1">
                                <span className="text-[9px] font-mono font-bold text-zinc-500 mb-1">#{idx + 1}</span>
                                <span className="text-xs font-bold font-mono text-zinc-200">{score}</span>
                                <span className="text-[8px] font-mono text-cyan-400 mt-0.5">ミリ秒</span>
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
                          className="group relative inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold text-xs uppercase cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-950" />
                          <span>もう一度プレイ</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium tracking-wider mt-5">
                        またはスペースキーでもう一度開始できます
                      </p>
                    </motion.div>
                  )}
                </>
              )}

            </div>
          </div>

          {/* Quick Technical Specs Info Box */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-4 sm:p-5">
            <button
              onClick={() => setShowTechSpecs(!showTechSpecs)}
              type="button"
              className="w-full flex items-center justify-between text-left group cursor-pointer focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                  <Zap className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                    高精度測定システム仕様
                    <span className="text-[9px] text-zinc-500 font-normal py-0.5 px-1.5 rounded bg-zinc-950 border border-zinc-900">
                      技術詳細 ⓘ
                    </span>
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                    ミリ秒未満の正確な計測と自動補正の裏側
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors select-none">
                {showTechSpecs ? "閉じる" : "詳しく見る"}
              </span>
            </button>

            {showTechSpecs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 pt-4 border-t border-zinc-900/80 overflow-hidden"
              >
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  本システムは、ブラウザでの遅延を極限まで取り除くための測定設計を採用しています。一般的なクリック検出（MouseUp）ではなく、タッチやボタンの押し込みにミリ秒未満で即応する <strong>PointerDown</strong> イベントを用いてタイミングを捕捉。さらに描画処理の同期ずれを防ぐため、<strong>requestAnimationFrame</strong> による同期レンダリングと <strong>performance.now()</strong> によるミリ秒以下の時間計測を組み合わせ、デバイスの描画ラグを考慮したオフセット補正を行っています。
                </p>
              </motion.div>
            )}
          </div>

          {/* Standalone Game Download Card */}
          <div className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(34,211,238,0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-xl rounded-full pointer-events-none" />
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black tracking-wider text-slate-200 uppercase font-sans">
                  ネット不要で遊べる特別版 (ワンファイルHTML)
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium">
                  インターネットが繋がっていなくても、端末の中に保存して誤差なくきれいに動く、便利なファイルを丸ごと手元に保存できます。
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <a
                    href="/reflex-test-standalone.html"
                    download="reflex-test-standalone.html"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold rounded-lg transition-all cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>手元に保存する</span>
                  </a>
                  <a
                    href="/reflex-test-standalone.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                  >
                    <span>別画面でひろびろ遊ぶ</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid with cyan accents */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Average time */}
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 shadow-sm relative">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold tracking-wider text-zinc-500">今までの平均タイム</span>
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="flex items-baseline mt-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-white select-all">
                  {avgTime ? avgTime : "---"}
                </span>
                <span className="text-[10px] font-bold ml-1 text-cyan-400 font-mono">
                  ms
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 font-sans mt-2.5 leading-none font-medium">
                合計 {attemptsCount} 回測定した平均データ
              </p>
            </div>

            {/* Best Record */}
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 shadow-sm relative">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold tracking-wider text-zinc-550">自己ベスト記録</span>
                <Trophy className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              </div>
              <div className="flex items-baseline mt-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-amber-500 select-all">
                  {bestTime ? bestTime : "---"}
                </span>
                <span className="text-[10px] font-bold ml-1 text-amber-400 font-mono">
                  ms
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 font-sans mt-2.5 leading-none font-medium flex items-center gap-1">
                {bestTime ? (
                  <>
                    <CheckCircle className="w-2.5 h-2.5 text-amber-500" />
                    <span>歴代の一番速い記録</span>
                  </>
                ) : (
                  "記録なし"
                )}
              </p>
            </div>

          </div>

          {/* Graph Progress (Cyber Theme) */}
          {history.length >= 2 && (
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-bold text-zinc-400 tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  反応スピードの推移グラフ
                </h4>
                <span className="text-[9px] text-zinc-500 font-medium">※下に行くほど速くて優秀！</span>
              </div>
              <div className="aspect-[16/10] w-full flex items-center justify-center p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-900/80">
                {renderSvgGraph()}
              </div>
            </div>
          )}

          {/* Score History List Card */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[460px]">
            <div className="bg-zinc-900/40 px-5 py-4 border-b border-zinc-900 flex flex-col gap-3 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-bold text-zinc-300 tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  これまでの測定履歴 ({attemptsCount}回)
                </h4>
                
                {attemptsCount > 0 && (
                  <div className="relative">
                    {showClearConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-rose-400 font-bold font-sans hidden sm:inline">これまでの記録をすべて消去しますか？</span>
                        <button 
                          onClick={clearHistory}
                          className="text-rose-400 hover:text-rose-300 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg cursor-pointer text-[10px] font-bold transition-colors"
                        >
                          消去する
                        </button>
                        <button 
                          onClick={() => setShowClearConfirm(false)}
                          className="text-zinc-400 hover:text-zinc-300 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer text-[10px] font-bold transition-colors"
                        >
                          閉じる
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 hover:text-rose-350 border border-rose-500/10 rounded-xl transition-all font-bold cursor-pointer text-[11px]"
                        title="履歴をリセット"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>記録を消去</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Outstanding Self-Best Score Display Banner */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                <div className="flex items-center gap-2 text-amber-550">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-bold tracking-wider">自己ベストタイム</span>
                </div>
                <span id="best-score-display" className="text-sm font-bold text-amber-400 tracking-wider font-mono">
                  {bestTime !== null ? `歴代最速タイム: ${bestTime}ms` : "歴代最速タイム: ---ms"}
                </span>
              </div>
            </div>

            {/* List entries */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-950 p-2.5 space-y-2 bg-zinc-950/20">
              {history.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-zinc-500 px-4">
                  <AlertCircle className="w-6 h-6 stroke-zinc-700 mb-2.5" />
                  <p className="text-xs font-bold tracking-wider mb-1">履歴データがまだありません</p>
                  <p className="text-[10px] text-zinc-550 max-w-[200px]">測定をクリアすると、こちらに測定履歴が順番にリストアップされていきます。</p>
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
                            ? "bg-amber-950/10 hover:bg-amber-950/20 border-amber-500/20" 
                            : "bg-zinc-900/20 hover:bg-zinc-900/40 border-zinc-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold border ${
                            isBest 
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                              : "bg-zinc-950 text-zinc-500 border-zinc-800"
                          }`}>
                            #{playNum}
                          </span>
                          <div>
                            <div className="font-mono text-sm font-bold flex items-baseline">
                              <span className={isBest ? "text-amber-500" : "text-zinc-100"}>
                                {item.time}
                              </span>
                              <span className={`text-[10px] font-bold ml-1 ${isBest ? "text-amber-500" : "text-cyan-400"}`}>
                                ms
                              </span>
                              {isBest && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500 text-[8px] font-bold text-slate-950 leading-none">
                                  歴代最速
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-sans mt-1">
                              <span>{item.date} • {rankInfo.name}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Evaluation rank badge */}
                        <div className="flex items-center flex-shrink-0 ml-2">
                          <span className={`px-2.5 py-1 min-w-[2.5rem] rounded-lg border font-bold flex items-center justify-center text-[10px] whitespace-nowrap ${rankInfo.color}`}>
                            {rankInfo.name}
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
      <footer className="border-t border-zinc-900 bg-zinc-950 py-5 px-6 md:px-12 text-center text-[10px] flex-shrink-0 mt-8 text-zinc-500 z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div>© 2026 REFLEX LABORATORY</div>
        </div>
      </footer>

    </div>
  );
}
