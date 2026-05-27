import jsQR from 'jsqr';
import QRCode from 'qrcode';

export interface BridgeInfo {
  isMock: boolean;
  platform: 'windows' | 'linux' | 'macos' | 'browser' | 'unknown';
  version: string;
}

export interface CameraDevice {
  id: string;
  name: string;
}

export interface CameraScanOptions {
  cameraId?: string;
}

export interface ScanResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface CameraScanResult extends ScanResult {
  source: 'camera';
  cameraId?: string;
  timestamp: number;
}

export interface ImageScanRequest {
  content: string; // Base64 or DataURL content
  encoding: 'base64' | 'dataUrl';
  mimeType?: string;
  filename?: string;
}

export interface QrPayload {
  type: 'text' | 'url' | 'wifi' | 'vcard';
  content: string;
}

export interface QrGenerateOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  foreground?: string; // Solid hex (e.g. #ff00ff) or gradient specifier
  background?: string;
  dotStyle?: 'square' | 'dot' | 'rounded';
  eyeStyle?: 'square' | 'dot' | 'rounded';
  logoDataUrl?: string;
}

export interface QrOutput {
  pngDataUrl: string;
  svgText: string;
}

export interface SaveFileRequest {
  content: string; // Can be text, base64 binary, or dataUrl
  encoding: 'text' | 'base64' | 'dataUrl';
  filename: string;
  fileType: 'png' | 'svg' | 'txt';
}

export interface SaveFileResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface HistoryItem {
  id: string;
  type: 'scan' | 'generate';
  dataType: 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo';
  content: string;
  source?: 'camera' | 'screen' | 'file' | 'manual';
  timestamp: number;
}

export interface HistoryItemInput {
  type: 'scan' | 'generate';
  dataType: 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo';
  content: string;
  source?: 'camera' | 'screen' | 'file' | 'manual';
}

export interface AppSettings {
  theme: 'dark' | 'light';
  autoCopy: boolean;
  soundEnabled: boolean;
  shortcutCapture: string;
  confirmBeforeOpenUrl: boolean;
  saveHistory: boolean;
}

export interface DesktopBridge {
  getBridgeInfo(): Promise<BridgeInfo>;

  // Camera Management
  listCameras(): Promise<CameraDevice[]>;
  startCameraScan(options: CameraScanOptions): Promise<void>;
  stopCameraScan(): Promise<void>;
  onCameraScanResult(handler: (result: CameraScanResult) => void): () => void;
  onCameraScanError(handler: (error: string) => void): () => void;

  // Scanning Actions
  scanImageFile(): Promise<ScanResult>;
  scanImageData(request: ImageScanRequest): Promise<ScanResult>;
  scanScreen(): Promise<ScanResult>;

  // QR Code Generation
  generateQr(payload: QrPayload, options: QrGenerateOptions): Promise<QrOutput>;

  // System Utilities
  saveFile(file: SaveFileRequest): Promise<SaveFileResult>;
  copyToClipboard(text: string): Promise<void>;

  // History & Storage
  getHistory(): Promise<HistoryItem[]>;
  addHistory(item: HistoryItemInput): Promise<HistoryItem>;
  deleteHistory(id: string): Promise<void>;
  clearHistory(): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
}

// ----------------------------------------------------
// BROWSER MOCK IMPLEMENTATION
// ----------------------------------------------------

class BrowserMockBridge implements DesktopBridge {
  private resultListeners: Set<(result: CameraScanResult) => void> = new Set();
  private errorListeners: Set<(error: string) => void> = new Set();

  // Camera state
  private activeStream: MediaStream | null = null;
  private hiddenVideo: HTMLVideoElement | null = null;
  private scanIntervalId: any = null;
  private lastScannedContent = '';
  private lastScanTime = 0;

  async getBridgeInfo(): Promise<BridgeInfo> {
    return {
      isMock: true,
      platform: 'browser',
      version: '1.0.0-mock',
    };
  }

  async listCameras(): Promise<CameraDevice[]> {
    try {
      // Trigger permission dialog if not already granted
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      return videoDevices.map((d, index) => ({
        id: d.deviceId || `camera-${index}`,
        name: d.label || `Camera ${index + 1}`,
      }));
    } catch (e) {
      console.warn('Camera access denied or unavailable in listCameras', e);
      return [
        { id: 'mock-camera-1', name: 'Mock Camera 1 (Webcam Simulation)' }
      ];
    }
  }

  async startCameraScan(options: CameraScanOptions): Promise<void> {
    await this.stopCameraScan(); // Ensure cleanup

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: options.cameraId ? { exact: options.cameraId } : undefined,
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 60, max: 120 },
          // Request continuous focus if supported to maximize image clarity
          advanced: [
            { focusMode: 'continuous' } as any,
            { exposureMode: 'continuous' } as any
          ]
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.activeStream = stream;

      // Check if there is an active video element in the UI to bind to
      let video = document.getElementById('scanner-video') as HTMLVideoElement | null;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.play().catch(e => console.warn('Video play failed:', e));
      } else {
        video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.play().catch(e => console.warn('Fallback video play failed:', e));
      }
      this.hiddenVideo = video;

      const offscreenCanvas = document.createElement('canvas');
      const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

      // Scan at higher frequency (~33fps) for near-instantaneous QR detection
      this.scanIntervalId = setInterval(() => {
        if (!video || !video.videoWidth || !video.videoHeight || !ctx) return;
        
        // Limit scanning canvas dimension to max 1024px width for rapid decoding performance
        const maxScanDim = 1024;
        let scanWidth = video.videoWidth;
        let scanHeight = video.videoHeight;
        if (scanWidth > maxScanDim) {
          scanWidth = maxScanDim;
          scanHeight = Math.round((maxScanDim / video.videoWidth) * video.videoHeight);
        }
        
        offscreenCanvas.width = scanWidth;
        offscreenCanvas.height = scanHeight;
        ctx.drawImage(video, 0, 0, scanWidth, scanHeight);

        const imgData = ctx.getImageData(0, 0, scanWidth, scanHeight);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const now = Date.now();
          // Throttle identical scans to prevent UI flickering
          if (code.data !== this.lastScannedContent || now - this.lastScanTime > 1500) {
            this.lastScannedContent = code.data;
            this.lastScanTime = now;
            this.notifyResult({
              success: true,
              content: code.data,
              source: 'camera',
              cameraId: options.cameraId,
              timestamp: now,
            });
          }
        }
      }, 30);

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.notifyError(errMsg);
      throw err;
    }
  }

  async stopCameraScan(): Promise<void> {
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
    if (this.hiddenVideo) {
      this.hiddenVideo.srcObject = null;
      this.hiddenVideo = null;
    }
    this.lastScannedContent = '';
  }

  onCameraScanResult(handler: (result: CameraScanResult) => void): () => void {
    this.resultListeners.add(handler);
    return () => this.resultListeners.delete(handler);
  }

  onCameraScanError(handler: (error: string) => void): () => void {
    this.errorListeners.add(handler);
    return () => this.errorListeners.delete(handler);
  }

  private notifyResult(result: CameraScanResult) {
    this.resultListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (e) {
        console.error(e);
      }
    });
  }

  private notifyError(error: string) {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Scan file by opening a file picker
  async scanImageFile(): Promise<ScanResult> {
    return new Promise((resolve) => {
      let resolved = false;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      // Handle user closed dialog fallback
      const handleUserClosedDialog = () => {
        if (!resolved) {
          done({ success: false, error: 'User cancelled file selection' });
        }
      };

      // Add delayed fallback event listeners to catch window interaction when dialog closes
      let fallbackTimeout: any = null;
      const registerFallbacks = () => {
        window.addEventListener('focus', handleUserClosedDialog);
        window.addEventListener('click', handleUserClosedDialog);
        window.addEventListener('mousemove', handleUserClosedDialog);
      };

      const cleanup = () => {
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
        }
        window.removeEventListener('focus', handleUserClosedDialog);
        window.removeEventListener('click', handleUserClosedDialog);
        window.removeEventListener('mousemove', handleUserClosedDialog);
      };

      const done = (res: ScanResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(res);
      };

      // Register fallbacks after 500ms delay to avoid capturing the initial click
      fallbackTimeout = setTimeout(registerFallbacks, 500);

      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          done({ success: false, error: 'No file selected' });
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          try {
            const res = await this.scanImageData({ content: dataUrl, encoding: 'dataUrl' });
            done(res);
          } catch (err: any) {
            done({ success: false, error: err.message || String(err) });
          }
        };
        reader.onerror = () => done({ success: false, error: 'Failed to read file' });
        reader.readAsDataURL(file);
      };

      // Native browser cancel event
      input.oncancel = () => {
        done({ success: false, error: 'User cancelled file selection' });
      };

      input.addEventListener('cancel', () => {
        done({ success: false, error: 'User cancelled file selection' });
      });

      input.click();
    });
  }

  // Decodes image data
  async scanImageData(request: ImageScanRequest): Promise<ScanResult> {
    return new Promise((resolve) => {
      let src = request.content;
      if (request.encoding === 'base64') {
        const mime = request.mimeType || 'image/png';
        src = `data:${mime};base64,${request.content}`;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ success: false, error: 'Could not create canvas context' });
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            resolve({ success: true, content: code.data });
          } else {
            resolve({ success: false, error: 'No QR code found in image' });
          }
        } catch (e: any) {
          resolve({ success: false, error: `Canvas Security/Read Error: ${e.message || String(e)}` });
        }
      };
      img.onerror = () => resolve({ success: false, error: 'Failed to load image structure' });
      img.src = src;
    });
  }

  // Screen Scanning Fallback via WebRTC Screen Sharing API
  async scanScreen(): Promise<ScanResult> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      // Wait a tiny bit for video to render frames
      await new Promise((r) => setTimeout(r, 600));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      let result: ScanResult = { success: false, error: 'No QR code detected on screen' };

      if (ctx) {
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const imgData = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          result = { success: true, content: code.data };
        }
      }

      // Cleanup
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      return result;
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  // Generate QR using standard qrcode package in browser
  async generateQr(payload: QrPayload, options: QrGenerateOptions): Promise<QrOutput> {
    try {
      const margin = options.margin !== undefined ? options.margin : 4;
      const errorCorrectionLevel = options.errorCorrectionLevel || 'M';
      const width = options.width || 400;

      // Base generation of PNG dataURL
      const pngDataUrl = await QRCode.toDataURL(payload.content, {
        width,
        margin,
        errorCorrectionLevel: errorCorrectionLevel,
        color: {
          dark: options.foreground || '#000000',
          light: options.background || '#ffffff',
        },
      });

      // Base generation of SVG text
      const svgText = await QRCode.toString(payload.content, {
        type: 'svg',
        margin,
        errorCorrectionLevel: errorCorrectionLevel,
        color: {
          dark: options.foreground || '#000000',
          light: options.background || '#ffffff',
        },
      });

      return { pngDataUrl, svgText };
    } catch (err: any) {
      throw new Error(`Failed to generate QR: ${err.message || String(err)}`);
    }
  }

  // Save File Fallback (Web browser file download trigger)
  async saveFile(file: SaveFileRequest): Promise<SaveFileResult> {
    try {
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const mimeType = file.fileType === 'png' ? 'image/png' : (file.fileType === 'svg' ? 'image/svg+xml' : 'text/plain');
          const options: any = {
            suggestedName: file.filename,
            types: [{
              description: file.fileType === 'png' ? 'PNG Image' : (file.fileType === 'svg' ? 'SVG Image' : 'Text File'),
              accept: { [mimeType]: [`.${file.fileType}`] }
            }]
          };

          const handle = await (window as any).showSaveFilePicker(options);
          const writable = await handle.createWritable();

          if (file.encoding === 'dataUrl') {
            const response = await fetch(file.content);
            const blob = await response.blob();
            await writable.write(blob);
          } else if (file.encoding === 'base64') {
            const response = await fetch(`data:${mimeType};base64,${file.content}`);
            const blob = await response.blob();
            await writable.write(blob);
          } else {
            await writable.write(file.content);
          }

          await writable.close();
          const fileInfo = await handle.getFile();
          return { success: true, path: fileInfo.name };
        } catch (e: any) {
          // If the user aborted the save picker, don't trigger fallback, just fail gracefully
          if (e.name === 'AbortError') {
            return { success: false, error: '用户取消了保存操作' };
          }
          // For other errors in picker, fall through to the classic download method
          console.warn('showSaveFilePicker failed, falling back to download:', e);
        }
      }

      // Classic Fallback: Web browser file download trigger
      let url = '';
      if (file.encoding === 'dataUrl') {
        url = file.content;
      } else if (file.encoding === 'base64') {
        const mime = file.fileType === 'png' ? 'image/png' : 'text/plain';
        url = `data:${mime};base64,${file.content}`;
      } else {
        // text/svg
        const blob = new Blob([file.content], { type: file.fileType === 'svg' ? 'image/svg+xml' : 'text/plain' });
        url = URL.createObjectURL(blob);
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (file.encoding === 'text' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }

      return { success: true, path: `downloads/${file.filename}` };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  // Copy to system clipboard
  async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API not available');
    }
  }

  // History operations (using localStorage)
  private getHistoryKey(): string {
    return 'qr_scanner_history_v1';
  }

  async getHistory(): Promise<HistoryItem[]> {
    const raw = localStorage.getItem(this.getHistoryKey());
    return raw ? JSON.parse(raw) : [];
  }

  async addHistory(item: HistoryItemInput): Promise<HistoryItem> {
    const history = await this.getHistory();
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      type: item.type,
      dataType: item.dataType,
      content: item.content,
      source: item.source,
      timestamp: Date.now(),
    };
    
    // Save settings check if history logging is enabled
    const settings = await this.getSettings();
    if (!settings.saveHistory) {
      return newItem;
    }

    history.unshift(newItem);
    localStorage.setItem(this.getHistoryKey(), JSON.stringify(history));
    return newItem;
  }

  async deleteHistory(id: string): Promise<void> {
    const history = await this.getHistory();
    const updated = history.filter((h) => h.id !== id);
    localStorage.setItem(this.getHistoryKey(), JSON.stringify(updated));
  }

  async clearHistory(): Promise<void> {
    localStorage.removeItem(this.getHistoryKey());
  }

  // Settings operations (using localStorage)
  private getSettingsKey(): string {
    return 'qr_scanner_settings_v1';
  }

  async getSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      theme: 'dark',
      autoCopy: false,
      soundEnabled: false,
      shortcutCapture: 'Ctrl+Shift+S',
      confirmBeforeOpenUrl: true,
      saveHistory: true,
    };
    const raw = localStorage.getItem(this.getSettingsKey());
    if (!raw) return defaultSettings;
    try {
      return { ...defaultSettings, ...JSON.parse(raw) };
    } catch {
      return defaultSettings;
    }
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...patch };
    localStorage.setItem(this.getSettingsKey(), JSON.stringify(updated));
    return updated;
  }
}

// Global bridge setup
declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

// Instantiate and expose bridge
const bridgeInstance: DesktopBridge = window.desktopBridge || new BrowserMockBridge();
window.desktopBridge = bridgeInstance;

export default bridgeInstance;
