import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ScanView from './components/ScanView';
import GenerateView from './components/GenerateView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import bridge from './bridge/desktopBridge';
import type { AppSettings, BridgeInfo, DataType } from './bridge/desktopBridge';

interface Toast {
  id: string;
  msg: string;
  type: 'success' | 'error' | 'info';
}

function App() {
  const [currentTab, setCurrentTab] = useState<'scan' | 'generate' | 'history' | 'settings'>('scan');
  const [scanMode, setScanMode] = useState<'camera' | 'screen' | 'file'>('camera');
  const [screenScanTrigger, setScreenScanTrigger] = useState<number>(0);
  const [fileScanTrigger, setFileScanTrigger] = useState<number>(0);
  const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo | null>(null);
  
  // Camera & Scan control states (Landed from Sidebar knobs & patch bay)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isScanningScreen, setIsScanningScreen] = useState<boolean>(false);
  const [knobA, setKnobA] = useState<number>(0);
  const [knobB, setKnobB] = useState<number>(180);
  
  // Real-time camera stream specifications
  const [cameraFps, setCameraFps] = useState<number>(0);
  
  // Settings state
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    autoCopy: false,
    soundEnabled: false,
    shortcutCapture: 'Ctrl+Shift+S',
    confirmBeforeOpenUrl: true,
    saveHistory: true,
  });

  // Pre-fill state (Scan -> Generate navigation bridge)
  const [preFillContent, setPreFillContent] = useState<string | null>(null);
  const [preFillType, setPreFillType] = useState<DataType | null>(null);

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast manager helper
  const addToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, msg, type }]);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Reset camera specs when camera turns off
  useEffect(() => {
    if (!isCameraActive) {
      setCameraFps(0);
    }
  }, [isCameraActive]);

  // On mount: fetch settings & bridge info
  useEffect(() => {
    const initApp = async () => {
      try {
        const info = await bridge.getBridgeInfo();
        setBridgeInfo(info);

        const loadedSettings = await bridge.getSettings();
        setSettings(loadedSettings);
        
        // Apply theme to document root
        document.documentElement.setAttribute('data-theme', loadedSettings.theme);
      } catch (err) {
        console.error('Failed to initialize app settings:', err);
      }
    };
    initApp();
  }, []);

  // Global keydown listeners for keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check Alt + 1..6 (or Option + 1..6 on macOS)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          openCameraScan();
        } else if (e.key === '2') {
          e.preventDefault();
          openScreenScan();
        } else if (e.key === '3') {
          e.preventDefault();
          openFileScan();
        } else if (e.key === '4') {
          e.preventDefault();
          setCurrentTab('generate');
        } else if (e.key === '5') {
          e.preventDefault();
          setCurrentTab('history');
        } else if (e.key === '6') {
          e.preventDefault();
          setCurrentTab('settings');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Update setting value and sync to bridge
  const updateSettingValue = async (key: keyof AppSettings, value: any) => {
    const patch = { [key]: value };
    try {
      const updated = await bridge.updateSettings(patch);
      setSettings(updated);

      if (key === 'theme') {
        document.documentElement.setAttribute('data-theme', value);
      }
      addToast('设置已自动保存', 'success');
    } catch (err) {
      console.error('Failed to update setting:', err);
      addToast('保存设置失败', 'error');
    }
  };

  // Navigates to Generate View and prefills QR details
  const handleGeneratePreFill = (content: string, type: DataType) => {
    setPreFillContent(content);
    setPreFillType(type);
    setCurrentTab('generate');
  };

  const openCameraScan = () => {
    setScanMode('camera');
    setCurrentTab('scan');
  };

  const openScreenScan = () => {
    setScanMode('screen');
    setCurrentTab('scan');
  };

  const openFileScan = () => {
    setScanMode('file');
    setCurrentTab('scan');
  };

  const triggerPatchBayScreenScan = () => {
    setScanMode('screen');
    setScreenScanTrigger((prev) => prev + 1);
    setCurrentTab('scan');
  };

  const triggerPatchBayFileScan = () => {
    setScanMode('file');
    setFileScanTrigger((prev) => prev + 1);
    setCurrentTab('scan');
  };

  const getHeaderTitle = () => {
    switch (currentTab) {
      case 'scan':
        if (scanMode === 'screen') return 'MODE: SCREEN_CAPTURE_SCAN [CH_02]';
        if (scanMode === 'file') return 'MODE: IMAGE_FILE_SCAN [CH_03]';
        return 'MODE: CAMERA_SCANNER [CH_01]';
      case 'generate': return 'MODE: QR_GENERATOR [CH_04]';
      case 'history': return 'MODE: LOG_HISTORY [CH_05]';
      case 'settings': return 'MODE: SYSTEM_SETTINGS [CH_06]';
      default: return 'MODE: QR_TOOLBOX';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        scanMode={scanMode}
        openCameraScan={openCameraScan}
        openScreenScan={openScreenScan}
        openFileScan={openFileScan}
        bridgeInfo={bridgeInfo}
        theme={settings.theme}
        setTheme={(theme) => updateSettingValue('theme', theme)}
        isCameraActive={isCameraActive}
        setIsCameraActive={setIsCameraActive}
        isScanningScreen={isScanningScreen}
        knobA={knobA}
        setKnobA={setKnobA}
        knobB={knobB}
        setKnobB={setKnobB}
        triggerScreenScan={triggerPatchBayScreenScan}
        triggerFileScan={triggerPatchBayFileScan}
        addToast={addToast}
        cameraFps={cameraFps}
      />

      {/* Main Viewport panel */}
      <main className="main-content">
        
        {/* Dynamic Context Header */}
        <header className="header-bar">
          <h1 className="header-title">{getHeaderTitle()}</h1>
        </header>

        {/* Tab router view switcher */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {currentTab === 'scan' && (
            <ScanView
              settings={settings}
              addToast={addToast}
              onGeneratePreFill={handleGeneratePreFill}
              knobA={knobA}
              knobB={knobB}
              isCameraActive={isCameraActive}
              setIsCameraActive={setIsCameraActive}
              isScanningScreen={isScanningScreen}
              setIsScanningScreen={setIsScanningScreen}
              scanMode={scanMode}
              setScanMode={setScanMode}
              screenScanTrigger={screenScanTrigger}
              fileScanTrigger={fileScanTrigger}
              onStreamInfoChange={(fps) => {
                setCameraFps(fps);
              }}
            />
          )}

          {currentTab === 'generate' && (
            <GenerateView
              settings={settings}
              addToast={addToast}
              preFillContent={preFillContent}
              preFillType={preFillType}
              clearPreFill={() => {
                setPreFillContent(null);
                setPreFillType(null);
              }}
            />
          )}

          {currentTab === 'history' && (
            <HistoryView
              addToast={addToast}
              onGeneratePreFill={handleGeneratePreFill}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              bridgeInfo={bridgeInfo}
              updateSettingValue={updateSettingValue}
            />
          )}
        </div>

      </main>

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.msg}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

export default App;
