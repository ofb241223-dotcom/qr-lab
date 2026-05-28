import { useState, useEffect, useRef } from 'react';
import { Camera, Monitor, FileUp, Copy, ExternalLink, RefreshCw, X, ShieldAlert, Wifi, User, Mail, MessageSquare, Phone, MapPin } from 'lucide-react';
import bridge from '../bridge/desktopBridge';
import type { CameraDevice, AppSettings, DataType } from '../bridge/desktopBridge';

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

interface ScanViewProps {
  settings: AppSettings;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onGeneratePreFill: (content: string, type: DataType) => void;
  knobA?: number;
  knobB?: number;
  isCameraActive: boolean;
  setIsCameraActive: (active: boolean) => void;
  isScanningScreen: boolean;
  setIsScanningScreen: (active: boolean) => void;
  screenScanTrigger?: number;
  fileScanTrigger?: number;
  scanMode?: 'camera' | 'screen' | 'file';
  setScanMode?: (mode: 'camera' | 'screen' | 'file') => void;
  onStreamInfoChange?: (fps: number, resolution: string) => void;
}

export default function ScanView({
  settings,
  addToast,
  onGeneratePreFill,
  knobA = 0,
  knobB = 180,
  isCameraActive,
  setIsCameraActive,
  isScanningScreen,
  setIsScanningScreen,
  screenScanTrigger = 0,
  fileScanTrigger = 0,
  scanMode = 'camera',
  setScanMode,
  onStreamInfoChange
}: ScanViewProps) {
  const zoomScale = 1.0 + (knobA % 360) / 120; // 1.0x to 4.0x
  const brightness = 50 + (knobB % 360) / 3.6; // 50% to 150%
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [hideWindowForScreenScan, setHideWindowForScreenScan] = useState<boolean>(true);
  const initialScreenTriggerRef = useRef(screenScanTrigger);
  const initialFileTriggerRef = useRef(fileScanTrigger);
  const lastAutoActionRef = useRef<{ content: string; timestamp: number } | null>(null);
  const lastScanSuccessRef = useRef<{ content: string; source: string; timestamp: number } | null>(null);

  // Listen to screenScanTrigger and fileScanTrigger from patch bay
  useEffect(() => {
    if (screenScanTrigger > initialScreenTriggerRef.current) {
      setScanMode?.('screen');
      handleScreenScan();
    }
  }, [screenScanTrigger]);

  useEffect(() => {
    if (fileScanTrigger > initialFileTriggerRef.current) {
      setScanMode?.('file');
      handleFileScan();
    }
  }, [fileScanTrigger]);
  
  // Real-time camera stats
  const [actualFps, setActualFps] = useState<number>(0);
  const [actualResolution, setActualResolution] = useState<string>('--x--');

  // Monitor active camera stream parameters
  useEffect(() => {
    if (!isCameraActive) {
      setActualFps(0);
      setActualResolution('--x--');
      return;
    }

    let active = true;
    const updateInfo = () => {
      const video = videoRef.current;
      if (!video) return;

      const stream = video.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (track && active) {
        const settings = track.getSettings();
        const w = video.videoWidth || settings.width || 1280;
        const h = video.videoHeight || settings.height || 720;
        const fpsVal = Math.round(settings.frameRate || 60);
        
        setActualFps(fpsVal);
        const resStr = `${w}x${h}`;
        setActualResolution(resStr);
        
        if (onStreamInfoChange) {
          onStreamInfoChange(fpsVal, resStr);
        }
      }
    };

    // Query immediately if possible
    updateInfo();

    // Query after brief timeouts to allow stream to settle
    const timer1 = setTimeout(updateInfo, 250);
    const timer2 = setTimeout(updateInfo, 1000);

    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', updateInfo);
      video.addEventListener('playing', updateInfo);
    }

    return () => {
      active = false;
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (video) {
        video.removeEventListener('loadedmetadata', updateInfo);
        video.removeEventListener('playing', updateInfo);
      }
    };
  }, [isCameraActive, selectedCamera, onStreamInfoChange]);

  // Results modal state
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanSource, setScanSource] = useState<'camera' | 'screen' | 'file' | 'manual'>('camera');
  const [showConfirmUrlModal, setShowConfirmUrlModal] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const handleNativeFileDrop = async (event: Event) => {
      const paths = (event as CustomEvent<string[]>).detail || [];
      const path = paths[0];
      if (!path) return;
      setIsDragging(false);
      setIsProcessingFile(true);
      try {
        const res = await bridge.scanImagePath(path);
        if (res.success && res.content) {
          handleScanSuccess(res.content, 'file', res.path || path);
        } else {
          addToast(res.error || '拖拽文件中未识别出二维码', 'error');
        }
      } catch (err: any) {
        addToast(`拖拽文件解析失败: ${err.message || String(err)}`, 'error');
      } finally {
        setIsProcessingFile(false);
      }
    };

    window.addEventListener('qr-lab-native-file-drop', handleNativeFileDrop);
    return () => window.removeEventListener('qr-lab-native-file-drop', handleNativeFileDrop);
  }, []);

  // Initialize camera list
  useEffect(() => {
    let active = true;
    const fetchCameras = async () => {
      try {
        const list = await bridge.listCameras();
        if (active) {
          setCameras(list);
          if (list.length > 0) {
            setSelectedCamera(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to list cameras:', err);
      }
    };
    fetchCameras();
    return () => {
      active = false;
    };
  }, []);

  // Handle camera toggle
  useEffect(() => {
    if (!isCameraActive || !selectedCamera) {
      bridge.stopCameraScan();
      return;
    }

    let unsubResult: () => void = () => {};
    let unsubError: () => void = () => {};

    const startScan = async () => {
      setCameraError('');
      try {
        unsubResult = bridge.onCameraScanResult((res) => {
          if (res.success && res.content) {
            handleScanSuccess(res.content, 'camera');
          }
        });

        unsubError = bridge.onCameraScanError((err) => {
          setCameraError(err);
          setIsCameraActive(false);
          addToast(`摄像头错误: ${err}`, 'error');
        });

        await bridge.startCameraScan({ cameraId: selectedCamera });
      } catch (err: any) {
        setCameraError(err.message || String(err));
        setIsCameraActive(false);
        addToast('启动摄像头失败，请检查权限。', 'error');
      }
    };

    startScan();

    return () => {
      bridge.stopCameraScan();
      unsubResult();
      unsubError();
    };
  }, [isCameraActive, selectedCamera]);

  const playBeep = () => {
    if (!settings.soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn('Sound context failed to play:', e);
    }
  };

  const handleScanSuccess = async (content: string, source: 'camera' | 'screen' | 'file' | 'manual', filePath?: string) => {
    const now = Date.now();
    if (
      lastScanSuccessRef.current?.content === content &&
      lastScanSuccessRef.current?.source === source &&
      now - lastScanSuccessRef.current.timestamp < 1500
    ) {
      return;
    }
    lastScanSuccessRef.current = { content, source, timestamp: now };

    playBeep();
    setScanResult(content);
    setScanSource(source);

    // Save to history via bridge if history is enabled
    if (settings.saveHistory) {
      try {
        let dataType: DataType = 'text';
        const lower = content.toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://')) {
          dataType = 'url';
        } else if (lower.startsWith('wifi:')) {
          dataType = 'wifi';
        } else if (content.startsWith('BEGIN:VCARD')) {
          dataType = 'vcard';
        } else if (lower.startsWith('mailto:')) {
          dataType = 'email';
        } else if (lower.startsWith('sms:') || lower.startsWith('smsto:')) {
          dataType = 'sms';
        } else if (lower.startsWith('tel:')) {
          dataType = 'phone';
        } else if (lower.startsWith('geo:')) {
          dataType = 'geo';
        }

        await bridge.addHistory({
          type: 'scan',
          dataType,
          content,
          source,
          filePath,
        });
      } catch (err) {
        console.error('Failed to log scan history:', err);
      }
    }

    // Auto-copy to clipboard if enabled
    if (settings.autoCopy) {
      try {
        await bridge.copyToClipboard(content);
        addToast('结果已自动复制到剪贴板', 'success');
      } catch (err) {
        console.error('Auto copy failed:', err);
      }
    }

    await performAutomaticScanAction(content);
  };

  // Screen Scanning Action
  const handleScreenScan = async () => {
    getAudioContext(); // Warm up AudioContext on user gesture
    setIsScanningScreen(true);
    try {
      const res = await bridge.scanScreen({
        interactive: true,
        hideWindow: hideWindowForScreenScan,
      });
      if (res.success && res.content) {
        handleScanSuccess(res.content, 'screen', res.path);
      } else {
        addToast(res.error || '未在屏幕上检测到二维码', 'error');
      }
    } catch (e: any) {
      addToast(`截屏扫描失败: ${e.message || String(e)}`, 'error');
    } finally {
      setIsScanningScreen(false);
    }
  };

  // File Select Action
  const handleFileScan = async () => {
    getAudioContext(); // Warm up AudioContext on user gesture
    setIsProcessingFile(true);
    try {
      const res = await bridge.scanImageFile();
      if (res.success && res.content) {
        handleScanSuccess(res.content, 'file', res.path);
      } else {
        addToast(res.error || '解析文件失败', 'error');
      }
    } catch (e: any) {
      addToast(`文件解析失败: ${e.message || String(e)}`, 'error');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // File Drop Ingest
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isSupportedImage = file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.svg');
    if (!isSupportedImage) {
      addToast('请拖拽有效的图片文件，支持 PNG/JPG/WEBP/SVG', 'error');
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const res = await bridge.scanImageData({
          content: dataUrl,
          encoding: 'dataUrl',
          mimeType: file.type,
          filename: file.name,
        });
        if (res.success && res.content) {
          handleScanSuccess(res.content, 'file', file.name);
        } else {
          addToast(res.error || '未在拖拽的图片中识别出二维码', 'error');
        }
      } catch (err: any) {
        addToast(`解码失败: ${err.message || String(err)}`, 'error');
      } finally {
        setIsProcessingFile(false);
      }
    };
    reader.onerror = () => {
      addToast('读取文件失败', 'error');
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
  };

  // Process text features
  const copyResult = async () => {
    if (!scanResult) return;
    try {
      await bridge.copyToClipboard(scanResult);
      addToast('已成功复制到剪贴板！', 'success');
    } catch (e) {
      addToast('复制失败', 'error');
    }
  };

  const handleOpenUrl = (url: string) => {
    if (settings.confirmBeforeOpenUrl) {
      setShowConfirmUrlModal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const triggerOpenUrlDirectly = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowConfirmUrlModal(null);
  };

  const inferTypeAndPayload = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      return { type: 'url' as const, display: '链接网址' };
    }
    if (lower.startsWith('wifi:')) {
      return { type: 'wifi' as const, display: 'Wi-Fi 配置' };
    }
    if (text.startsWith('BEGIN:VCARD')) {
      return { type: 'vcard' as const, display: 'vCard 电子名片' };
    }
    if (lower.startsWith('mailto:')) {
      return { type: 'email' as const, display: '电子邮件' };
    }
    if (lower.startsWith('sms:') || lower.startsWith('smsto:')) {
      return { type: 'sms' as const, display: '短信通道' };
    }
    if (lower.startsWith('tel:')) {
      return { type: 'phone' as const, display: '电话热线' };
    }
    if (lower.startsWith('geo:')) {
      return { type: 'geo' as const, display: '地理定位' };
    }
    return { type: 'text' as const, display: '纯文本' };
  };

  // Wifi Parser helpers
  const parseWifi = (wifiStr: string) => {
    // Format: WIFI:S:SSID;T:WPA;P:PASSWORD;;
    const res = { ssid: '', security: 'None', password: '' };
    const ssidMatch = wifiStr.match(/S:([^;]+);/i);
    const typeMatch = wifiStr.match(/T:([^;]+);/i);
    const passMatch = wifiStr.match(/P:([^;]+);/i);
    if (ssidMatch) res.ssid = ssidMatch[1];
    if (typeMatch) res.security = typeMatch[1];
    if (passMatch) res.password = passMatch[1];
    return res;
  };

  // vCard Parser helpers
  const parseVcard = (vcardStr: string) => {
    const res = { name: '', phone: '', email: '', note: '' };
    const fnMatch = vcardStr.match(/FN:([^\r\n]+)/);
    const telMatch = vcardStr.match(/TEL;?[^:]*:([^\r\n]+)/);
    const emailMatch = vcardStr.match(/EMAIL;?[^:]*:([^\r\n]+)/);
    const noteMatch = vcardStr.match(/NOTE:([^\r\n]+)/);
    
    if (fnMatch) res.name = fnMatch[1];
    if (telMatch) res.phone = telMatch[1];
    if (emailMatch) res.email = emailMatch[1];
    if (noteMatch) res.note = noteMatch[1];
    return res;
  };

  // Email Parser helper
  const parseEmail = (emailStr: string) => {
    const res = { to: '', subject: '', body: '' };
    const toMatch = emailStr.match(/^mailto:([^?]+)/i);
    if (toMatch) res.to = toMatch[1];
    const subMatch = emailStr.match(/[?&]subject=([^&]+)/i);
    if (subMatch) res.subject = decodeURIComponent(subMatch[1]);
    const bodyMatch = emailStr.match(/[?&]body=([^&]+)/i);
    if (bodyMatch) res.body = decodeURIComponent(bodyMatch[1]);
    return res;
  };

  // SMS Parser helper
  const parseSms = (smsStr: string) => {
    const res = { phone: '', message: '' };
    if (smsStr.toLowerCase().startsWith('smsto:')) {
      const match = smsStr.match(/^SMSTO:([^:]+):(.*)$/i);
      if (match) {
        res.phone = match[1];
        res.message = match[2];
      }
    } else {
      const matchPhone = smsStr.match(/^sms:([^?]+)/i);
      if (matchPhone) res.phone = matchPhone[1];
      const matchBody = smsStr.match(/[?&]body=([^&]+)/i);
      if (matchBody) res.message = decodeURIComponent(matchBody[1]);
    }
    return res;
  };

  // Phone Parser helper
  const parsePhone = (phoneStr: string) => {
    const match = phoneStr.match(/^tel:(.*)$/i);
    return { phone: match ? match[1] : phoneStr };
  };

  // Geo Parser helper
  const parseGeo = (geoStr: string) => {
    const res = { lat: '', lng: '' };
    const match = geoStr.match(/^geo:([^,;?]+),([^,;?]+)/i);
    if (match) {
      res.lat = match[1];
      res.lng = match[2];
    }
    return res;
  };

  const performAutomaticScanAction = async (content: string) => {
    const now = Date.now();
    if (
      lastAutoActionRef.current?.content === content &&
      now - lastAutoActionRef.current.timestamp < 5000
    ) {
      return;
    }

    const info = inferTypeAndPayload(content);
    if (!['email', 'sms', 'phone', 'geo', 'vcard'].includes(info.type)) {
      return;
    }
    lastAutoActionRef.current = { content, timestamp: now };

    try {
      if (info.type === 'email') {
        window.location.href = content;
        addToast('已调用系统邮件动作', 'info');
      } else if (info.type === 'sms') {
        const sms = parseSms(content);
        if (!sms.phone) {
          addToast('短信二维码缺少号码', 'error');
          return;
        }
        window.location.href = `sms:${sms.phone}${sms.message ? `?body=${encodeURIComponent(sms.message)}` : ''}`;
        addToast('已调用系统短信动作', 'info');
      } else if (info.type === 'phone') {
        const phone = parsePhone(content).phone;
        if (!phone) {
          addToast('电话二维码缺少号码', 'error');
          return;
        }
        window.location.href = `tel:${phone}`;
        addToast('已调用系统拨号动作', 'info');
      } else if (info.type === 'geo') {
        const geo = parseGeo(content);
        if (!geo.lat || !geo.lng) {
          addToast('位置二维码缺少经纬度', 'error');
          return;
        }
        window.open(`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=15/${geo.lat}/${geo.lng}`, '_blank', 'noopener,noreferrer');
        addToast('已打开地图位置', 'info');
      } else if (info.type === 'vcard') {
        const card = parseVcard(content);
        const baseName = (card.name || 'contact').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'contact';
        const res = await bridge.saveFile({
          content,
          encoding: 'text',
          filename: `${baseName}.vcf`,
          fileType: 'txt',
        });
        if (res.success) {
          addToast(`已导出名片: ${res.path || `${baseName}.vcf`}`, 'success');
        } else if (res.error) {
          addToast(res.error, 'error');
        }
      }
    } catch (err: any) {
      addToast(`自动动作失败: ${err.message || String(err)}`, 'error');
    }
  };

  const getSourceDisplay = (src: 'camera' | 'screen' | 'file' | 'manual') => {
    switch (src) {
      case 'camera': return '摄像头扫码';
      case 'screen': return '屏幕截图扫码';
      case 'file': return '图片文件扫码';
      default: return '手动输入';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      
      {/* Top Banner Control Panel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {scanMode === 'camera' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
            <div className="te-screw tl"></div>
            <div className="te-screw tr"></div>
            <div className="te-screw bl"></div>
            <div className="te-screw br"></div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Camera size={20} color="var(--accent-orange)" />
                <h2 style={{ fontSize: '0.9rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>摄像头扫码 [CAM_INPUT]</h2>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Recessed LCD style camera select */}
                <select 
                  className="form-select" 
                  style={{ 
                    width: '140px', 
                    padding: '5px 24px 5px 8px', 
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: '#090a0f',
                    color: 'var(--accent-cyan)',
                    border: '1px solid var(--border-glass)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)'
                  }}
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  disabled={isCameraActive}
                >
                  {cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>{cam.name}</option>
                  ))}
                  {cameras.length === 0 && <option value="">未检测到摄像头</option>}
                </select>
                
                {/* Skeuomorphic Power Switch */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>PWR:</span>
                  <button 
                    className={`te-power-switch ${isCameraActive ? 'on' : 'off'}`}
                    style={{
                      width: '42px',
                      height: '18px',
                      borderRadius: '9px',
                      background: isCameraActive ? 'var(--accent-orange)' : '#090a0f',
                      border: '1.5px solid #000',
                      position: 'relative',
                      cursor: cameras.length === 0 && !selectedCamera ? 'not-allowed' : 'pointer',
                      padding: 0,
                      boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,0.8)',
                      transition: 'background 100ms ease'
                    }}
                    onClick={() => {
                      getAudioContext(); // Warm up AudioContext on user gesture
                      setIsCameraActive(!isCameraActive);
                    }}
                    disabled={cameras.length === 0 && !selectedCamera}
                  >
                    <div 
                      className="te-power-switch-handle"
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ffffff, #999999)',
                        border: '1px solid #333',
                        position: 'absolute',
                        top: '1.5px',
                        left: '2px',
                        transform: isCameraActive ? 'translateX(22px)' : 'translateX(0)',
                        transition: 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.5)'
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Camera display frame */}
            <div className="camera-viewport-wrapper te-screen te-screen-pulse" style={{ zIndex: 1, flex: 1, aspectRatio: 'auto', minHeight: 0 }}>
              <div className="camera-cyber-grid" />
              
              {/* HUD metadata overlay (Always visible for authentic telemetry aesthetic) */}
              <div className="camera-hud-overlay" style={{ opacity: isCameraActive ? 1 : 0.8 }}>
                <div className="hud-corner hud-tl" style={{ borderColor: isCameraActive ? 'var(--accent-cyan)' : 'var(--border-glass)' }}>
                  {isCameraActive ? `[STREAM: ACTIVE] [FPS: ${actualFps}]` : '[STREAM: STANDBY] [FPS: 00]'}
                </div>
                <div className="hud-corner hud-tr" style={{ borderColor: isCameraActive ? 'var(--accent-cyan)' : 'var(--border-glass)' }}>
                  {isCameraActive ? `[RES: ${actualResolution}]` : '[RES: --x--]'}
                </div>
                <div className="hud-corner hud-bl" style={{ borderColor: isCameraActive ? 'var(--accent-cyan)' : 'var(--border-glass)' }}>
                  {isCameraActive ? `[ZOOM: ${zoomScale.toFixed(2)}x] [EXP: ${brightness.toFixed(0)}%]` : '[ZOOM: 1.00x] [EXP: 100%]'}
                </div>
                <div className="hud-corner hud-br" style={{ borderColor: isCameraActive ? 'var(--accent-cyan)' : 'var(--border-glass)' }}>
                  {isCameraActive ? '[ECC: DYNAMIC_Q]' : '[ECC: NONE]'}
                </div>
              </div>

              {isCameraActive ? (
                <>
                  <video 
                    id="scanner-video" 
                    ref={videoRef}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover', 
                      objectPosition: 'center',
                      zIndex: 1, 
                      position: 'relative',
                      transform: `scale(${zoomScale})`,
                      filter: `brightness(${brightness}%) contrast(105%)`,
                      transition: 'transform 0.1s ease, filter 0.1s ease'
                    }} 
                  />
                  <img
                    id="scanner-native-frame"
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      zIndex: 2,
                      position: 'absolute',
                      inset: 0,
                      transform: `scale(${zoomScale})`,
                      filter: `brightness(${brightness}%) contrast(105%)`,
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Laser scan lines */}
                  <div className="laser-line" />
                  {/* Crosshair Target Borders */}
                  <div className="camera-crosshairs">
                    {/* Glowing corners */}
                    <div className="corner-bracket corner-tl" />
                    <div className="corner-bracket corner-tr" />
                    <div className="corner-bracket corner-bl" />
                    <div className="corner-bracket corner-br" />
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', zIndex: 12 }}>
                  {/* Animated vector screen graphic */}
                  <svg width="520" height="520" viewBox="0 0 120 120" style={{ pointerEvents: 'none' }}>
                    <defs>
                      {/* Glowing phosphor CRT filter */}
                      <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      
                      {/* Graduated sweep tail gradients */}
                      <linearGradient id="radar-gradient-1" x1="0" y1="0" x2="1" y2="0.3">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.08" />
                      </linearGradient>
                      <linearGradient id="radar-gradient-2" x1="0" y1="0" x2="0.3" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="radar-gradient-3" x1="0" y1="0" x2="-0.3" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.02" />
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Decorative Border Corner Brackets */}
                    <path d="M 6 16 L 6 6 L 16 6" fill="none" stroke="var(--border-glass)" strokeWidth="0.75" />
                    <path d="M 114 16 L 114 6 L 104 6" fill="none" stroke="var(--border-glass)" strokeWidth="0.75" />
                    <path d="M 6 104 L 6 114 L 16 114" fill="none" stroke="var(--border-glass)" strokeWidth="0.75" />
                    <path d="M 114 104 L 114 114 L 104 114" fill="none" stroke="var(--border-glass)" strokeWidth="0.75" />
                    
                    {/* Micro Digital Telemetry Info labels */}
                    <text x="8" y="14" fill="var(--text-muted)" fontSize="3.5" fontFamily="var(--font-mono)" opacity="0.4">CH_01: STBY</text>
                    <text x="112" y="14" fill="var(--accent-orange)" fontSize="3.5" fontFamily="var(--font-mono)" textAnchor="end" opacity="0.6">LOCK: NONE</text>
                    <text x="8" y="110" fill="var(--text-muted)" fontSize="3" fontFamily="var(--font-mono)" opacity="0.3">AZIMUTH: 359°</text>
                    <text x="112" y="110" fill="var(--text-muted)" fontSize="3" fontFamily="var(--font-mono)" textAnchor="end" opacity="0.3">RANGE: 120m</text>
  
                    {/* Concentric Grid Rings */}
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-glass)" strokeWidth="0.5" />
                    <circle cx="60" cy="60" r="38" fill="none" stroke="var(--border-glass)" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.7" />
                    <circle cx="60" cy="60" r="26" fill="none" stroke="var(--border-glass)" strokeWidth="0.5" />
                    <circle cx="60" cy="60" r="14" fill="none" stroke="var(--border-glass)" strokeWidth="0.5" strokeDasharray="1 2" opacity="0.5" />
                    
                    {/* Background fine cross grids */}
                    <line x1="60" y1="5" x2="60" y2="115" stroke="var(--border-glass)" strokeWidth="0.5" strokeDasharray="2 2" />
                    <line x1="5" y1="60" x2="115" y2="60" stroke="var(--border-glass)" strokeWidth="0.5" strokeDasharray="2 2" />
                    
                    {/* Outer mechanical tick ring (Slow clockwise rotation) */}
                    <g style={{ transformOrigin: '60px 60px', animation: 'te-spin 25s linear infinite' }}>
                      <circle cx="60" cy="60" r="53" fill="none" stroke="rgba(0, 213, 255, 0.25)" strokeWidth="1" strokeDasharray="1 5" />
                    </g>
                    
                    {/* Inner mechanical gear dial (Counter-clockwise rotation) */}
                    <g style={{ transformOrigin: '60px 60px', animation: 'te-spin-counter-clockwise 16s linear infinite' }}>
                      <circle cx="60" cy="60" r="44" fill="none" stroke="var(--accent-orange)" strokeWidth="0.75" strokeDasharray="8 6" opacity="0.5" />
                    </g>
  
                    {/* Fading sweep trail + Sweeper line */}
                    <g style={{ transformOrigin: '60px 60px', animation: 'te-spin 4s linear infinite' }}>
                      {/* Glowing Leading edge line */}
                      <line x1="60" y1="60" x2="60" y2="10" stroke="var(--accent-cyan)" strokeWidth="1.5" style={{ filter: 'url(#radar-glow)' }} />
                      
                      {/* Main sweep sector (0 to 45 deg) */}
                      <path d="M 60 60 L 60 10 A 50 50 0 0 1 95.35 24.65 Z" fill="url(#radar-gradient-1)" />
                      {/* First trailing sector (45 to 90 deg) */}
                      <path d="M 60 60 L 95.35 24.65 A 50 50 0 0 1 110 60 Z" fill="url(#radar-gradient-2)" />
                      {/* Second trailing sector (90 to 135 deg) */}
                      <path d="M 60 60 L 110 60 A 50 50 0 0 1 95.35 95.35 Z" fill="url(#radar-gradient-3)" />
                    </g>
  
                    {/* Blinking Targets detected */}
                    {/* Target 1 (Active cyan, top right) */}
                    <g style={{ animation: 'te-pulse-slow 2.4s infinite' }}>
                      <circle cx="88" cy="42" r="1.5" fill="var(--accent-cyan)" />
                      <circle cx="88" cy="42" r="4" fill="none" stroke="var(--accent-cyan)" strokeWidth="0.5" strokeDasharray="1 1" />
                      <text x="94" y="44" fill="var(--accent-cyan)" fontSize="2.5" fontFamily="var(--font-mono)">TRGT_01</text>
                    </g>
                    
                    {/* Target 2 (Warning Orange, bottom left) */}
                    <g style={{ animation: 'te-pulse-slow 1.6s infinite' }}>
                      <circle cx="36" cy="80" r="1.5" fill="var(--accent-orange)" />
                      <circle cx="36" cy="80" r="4" fill="none" stroke="var(--accent-orange)" strokeWidth="0.5" strokeDasharray="1 1" />
                      <text x="14" y="82" fill="var(--accent-orange)" fontSize="2.5" fontFamily="var(--font-mono)">TRGT_02</text>
                    </g>
  
                    {/* Core blinking center dot */}
                    <circle cx="60" cy="60" r="2.5" fill="var(--accent-orange)" style={{ filter: 'url(#radar-glow)' }} />
                    <circle cx="60" cy="60" r="6" fill="none" stroke="var(--accent-orange)" strokeWidth="0.5" style={{ animation: 'te-pulse-slow 2s infinite' }} />
                  </svg>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'var(--font-mono)' }}>SYSTEM STANDBY</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent-orange)', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>[LAUNCH CAMERA TO INGEST]</span>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="camera-error-overlay">
                  <ShieldAlert size={28} />
                  <span style={{ fontSize: '0.8rem', marginTop: '8px' }}>{cameraError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {scanMode === 'screen' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
            <div className="te-screw tl"></div>
            <div className="te-screw tr"></div>
            <div className="te-screw bl"></div>
            <div className="te-screw br"></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 2 }}>
              <Monitor size={20} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '0.9rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>屏幕截图扫码 [SCREEN_INPUT]</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, zIndex: 2, minHeight: 0 }}>
              <div className="te-screen" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', position: 'relative', overflow: 'hidden', minHeight: 0, borderRadius: '3px' }}>
                <div className="camera-cyber-grid" />
                {/* Simulated vertical scan light bar */}
                <div style={{ 
                  position: 'absolute', 
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundImage: 'linear-gradient(rgba(0, 213, 255, 0.08) 1px, transparent 1px)',
                  backgroundSize: '100% 8px',
                  animation: 'scanline-sweep 4s infinite linear'
                }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 5, color: 'var(--accent-cyan)' }}>
                  <Monitor size={24} className={isScanningScreen ? 'animate-pulse' : ''} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>OSC_SCAN_STBY</span>
                </div>
                
                {/* Active channel LED */}
                <div style={{ 
                  position: 'absolute', 
                  top: '8px', 
                  right: '8px', 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: isScanningScreen ? 'var(--accent-cyan)' : 'var(--accent-green)',
                  boxShadow: isScanningScreen ? '0 0 6px var(--accent-cyan)' : '0 0 4px var(--accent-green)',
                  animation: isScanningScreen ? 'te-pulse-slow 0.5s infinite' : 'none'
                }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', cursor: 'pointer', zIndex: 5, margin: '2px 0' }}>
                <input
                  type="checkbox"
                  checked={hideWindowForScreenScan}
                  onChange={(e) => setHideWindowForScreenScan(e.target.checked)}
                />
                截图前隐藏当前窗口
              </label>
              
              <button 
                className="btn btn-primary screen-scan-btn" 
                style={{ width: '100%', padding: '10px 20px', fontSize: '0.8rem', position: 'relative', zIndex: 5 }}
                onClick={handleScreenScan}
                disabled={isScanningScreen}
              >
                <span style={{ 
                  position: 'absolute', 
                  top: '1.5px', 
                  left: '6px', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.45rem', 
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.5px'
                }}>
                  [CH_AUX_01]
                </span>
                {isScanningScreen ? '等待框选区域...' : '框选区域截图识别'}
              </button>
            </div>
          </div>
        )}

        {scanMode === 'file' && (
          <div 
            className="glass-panel file-dropzone" 
            style={{ 
              padding: '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              position: 'relative', 
              width: '100%',
              height: '100%', 
              minHeight: 0,
              border: isDragging ? '1.5px dashed var(--accent-orange)' : '1px solid var(--border-glass)',
              transition: 'border-color 0.15s ease'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="te-screw tl"></div>
            <div className="te-screw tr"></div>
            <div className="te-screw bl"></div>
            <div className="te-screw br"></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 2 }}>
              <FileUp size={20} color="var(--accent-orange)" />
              <h2 style={{ fontSize: '0.9rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>图片文件扫码 [FILE_INPUT]</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, zIndex: 2, minHeight: 0 }}>
              <div className="te-screen" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', position: 'relative', overflow: 'hidden', minHeight: 0, borderRadius: '3px', cursor: 'copy' }}>
                <div className="camera-cyber-grid" />
                {/* Sweeping laser scanner line */}
                <div style={{ 
                  position: 'absolute', 
                  left: 0, right: 0,
                  height: '2px',
                  background: 'var(--accent-orange)',
                  opacity: 0.35,
                  boxShadow: '0 0 6px var(--accent-orange)',
                  animation: 'laser-sweep 3s infinite linear'
                }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 5, color: 'var(--accent-orange)' }}>
                  <FileUp size={24} className={isProcessingFile ? 'animate-pulse' : ''} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                    {isDragging ? 'DROP_FILE_NOW' : 'FILE_DROP_STBY'}
                  </span>
                </div>
                
                {/* Active channel LED */}
                <div style={{ 
                  position: 'absolute', 
                  top: '8px', 
                  right: '8px', 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: isProcessingFile ? 'var(--accent-orange)' : 'var(--accent-green)',
                  boxShadow: isProcessingFile ? '0 0 6px var(--accent-orange)' : '0 0 4px var(--accent-green)',
                  animation: isProcessingFile ? 'te-pulse-slow 0.5s infinite' : 'none'
                }} />
              </div>
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '10px 20px', fontSize: '0.8rem', position: 'relative', zIndex: 5 }}
                onClick={handleFileScan}
                disabled={isProcessingFile}
              >
                <span style={{ 
                  position: 'absolute', 
                  top: '1.5px', 
                  left: '6px', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.45rem', 
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.5px'
                }}>
                  [CH_AUX_02]
                </span>
                {isProcessingFile ? '正在解析文件...' : '拖拽或导入图片 PNG/JPG/WEBP/SVG'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Result presentation window */}
      {scanResult && (
        <div className="modal-overlay" style={{ zIndex: 80 }}>
        <div className="glass-panel modal-content" style={{ width: 'min(760px, calc(100vw - 40px))', maxHeight: 'min(760px, calc(100vh - 40px))', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div className="te-screw tl"></div>
          <div className="te-screw tr"></div>
          <div className="te-screw bl"></div>
          <div className="te-screw br"></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                background: 'rgba(255, 85, 0, 0.15)', 
                color: 'var(--accent-orange)', 
                padding: '4px 8px', 
                borderRadius: '3px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                border: '1px solid rgba(255, 85, 0, 0.3)'
              }}>
                {getSourceDisplay(scanSource)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                识别类型: <strong style={{ color: 'var(--text-main)' }}>{inferTypeAndPayload(scanResult).display}</strong>
              </span>
            </div>
            
            <button className="modal-close-btn" onClick={() => setScanResult(null)}>
              <X size={18} />
            </button>
          </div>

          <div 
            className="te-screen te-screen-pulse"
            style={{ 
              padding: '16px', 
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              wordBreak: 'break-all',
              maxHeight: '180px',
              overflowY: 'auto',
              color: 'var(--accent-orange)', /* Amber phosphor */
              border: '2px solid #000',
              zIndex: 2
            }}
          >
            <div style={{ position: 'relative', zIndex: 12 }}>
              {scanResult}
            </div>
          </div>

          {/* Contextual formatted card display */}
          {inferTypeAndPayload(scanResult).type === 'wifi' && (
            <div className="alert-box info" style={{ margin: 0, flexDirection: 'column', gap: '4px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <Wifi size={14} color="var(--accent-cyan)" />
                <span>Wi-Fi 网络信息 [WIFI_CONFIG]</span>
              </div>
              <div>SSID 账号: <strong>{parseWifi(scanResult).ssid}</strong></div>
              <div>加密类型: <span>{parseWifi(scanResult).security}</span></div>
              {parseWifi(scanResult).password && <div>安全密码: <strong style={{ color: 'var(--accent-orange)' }}>{parseWifi(scanResult).password}</strong></div>}
            </div>
          )}

          {inferTypeAndPayload(scanResult).type === 'vcard' && (
            <div className="alert-box info" style={{ margin: 0, flexDirection: 'column', gap: '4px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <User size={14} color="var(--accent-cyan)" />
                <span>电子名片联系人 [VCARD_DATA]</span>
              </div>
              <div>姓名: <strong>{parseVcard(scanResult).name}</strong></div>
              {parseVcard(scanResult).phone && <div>电话: <span>{parseVcard(scanResult).phone}</span></div>}
              {parseVcard(scanResult).email && <div>邮箱: <span>{parseVcard(scanResult).email}</span></div>}
              {parseVcard(scanResult).note && <div>备注: <span>{parseVcard(scanResult).note}</span></div>}
            </div>
          )}

          {inferTypeAndPayload(scanResult).type === 'email' && (
            <div className="alert-box info" style={{ margin: 0, flexDirection: 'column', gap: '4px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <Mail size={14} color="var(--accent-cyan)" />
                <span>电子邮件信息 [EMAIL_PAYLOAD]</span>
              </div>
              <div>收件人: <strong>{parseEmail(scanResult).to}</strong></div>
              {parseEmail(scanResult).subject && <div>主题: <span>{parseEmail(scanResult).subject}</span></div>}
              {parseEmail(scanResult).body && <div style={{ opacity: 0.8 }}>正文: <span>{parseEmail(scanResult).body}</span></div>}
            </div>
          )}

          {inferTypeAndPayload(scanResult).type === 'sms' && (
            <div className="alert-box info" style={{ margin: 0, flexDirection: 'column', gap: '4px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <MessageSquare size={14} color="var(--accent-cyan)" />
                <span>短信服务载荷 [SMS_PAYLOAD]</span>
              </div>
              <div>手机号码: <strong>{parseSms(scanResult).phone}</strong></div>
              {parseSms(scanResult).message && <div style={{ opacity: 0.8 }}>短信正文: <span>{parseSms(scanResult).message}</span></div>}
            </div>
          )}

          {inferTypeAndPayload(scanResult).type === 'phone' && (
            <div className="alert-box info" style={{ margin: 0, flexDirection: 'column', gap: '4px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <Phone size={14} color="var(--accent-cyan)" />
                <span>拨号热线指令 [PHONE_CALL]</span>
              </div>
              <div>电话号码: <strong>{parsePhone(scanResult).phone}</strong></div>
            </div>
          )}

          {inferTypeAndPayload(scanResult).type === 'geo' && (
            <div className="alert-box info" style={{ margin: 0, flexDirection: 'column', gap: '4px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                <MapPin size={14} color="var(--accent-cyan)" />
                <span>地理坐标定位 [GEO_COORDINATES]</span>
              </div>
              <div>纬度 (Lat): <strong>{parseGeo(scanResult).lat}</strong></div>
              <div>经度 (Lng): <strong>{parseGeo(scanResult).lng}</strong></div>
            </div>
          )}

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', zIndex: 2, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={copyResult}>
              <Copy size={14} />
              <span>复制内容</span>
            </button>

            {inferTypeAndPayload(scanResult).type === 'url' && (
              <button className="btn btn-primary" onClick={() => handleOpenUrl(scanResult)}>
                <ExternalLink size={14} />
                <span>打开网址</span>
              </button>
            )}

            {inferTypeAndPayload(scanResult).type === 'email' && (
              <a className="btn btn-primary" href={scanResult} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} />
                <span>撰写邮件</span>
              </a>
            )}

            {inferTypeAndPayload(scanResult).type === 'sms' && (
              <a 
                className="btn btn-primary" 
                href={`sms:${parseSms(scanResult).phone}${parseSms(scanResult).message ? `?body=${encodeURIComponent(parseSms(scanResult).message)}` : ''}`}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <MessageSquare size={14} />
                <span>发送短信</span>
              </a>
            )}

            {inferTypeAndPayload(scanResult).type === 'phone' && (
              <a className="btn btn-primary" href={`tel:${parsePhone(scanResult).phone}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} />
                <span>拨打电话</span>
              </a>
            )}

            {inferTypeAndPayload(scanResult).type === 'geo' && (
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  const geo = parseGeo(scanResult);
                  if (geo.lat && geo.lng) {
                    window.open(`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=15/${geo.lat}/${geo.lng}`, '_blank', 'noopener,noreferrer');
                  } else {
                    addToast('无法解析经纬度坐标', 'error');
                  }
                }}
              >
                <MapPin size={14} />
                <span>在地图中查看</span>
              </button>
            )}

            <button 
              className="btn btn-secondary" 
              onClick={() => {
                const info = inferTypeAndPayload(scanResult);
                onGeneratePreFill(scanResult, info.type);
              }}
            >
              <RefreshCw size={14} />
              <span>以此内容生成</span>
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Safety Confirmation Modal */}
      {showConfirmUrlModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-orange)' }}>
              <ShieldAlert size={28} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-title)' }}>安全警告：打开外部链接</h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              即将跳转至以下网页。二维码链接可能包含钓鱼攻击、病毒或恶意软件，请确保该域名安全可信后再继续：
            </p>
            
            <div style={{ 
              background: 'rgba(10, 15, 26, 0.8)', 
              padding: '12px', 
              borderRadius: '6px', 
              border: '1px solid var(--border-glass)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              wordBreak: 'break-all',
              color: 'var(--accent-orange)'
            }}>
              {showConfirmUrlModal}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmUrlModal(null)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={() => triggerOpenUrlDirectly(showConfirmUrlModal)}>
                确认并前往
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
