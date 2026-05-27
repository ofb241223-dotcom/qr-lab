import { ShieldCheck, HardDrive, Settings2 } from 'lucide-react';
import type { AppSettings, BridgeInfo } from '../bridge/desktopBridge';

interface SettingsViewProps {
  settings: AppSettings;
  bridgeInfo: BridgeInfo | null;
  updateSettingValue: (key: keyof AppSettings, value: any) => void;
}

export default function SettingsView({
  settings,
  bridgeInfo,
  updateSettingValue,
}: SettingsViewProps) {
  
  const getPlatformDisplay = (platform?: string) => {
    switch (platform) {
      case 'windows': return 'Microsoft Windows';
      case 'macos': return 'Apple macOS';
      case 'linux': return 'GNU/Linux';
      case 'browser': return 'Web Browser (Development Preview)';
      default: return '未知平台';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '20px', height: '100%', overflow: 'hidden' }}>
      
      {/* Settings list form */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', position: 'relative' }}>
        <div className="te-screw tl"></div>
        <div className="te-screw tr"></div>
        <div className="te-screw bl"></div>
        <div className="te-screw br"></div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px dashed var(--border-glass)', paddingBottom: '10px', zIndex: 2, position: 'relative' }}>
          <Settings2 size={18} color="var(--accent-orange)" />
          <h2 style={{ fontSize: '0.9rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>系统参数配置 [SYSTEM_SETTINGS]</h2>
        </div>

        {/* Symmetrical Dual-Channel Settings Console */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px', zIndex: 2, position: 'relative', flex: 1 }}>
          
          {/* Column 1: SYSTEM & INTERFACE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderRight: '1px dashed var(--border-glass)', paddingRight: '24px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontWeight: 'bold', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)', borderBottom: '1px dashed var(--border-glass)', paddingBottom: '6px', marginBottom: '2px' }}>
              [CH_01: SYSTEM_INTERFACE]
            </div>
            
            {/* Theme select card [THEME] */}
            <div className="te-setting-card" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              background: 'rgba(0,0,0,0.12)', 
              padding: '12px 14px', 
              borderRadius: '4px', 
              border: '1px solid var(--border-glass)',
              position: 'relative',
              height: '106px',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-title)' }}>界面色彩主题</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>全局切换系统颜色主题</span>
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[THEME]</span>
              </div>
              <select
                className="form-select"
                style={{ width: '100%', fontSize: '0.75rem', height: '28px', padding: '4px 28px 4px 8px' }}
                value={settings.theme}
                onChange={(e) => updateSettingValue('theme', e.target.value as any)}
              >
                <option value="dark">深色主题 (DARK)</option>
                <option value="light">浅色主题 (LIGHT)</option>
              </select>
            </div>

            {/* Sound toggle card [AUDIO] */}
            <div className="te-setting-card" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              background: 'rgba(0,0,0,0.12)', 
              padding: '12px 14px', 
              borderRadius: '4px', 
              border: '1px solid var(--border-glass)',
              position: 'relative',
              height: '106px',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-title)' }}>扫码成功音效</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>解析成功时播放提示音</span>
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[AUDIO]</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div 
                  className={`te-switch ${settings.soundEnabled ? 'active' : ''}`}
                  onClick={() => updateSettingValue('soundEnabled', !settings.soundEnabled)}
                >
                  <div className="te-switch-handle" />
                </div>
              </div>
            </div>

            {/* Hotkey input card [HOTKEY] */}
            <div className="te-setting-card" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              background: 'rgba(0,0,0,0.12)', 
              padding: '12px 14px', 
              borderRadius: '4px', 
              border: '1px solid var(--border-glass)',
              position: 'relative',
              height: '106px',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-title)' }}>屏幕扫码快捷键</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>系统全局监听快捷键</span>
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[HOTKEY]</span>
              </div>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '5px 8px', fontSize: '0.75rem', textAlign: 'left', fontFamily: 'var(--font-mono)', margin: 0, height: '28px' }}
                value={settings.shortcutCapture}
                onChange={(e) => updateSettingValue('shortcutCapture', e.target.value)}
                placeholder="Ctrl+Shift+S"
              />
            </div>

          </div>

          {/* Column 2: SCANNER BUS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontWeight: 'bold', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)', borderBottom: '1px dashed var(--border-glass)', paddingBottom: '6px', marginBottom: '2px' }}>
              [CH_02: SCANNER_BUS]
            </div>

            {/* Auto copy card [COPY] */}
            <div className="te-setting-card" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              background: 'rgba(0,0,0,0.12)', 
              padding: '12px 14px', 
              borderRadius: '4px', 
              border: '1px solid var(--border-glass)',
              position: 'relative',
              height: '106px',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-title)' }}>自动复制文本</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>扫码成功后自动复制到剪贴板</span>
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[COPY]</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div 
                  className={`te-switch ${settings.autoCopy ? 'active' : ''}`}
                  onClick={() => updateSettingValue('autoCopy', !settings.autoCopy)}
                >
                  <div className="te-switch-handle" />
                </div>
              </div>
            </div>

            {/* Safe Warning card [WARN] */}
            <div className="te-setting-card" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              background: 'rgba(0,0,0,0.12)', 
              padding: '12px 14px', 
              borderRadius: '4px', 
              border: '1px solid var(--border-glass)',
              position: 'relative',
              height: '106px',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-title)' }}>网址安全警告</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>跳转外部网址前进行二次确认</span>
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[WARN]</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div 
                  className={`te-switch ${settings.confirmBeforeOpenUrl ? 'active' : ''}`}
                  onClick={() => updateSettingValue('confirmBeforeOpenUrl', !settings.confirmBeforeOpenUrl)}
                >
                  <div className="te-switch-handle" />
                </div>
              </div>
            </div>

            {/* Save History card [HIST] */}
            <div className="te-setting-card" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              background: 'rgba(0,0,0,0.12)', 
              padding: '12px 14px', 
              borderRadius: '4px', 
              border: '1px solid var(--border-glass)',
              position: 'relative',
              height: '106px',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-title)' }}>本地历史记录</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>本地数据库保存历史扫码记录</span>
                </div>
                <span style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>[HIST]</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div 
                  className={`te-switch ${settings.saveHistory ? 'active' : ''}`}
                  onClick={() => updateSettingValue('saveHistory', !settings.saveHistory)}
                >
                  <div className="te-switch-handle" />
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>


      {/* Right panel: System Diagnosis */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Connection status Diagnostic card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
          <div className="te-screw tl"></div>
          <div className="te-screw tr"></div>
          <div className="te-screw bl"></div>
          <div className="te-screw br"></div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2, position: 'relative' }}>
            <HardDrive size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>连接诊断 [DIAGNOSTIC_SCREEN]</h3>
          </div>

          {/* Retro CRT Phosphor Screen readout */}
          <div className="te-screen te-screen-pulse" style={{ 
            padding: '12px 14px', 
            background: '#090a0f', 
            border: '1px solid var(--border-metal)', 
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            position: 'relative',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.85)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(0, 255, 255, 0.2)', paddingBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>MODE_TYPE:</span>
              <strong style={{ color: bridgeInfo?.isMock ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                {bridgeInfo?.isMock ? 'MOCK_SHELL_HTML5' : 'NATIVE_IPC_RUST'}
              </strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(0, 255, 255, 0.2)', paddingBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>TARGET_OS:</span>
              <span style={{ color: 'var(--accent-cyan)' }}>{getPlatformDisplay(bridgeInfo?.platform)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(0, 255, 255, 0.2)', paddingBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>CORE_VERS:</span>
              <span style={{ color: 'var(--text-title)' }}>{bridgeInfo?.version || '1.0.0-mock'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>REND_ENGN:</span>
              <span style={{ color: 'var(--text-title)' }}>WEBVIEW2_WEBKIT</span>
            </div>
          </div>

          <div className="alert-box info" style={{ margin: 0, fontSize: '0.65rem', zIndex: 2, position: 'relative', lineHeight: '1.3' }}>
            {bridgeInfo?.isMock ? (
              <span>当前运行于独立浏览器沙盒中，已激活 HTML5 Fallback 层。打包桌面端时，将自动切换至 Rust 真实原生能力。</span>
            ) : (
              <span>已与 Tauri 原生 Rust 进程建立 IPC 通信管道，权限认证通过。</span>
            )}
          </div>
        </div>

        {/* User Privacy Shield card */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
          <div className="te-screw tl"></div>
          <div className="te-screw tr"></div>
          <div className="te-screw bl"></div>
          <div className="te-screw br"></div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', zIndex: 2, position: 'relative' }}>
            <ShieldCheck size={18} />
            <h3 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>本地安全声明 [SECURITY]</h3>
          </div>
          
          <div style={{ 
            fontSize: '0.72rem', 
            color: 'var(--text-muted)', 
            lineHeight: '1.4', 
            margin: 0, 
            zIndex: 2, 
            position: 'relative',
            border: '1px dashed var(--accent-green)',
            borderRadius: '4px',
            padding: '10px',
            background: 'rgba(0, 180, 0, 0.03)'
          }}>
            本软件为纯本地运行工具，摄像头捕获的图像帧、系统截屏数据和解析内容完全在本地解密并储存，<strong>不会上传至任何第三方云端服务器</strong>，完全保证您的数据隐私与信息安全。
          </div>
        </div>

      </div>

    </div>
  );
}
