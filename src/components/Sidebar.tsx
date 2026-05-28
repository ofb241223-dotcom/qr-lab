import { useState, useEffect, useRef } from 'react';
import { Camera, FileUp, History, Monitor, QrCode, Settings, Laptop, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import type { BridgeInfo } from '../bridge/desktopBridge';

// Module-level single AudioContext instance for reliable Web Audio API playback
let sharedAudioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch (e) {
    console.warn('AudioContext initialization failed:', e);
    return null;
  }
};

interface SidebarProps {
  currentTab: 'scan' | 'generate' | 'history' | 'settings';
  setCurrentTab: (tab: 'scan' | 'generate' | 'history' | 'settings') => void;
  scanMode: 'camera' | 'screen' | 'file';
  openCameraScan: () => void;
  openScreenScan: () => void;
  openFileScan: () => void;
  bridgeInfo: BridgeInfo | null;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  isCameraActive: boolean;
  setIsCameraActive: (active: boolean) => void;
  isScanningScreen: boolean;
  knobA: number;
  setKnobA: React.Dispatch<React.SetStateAction<number>>;
  knobB: number;
  setKnobB: React.Dispatch<React.SetStateAction<number>>;
  triggerScreenScan: () => void;
  triggerFileScan: () => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  cameraFps?: number;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  scanMode,
  openCameraScan,
  openScreenScan,
  openFileScan,
  bridgeInfo,
  theme,
  setTheme,
  isCameraActive,
  setIsCameraActive,
  isScanningScreen,
  knobA,
  setKnobA,
  knobB,
  setKnobB,
  triggerScreenScan,
  triggerFileScan,
  addToast,
  cameraFps = 0,
}: SidebarProps) {
  // Calculate zoom and brightness parameters from knob angles
  const zoomScale = 1.0 + (knobA % 360) / 120; // 1.0x to 4.0x
  const brightness = 50 + (knobB % 360) / 3.6; // 50% to 150%

  // 8-Step Sequencer State (Now acts as Decoder Pipeline Buffer)
  const [activeSteps, setActiveSteps] = useState<boolean[]>([true, false, false, true, false, false, true, false]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true); // Start muted by default


  // Canvas Oscilloscope state binding ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ knobA, knobB, isActive: isCameraActive || isScanningScreen });
  
  useEffect(() => {
    stateRef.current = { knobA, knobB, isActive: isCameraActive || isScanningScreen };
  }, [knobA, knobB, isCameraActive, isScanningScreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 192;
    const height = 44;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    let phase = 0;

    // Helper to parse CSS color string into r,g,b components
    const parseColor = (colorStr: string) => {
      const str = colorStr.trim();
      if (str.startsWith('rgba')) {
        const match = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (match) return `${match[1]}, ${match[2]}, ${match[3]}`;
      } else if (str.startsWith('rgb')) {
        const match = str.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (match) return `${match[1]}, ${match[2]}, ${match[3]}`;
      }
      let c = str.startsWith('#') ? str.substring(1) : str;
      if (c.length === 3) {
        c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      }
      const num = parseInt(c, 16);
      if (isNaN(num)) return '0, 213, 255';
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `${r}, ${g}, ${b}`;
    };

    const render = () => {
      // 1. Clear screen with a radial vignette gradient of screen background (#0d0f14) to simulate CRT glass depth
      const vignette = ctx.createRadialGradient(width / 2, height / 2, 4, width / 2, height / 2, width * 0.55);
      vignette.addColorStop(0, 'rgba(15, 22, 30, 0.16)'); // Slightly illuminated center
      vignette.addColorStop(1, 'rgba(6, 8, 10, 0.16)');   // Dark vignette edges
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // Get current parameters from ref
      const { knobA: kA, knobB: kB, isActive: active } = stateRef.current;

      // Extract colors from styles for dynamic theme adaptation
      const style = window.getComputedStyle(canvas);
      const colorOrange = style.getPropertyValue('--accent-orange').trim() || '#ff5500';
      const colorCyan = style.getPropertyValue('--accent-cyan').trim() || '#00d5ff';
      const colorGreen = style.getPropertyValue('--accent-green').trim() || '#00b85c';

      const orangeRGB = parseColor(colorOrange);
      const cyanRGB = parseColor(colorCyan);
      const greenRGB = parseColor(colorGreen);

      // 2. Modulate parameters based on knobs
      // Knob A maps to Sweep Zoom (Timebase) -> range [0.5, 2.5]
      const zoom = 0.5 + ((Math.abs(kA) % 360) / 360) * 2.0;
      // Knob B maps to Gain Amplitude -> range [3.5, 14]
      const amplitude = 3.5 + ((Math.abs(kB) % 360) / 360) * 10.5;
      // Knob B also scales noise amplitude
      const noiseLevel = active ? 0.12 + ((Math.abs(kB) % 360) / 360) * 1.2 : 0.08;

      // 3. Draw CRT grid reticle (Tektronix style with vertical offset channels)
      ctx.strokeStyle = active ? `rgba(${cyanRGB}, 0.045)` : `rgba(${orangeRGB}, 0.035)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      // Horizontal grid lines (4 divisions)
      for (let y = height / 4; y < height; y += height / 4) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      // Vertical grid lines (6 divisions)
      for (let x = width / 6; x < width; x += width / 6) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();

      // Central axis ticks
      ctx.strokeStyle = active ? `rgba(${cyanRGB}, 0.12)` : `rgba(${orangeRGB}, 0.09)`;
      ctx.beginPath();
      const centerY = height / 2;
      for (let x = 0; x < width; x += 6) {
        ctx.moveTo(x, centerY - 2);
        ctx.lineTo(x, centerY + 2);
      }
      const centerX = width / 2;
      for (let y = 0; y < height; y += 4) {
        ctx.moveTo(centerX - 2, y);
        ctx.lineTo(centerX + 2, y);
      }
      ctx.stroke();

      // Channel Baseline Center-Y Heights
      const ch1Y = centerY - 1;                // Cyan trace (data) sits slightly above absolute center
      const ch2Y = centerY + 12;               // Orange trace (sync clock) sits in lower third
      const ch3Y = centerY - 11;               // Green trace (RF carrier) sits in upper third

      // Trace 1: Demodulated QR Data stream with second-order overshoot/ringing (Middle Channel)
      const getDataSignal = (x: number) => {
        if (!active) {
          // Standby: slow graceful low-voltage idle sine wave
          const phaseOffset = Math.sin(x * 0.015 - phase * 0.5) * 0.8;
          return Math.sin(x * 0.07 + phase * 1.5 + phaseOffset) * 3.8;
        }
        
        const bitRate = 0.035 * zoom;
        const bitPos = x * bitRate - phase * 3.2;
        // Pseudo-random digital code payload simulating bits
        const bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0];
        
        const idx = Math.floor(bitPos) % bits.length;
        const currentIdx = idx >= 0 ? idx : bits.length + idx;
        const nextIdx = (currentIdx + 1) % bits.length;
        
        const currentBit = bits[currentIdx];
        const nextBit = bits[nextIdx];
        const t = bitPos - Math.floor(bitPos); // fraction [0, 1]
        
        let val = currentBit;
        const diff = nextBit - currentBit;
        if (diff !== 0) {
          // Smooth C1 transition (cosine) with a boundary-decaying underdamped ringing envelope
          const R0 = (1 - Math.cos(Math.PI * t)) / 2;
          const ringing = Math.sin(Math.PI * t) ** 2 * Math.sin(18 * t) * Math.exp(-2.2 * t) * 0.32;
          val = currentBit + diff * (R0 + ringing);
        }
        
        // Normalize, center, scale
        const normVal = (val - 0.5) * (amplitude * 0.9);
        const noise = (Math.random() - 0.5) * noiseLevel * 3.5;
        
        return normVal + noise;
      };

      // Trace 2: Clock Sweep Staircase tracking PLL (Bottom Channel)
      const getSyncSignal = (x: number) => {
        if (!active) {
          // Standby: slow calm triangle wave
          return Math.sin(x * 0.03 - phase * 0.8) * 1.2;
        }
        
        const stepRate = 0.065 * zoom;
        const stepPos = x * stepRate - phase * 1.6;
        const steps = 8;
        
        const t = stepPos - Math.floor(stepPos);
        const transitionWidth = 0.12; // 12% of step duration for smooth rise/fall transition
        let smoothT = 0;
        if (t > 1 - transitionWidth) {
          const nt = (t - (1 - transitionWidth)) / transitionWidth;
          smoothT = (1 - Math.cos(Math.PI * nt)) / 2;
        }
        
        const currentStepRaw = Math.floor(stepPos) + smoothT;
        const currentStep = currentStepRaw % steps;
        const normStep = (currentStep >= 0 ? currentStep : steps + currentStep) / (steps - 1);
        
        // Stepping DAC staircase wave
        const val = (normStep - 0.5) * (amplitude * 0.45);
        const noise = (Math.random() - 0.5) * noiseLevel * 1.5;
        return val + noise;
      };

      // Trace 3: RF Carrier Hum (Top Channel)
      const getCarrierSignal = (x: number) => {
        if (!active) {
          // Standby: continuous high-frequency idle sine
          return Math.sin(x * 0.35 + phase * 6.0) * 1.4;
        }
        
        // Active: Amplitude-Modulated (AM) packet envelope carrier wave
        const carrierFreq = 0.42 * zoom;
        const envelope = 0.45 + 0.45 * Math.sin(x * 0.035 - phase * 1.2);
        const val = Math.sin(x * carrierFreq + phase * 9.0) * (envelope * amplitude * 0.26);
        const noise = (Math.random() - 0.5) * noiseLevel * 2.0;
        return val + noise;
      };

      // 4. Generate points
      const points1: { x: number; y: number }[] = [];
      const points2: { x: number; y: number }[] = [];
      const points3: { x: number; y: number }[] = [];

      const numPoints = 140;
      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        let y1 = ch1Y + getDataSignal(x);
        let y2 = ch2Y + getSyncSignal(x);
        let y3 = ch3Y + getCarrierSignal(x);

        // Clamp inside canvas boundary (1.5px safety margins)
        y1 = Math.max(1.5, Math.min(height - 1.5, y1));
        y2 = Math.max(1.5, Math.min(height - 1.5, y2));
        y3 = Math.max(1.5, Math.min(height - 1.5, y3));

        points1.push({ x, y: y1 });
        points2.push({ x, y: y2 });
        points3.push({ x, y: y3 });
      }

      // 5. Drawing Traces with Dual-layered Phosphor Glow and CRT Beam Velocity Modulation
      const drawGlowTrace = (
        points: { x: number; y: number }[],
        rgb: string,
        coreColor: string,
        maxCoreWidth: number,
        maxGlowWidth: number,
        opacityGlowMultiplier = 1.0
      ) => {
        if (points.length < 2) return;
        
        ctx.globalCompositeOperation = 'screen';
        
        // Path A: Wide diffuse outer glow
        ctx.lineWidth = maxGlowWidth;
        ctx.strokeStyle = `rgba(${rgb}, ${0.11 * opacityGlowMultiplier})`;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Path B: Medium inner glow
        ctx.lineWidth = maxGlowWidth * 0.55;
        ctx.strokeStyle = `rgba(${rgb}, ${0.25 * opacityGlowMultiplier})`;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Path C: Core beam with electron intensity modulation (VBR) + Bloom
        ctx.shadowBlur = active ? 3.5 : 2.0;
        ctx.shadowColor = `rgba(${rgb}, 0.85)`;

        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          
          const dy = Math.abs(p2.y - p1.y);
          const speedFactor = 1 / (1 + dy * 0.16); // slower = brighter & thicker, faster = dimmer & thinner
          
          ctx.lineWidth = 0.55 + speedFactor * (maxCoreWidth - 0.55);
          ctx.strokeStyle = coreColor;
          ctx.globalAlpha = 0.35 + speedFactor * 0.65;
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        
        ctx.shadowBlur = 0; // reset shadow
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      };

      // Trace 3: RF Carrier Hum (Green trace - top channel)
      drawGlowTrace(
        points3,
        greenRGB,
        active ? '#e8ffd8' : `rgba(${greenRGB}, 0.85)`,
        0.8,
        2.5,
        active ? 0.85 : 0.6
      );

      // Trace 2: Sync Staircase (Orange trace - bottom channel)
      drawGlowTrace(
        points2,
        orangeRGB,
        active ? '#ffebd8' : `rgba(${orangeRGB}, 0.85)`,
        0.95,
        3.2,
        active ? 0.95 : 0.5
      );

      // Trace 1: Raw Data Readout (Cyan trace - middle channel)
      drawGlowTrace(
        points1,
        cyanRGB,
        active ? '#e0fff0' : `rgba(${cyanRGB}, 0.95)`,
        1.25,
        4.6,
        1.0
      );

      // 6. Draw Scanline CRT texture directly on canvas
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.09)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let y = 0; y < height; y += 2) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      phase += 0.08;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);


  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const handleKnobAClick = () => {
    // Zoom A knob: rotate to scale camera zoom (1.0x to 4.0x)
    setKnobA((prev) => (prev + 30) % 360);
    playClickSound();
  };

  const handleKnobBClick = () => {
    // Sens B knob: rotate to adjust sensor brightness (50% to 150%)
    setKnobB((prev) => (prev + 30) % 360);
    playClickSound();
  };

  // Play a very quick click/tactile sound when turning knobs or plugging jacks
  const playClickSound = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch (e) {
      // Ignored if blocked
    }
  };

  // Trigger synth note synthesis
  const playSynthTone = (frequency: number) => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Retro synthesizer triangle voice
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch (e) {
      // Ignored if blocked
    }
  };

  // Sequencer loop hook
  useEffect(() => {
    // knobB sets the BPM tempo
    const angle = Math.abs(knobB) % 360;
    const bpm = 60 + Math.round((angle / 360) * 180); // BPM ranges from 60 to 240
    const stepDuration = 60000 / (bpm * 2); // 8th notes

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = (prev + 1) % 8;
        if (activeSteps[next] && !isMuted) {
          // knobA maps to a clean pentatonic scale frequency
          const voltAngle = Math.abs(knobA) % 360;
          const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; // C4, D4, E4, G4, A4, C5, D5, E5
          const pitchIndex = Math.floor((voltAngle / 360) * scale.length) % scale.length;
          playSynthTone(scale[pitchIndex]);
        }
        return next;
      });
    }, stepDuration);

    return () => clearInterval(timer);
  }, [knobA, knobB, activeSteps, isMuted]);

  return (
    <aside className="sidebar">
      <div>
        {/* Custom pocket operator logo combining QR patterns and synth keys */}
        <div className="logo-section" style={{ cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-icon">
            {/* QR Finder Pattern Outer Box */}
            <rect x="2" y="2" width="9" height="9" rx="1" stroke="var(--accent-orange)" strokeWidth="2.5" />
            {/* QR Finder Solid Center */}
            <rect x="5" y="5" width="3" height="3" fill="var(--accent-orange)" />
            
            {/* Concentric frequency dot dials on the right */}
            <circle cx="16" cy="3" r="1.5" fill="var(--accent-cyan)" />
            <circle cx="21" cy="3" r="1.5" fill="var(--text-muted)" />
            <circle cx="16" cy="8" r="1.5" fill="var(--text-muted)" />
            <circle cx="21" cy="8" r="1.5" fill="var(--accent-orange)" />

            {/* Tactical synthesizer key switch frames */}
            <rect x="2" y="15" width="5" height="7" rx="0.5" fill="var(--text-muted)" opacity="0.6" />
            <rect x="9" y="15" width="5" height="7" rx="0.5" fill="var(--accent-orange)" />
            <rect x="16" y="15" width="6" height="7" rx="0.5" fill="var(--text-muted)" opacity="0.6" />
            <line x1="11.5" y1="17.5" x2="11.5" y2="19.5" stroke="#ffffff" strokeWidth="1" />
          </svg>
          <h1>QR Desktop</h1>
        </div>

        <nav className="nav-list">
          <button
            className={`nav-item ${currentTab === 'scan' && scanMode === 'camera' ? 'active' : ''}`}
            onClick={openCameraScan}
          >
            <Camera size={16} />
            <span style={{ flex: 1 }}>摄像头扫描</span>
            <kbd className="kbd-shortcut">⌥1</kbd>
          </button>

          <button
            className={`nav-item ${currentTab === 'scan' && scanMode === 'screen' ? 'active' : ''}`}
            onClick={openScreenScan}
          >
            <Monitor size={16} />
            <span style={{ flex: 1 }}>截图识别</span>
            <kbd className="kbd-shortcut">⌥2</kbd>
          </button>

          <button
            className={`nav-item ${currentTab === 'scan' && scanMode === 'file' ? 'active' : ''}`}
            onClick={openFileScan}
          >
            <FileUp size={16} />
            <span style={{ flex: 1 }}>导入图片</span>
            <kbd className="kbd-shortcut">⌥3</kbd>
          </button>

          <button
            className={`nav-item ${currentTab === 'generate' ? 'active' : ''}`}
            onClick={() => setCurrentTab('generate')}
          >
            <QrCode size={16} />
            <span style={{ flex: 1 }}>生成二维码</span>
            <kbd className="kbd-shortcut">⌥4</kbd>
          </button>

          <button
            className={`nav-item ${currentTab === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentTab('history')}
          >
            <History size={16} />
            <span style={{ flex: 1 }}>历史记录</span>
            <kbd className="kbd-shortcut">⌥5</kbd>
          </button>

          <button
            className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentTab('settings')}
          >
            <Settings size={16} />
            <span style={{ flex: 1 }}>应用设置</span>
            <kbd className="kbd-shortcut">⌥6</kbd>
          </button>
        </nav>

        {/* Custom route schematic flow chart */}
        <div className="te-schematic-flow" style={{ margin: '14px 4px 0', opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.62rem', color: 'var(--text-main)', marginBottom: '6px', fontWeight: 'bold' }}>
            <span>ROUTE SCHEMATIC</span>
            <span>v1.0</span>
          </div>
          <svg width="100%" height="22" viewBox="0 0 192 22" style={{ pointerEvents: 'auto' }}>
            {/* Block 1: CAM */}
            <g 
              className="te-schematic-block" 
              style={{ transformOrigin: '18px 11px' }} 
              onClick={() => {
                playClickSound();
                if (currentTab !== 'scan') setCurrentTab('scan');
                setIsCameraActive(!isCameraActive);
                addToast(isCameraActive ? '摄像头输入已关闭 [CAM_IN OFF]' : '摄像头输入已启动 [CAM_IN ON]', 'info');
              }}
            >
              <title>CAM: 点击切换摄像头输入源</title>
              <rect 
                x="1" 
                y="1" 
                width="34" 
                height="20" 
                rx="1.5" 
                fill={isCameraActive ? "rgba(0, 229, 117, 0.1)" : "none"} 
                stroke={isCameraActive ? "var(--accent-green)" : "var(--border-glass)"} 
                strokeWidth="1" 
                style={{ animation: isCameraActive ? 'te-pulse-slow 2s infinite' : 'none' }}
              />
              <text 
                x="18" 
                y="13.5" 
                fill={isCameraActive ? "var(--accent-green)" : "var(--text-main)"} 
                fontSize="7.5" 
                fontFamily="var(--font-mono)" 
                textAnchor="middle" 
                fontWeight="bold"
              >
                CAM
              </text>
            </g>
            
            {/* Arrow 1 */}
            <path 
              d="M 40 11 L 48 11" 
              stroke={isCameraActive ? "var(--accent-green)" : "var(--border-glass)"} 
              strokeWidth="1" 
              fill="none" 
              className={isCameraActive ? "te-flow-path" : ""} 
            />
            <path 
              d="M 48 11 L 45 8 M 48 11 L 45 14" 
              stroke={isCameraActive ? "var(--accent-green)" : "var(--border-glass)"} 
              strokeWidth="0.8" 
              fill="none" 
            />
            
            {/* Block 2: DSP */}
            <g 
              className="te-schematic-block" 
              style={{ transformOrigin: '69px 11px' }} 
              onClick={() => {
                playClickSound();
                setKnobA(0);
                setKnobB(180);
                addToast('感光与变焦参数已校准重置 [GND ZERO_SET]', 'success');
              }}
            >
              <title>DSP: 点击将感光与变焦重置为物理基准值</title>
              <rect 
                x="52" 
                y="1" 
                width="34" 
                height="20" 
                rx="1.5" 
                fill={isCameraActive ? "rgba(255, 85, 0, 0.1)" : "none"} 
                stroke="var(--accent-orange)" 
                strokeWidth="1" 
              />
              <text 
                x="69" 
                y="13.5" 
                fill="var(--accent-orange)" 
                fontSize="7.5" 
                fontFamily="var(--font-mono)" 
                textAnchor="middle" 
                fontWeight="bold"
              >
                DSP
              </text>
            </g>
            
            {/* Arrow 2 */}
            <path 
              d="M 90 11 L 98 11" 
              stroke={isCameraActive ? "var(--accent-orange)" : "var(--border-glass)"} 
              strokeWidth="1" 
              fill="none" 
              className={isCameraActive ? "te-flow-path" : ""} 
            />
            <path 
              d="M 98 11 L 95 8 M 98 11 L 95 14" 
              stroke={isCameraActive ? "var(--accent-orange)" : "var(--border-glass)"} 
              strokeWidth="0.8" 
              fill="none" 
            />
            
            {/* Block 3: ECC */}
            <g 
              className="te-schematic-block" 
              style={{ transformOrigin: '119px 11px' }} 
              onClick={() => {
                playClickSound();
                setCurrentTab('settings');
                addToast('已切换至系统设置通道以配置 ECC 解码参数 [CH_04: ECC_SET]', 'info');
              }}
            >
              <title>ECC: 点击切换至设置页配置纠错算法参数</title>
              <rect 
                x="102" 
                y="1" 
                width="34" 
                height="20" 
                rx="1.5" 
                fill={isCameraActive ? "rgba(238, 214, 18, 0.08)" : "none"} 
                stroke={isCameraActive ? "var(--accent-yellow)" : "var(--border-glass)"} 
                strokeWidth="1" 
              />
              <text 
                x="119" 
                y="13.5" 
                fill={isCameraActive ? "var(--accent-yellow)" : "var(--text-main)"} 
                fontSize="7.5" 
                fontFamily="var(--font-mono)" 
                textAnchor="middle" 
                fontWeight="bold"
              >
                ECC
              </text>
            </g>
            
            {/* Arrow 3 */}
            <path 
              d="M 140 11 L 148 11" 
              stroke={isCameraActive ? "var(--accent-cyan)" : "var(--border-glass)"} 
              strokeWidth="1" 
              fill="none" 
              className={isCameraActive ? "te-flow-path" : ""} 
            />
            <path 
              d="M 148 11 L 145 8 M 148 11 L 145 14" 
              stroke={isCameraActive ? "var(--accent-cyan)" : "var(--border-glass)"} 
              strokeWidth="0.8" 
              fill="none" 
            />
            
            {/* Block 4: OUT */}
            <g 
              className="te-schematic-block" 
              style={{ transformOrigin: '171px 11px' }} 
              onClick={() => {
                playClickSound();
                setCurrentTab('history');
                addToast('已切换至历史日志数据总线 [CH_03: LOG_OUT]', 'info');
              }}
            >
              <title>OUT: 点击跳转至历史记录查看已解析的数据输出</title>
              <rect 
                x="152" 
                y="1" 
                width="38" 
                height="20" 
                rx="1.5" 
                fill={isCameraActive ? "rgba(0, 213, 255, 0.1)" : "none"} 
                stroke="var(--accent-cyan)" 
                strokeWidth="1" 
              />
              <text 
                x="171" 
                y="13.5" 
                fill="var(--accent-cyan)" 
                fontSize="7.5" 
                fontFamily="var(--font-mono)" 
                textAnchor="middle" 
                fontWeight="bold"
              >
                OUT
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Center modular dashboard for Teenager Engineering aesthetic detail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '12px 0' }}>
        
        {/* Simulated frequency monitor display screen */}
        <div className="te-spec-container te-screen te-screen-pulse" style={{ margin: '0 2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="te-spec-title">DECODER TELEMETRY</span>
            <span style={{ fontSize: '0.6rem', color: isCameraActive || isScanningScreen ? 'var(--accent-green)' : 'var(--accent-orange)', fontWeight: 'bold' }}>
              • {isCameraActive || isScanningScreen ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>
          
          <div style={{ height: '44px', margin: '4px 0', display: 'flex', alignItems: 'center', zIndex: 12 }}>
            <canvas ref={canvasRef} className="te-oscilloscope-svg" style={{ width: '100%', height: '44px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4px', fontSize: '0.62rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-glass)', paddingTop: '6px', fontFamily: 'var(--font-mono)' }}>
            <div>RATE: <strong style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{isCameraActive ? `${cameraFps || 60} FPS` : '00 FPS'}</strong></div>
            <div>MODE: <strong style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{isCameraActive ? 'CAM_ON' : isScanningScreen ? 'SCRN_ON' : 'STBY'}</strong></div>
            <div>ZOOM: <strong style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{zoomScale.toFixed(2)}X</strong></div>
            <div>SENS: <strong style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{brightness.toFixed(0)}%</strong></div>
          </div>
        </div>

        {/* Physical parameter dials/knobs (interactive rotating indicators) */}
        <div className="te-knobs-row">
          <div className="te-knob-container">
            <div 
              className="te-knob-wrapper" 
              onClick={handleKnobAClick}
              title="旋转调节镜头缩放倍数 [ZOOM A]"
              style={{ borderColor: 'var(--accent-orange)' }}
            >
              <div 
                className="te-knob-pointer" 
                style={{ transform: `rotate(${knobA}deg)`, backgroundColor: 'var(--accent-orange)' }}
              />
            </div>
            <span className="te-knob-label">ZOOM [A]</span>
          </div>

          <div className="te-knob-container">
            <div 
              className="te-knob-wrapper" 
              onClick={handleKnobBClick}
              title="旋转调节感光度曝光 [SENS B]"
              style={{ borderColor: 'var(--accent-cyan)' }}
            >
              <div 
                className="te-knob-pointer" 
                style={{ transform: `rotate(${knobB}deg)`, backgroundColor: 'var(--accent-cyan)' }}
              />
            </div>
            <span className="te-knob-label">SENS [B]</span>
          </div>
        </div>

        {/* 8-Step Interactive Synth Sequencer (Acts as Decoder Pipeline Buffer) */}
        <div className="te-sequencer">
          <div className="te-seq-header">
            <span className="te-seq-title">PIPELINE BUFFER [REG_08]</span>
            <button 
              onClick={() => {
                setIsMuted(!isMuted);
                playClickSound();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: isMuted ? 'var(--text-muted)' : 'var(--accent-orange)'
              }}
              title={isMuted ? "开启声音警报" : "关闭声音警报"}
            >
              {isMuted ? <VolumeX size={11} /> : <Volume2 size={11} className="te-screen-pulse" />}
            </button>
          </div>
          <div className="te-seq-grid">
            {activeSteps.map((step, idx) => (
              <button
                key={idx}
                className={`te-seq-btn ${step ? 'active' : ''} ${currentStep === idx ? 'playing' : ''}`}
                onClick={() => {
                  const copy = [...activeSteps];
                  copy[idx] = !copy[idx];
                  setActiveSteps(copy);
                  playClickSound();
                }}
                title={`寄存器单元 ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>

      </div>

      <div>
        {/* Diagnostic patch bay jacks (Interactive hardware commands) */}
        <div className="te-patch-bay" style={{ width: '100%', margin: '0 0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.62rem', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '6px' }}>
            <span>DIAGNOSTIC PORTS [BUS_IO]</span>
            <span style={{ color: 'var(--accent-green)', fontSize: '0.55rem' }}>ONLINE</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#07080a', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-glass)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }} className="te-patch-grid">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div 
                className={`patch-jack ${isCameraActive ? 'active' : ''}`} 
                onClick={() => {
                  setCurrentTab('scan');
                  setIsCameraActive(!isCameraActive);
                  playClickSound();
                  addToast(isCameraActive ? '摄像头预览已关闭 [CAM_IN DISCONNECTED]' : '已激活摄像头通道 [CAM_IN ACTIVE]', 'info');
                }} 
                title="CAM_IN: 挂载摄像头捕获源" 
                style={{ backgroundColor: isCameraActive ? 'var(--accent-green)' : '#222' }}
              />
              <span style={{ fontSize: '0.52rem', color: isCameraActive ? 'var(--accent-green)' : 'var(--text-main)', fontWeight: 'bold' }}>CAM_IN</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div 
                className={`patch-jack ${isScanningScreen ? 'active' : ''}`} 
                onClick={() => {
                  setCurrentTab('scan');
                  triggerScreenScan();
                  playClickSound();
                  addToast('已向屏幕截屏发送脉冲信号 [SCRN_IN TRIG]', 'info');
                }} 
                title="SCRN_IN: 注入屏幕截图扫描脉冲" 
                style={{ backgroundColor: isScanningScreen ? 'var(--accent-orange)' : '#222' }}
              />
              <span style={{ fontSize: '0.52rem', color: isScanningScreen ? 'var(--accent-orange)' : 'var(--text-main)', fontWeight: 'bold' }}>SCRN_IN</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div 
                className="patch-jack" 
                onClick={() => {
                  setCurrentTab('scan');
                  triggerFileScan();
                  playClickSound();
                  addToast('已唤醒本地文件扫描对话框 [TRIG ACTIVE]', 'info');
                }} 
                title="TRIG: 强制唤醒本地文件解析器" 
              />
              <span style={{ fontSize: '0.52rem', color: 'var(--text-main)', fontWeight: 'bold' }}>TRIG</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div 
                className="patch-jack" 
                onClick={() => {
                  setKnobA(0);
                  setKnobB(180);
                  playClickSound();
                  addToast('感光与变焦参数已校准重置 [GND ZERO_SET]', 'success');
                }} 
                title="GND: 校准重置变焦与曝光至物理基准值" 
                style={{ border: '1px solid var(--accent-orange)' }}
              />
              <span style={{ fontSize: '0.52rem', color: 'var(--text-main)', fontWeight: 'bold' }}>GND</span>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="nav-item theme-toggle" onClick={toggleTheme} style={{ marginBottom: '16px' }}>
            {theme === 'dark' ? <Sun size={16} color="var(--accent-orange)" /> : <Moon size={16} color="var(--accent-purple)" />}
            <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
          </button>

          <div className="header-status" style={{ width: '100%', justifyContent: 'center' }}>
            <Laptop size={12} />
            <span>{bridgeInfo?.isMock ? 'Mock 浏览器' : `${bridgeInfo?.platform} v${bridgeInfo?.version}`}</span>
            <span className={`status-dot ${bridgeInfo?.isMock ? 'mock' : ''}`} />
          </div>
        </div>
      </div>
    </aside>
  );
}
