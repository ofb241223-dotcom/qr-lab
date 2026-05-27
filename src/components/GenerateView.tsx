import React, { useState, useEffect, useRef } from 'react';
import { Type, Link, Wifi, User, Download, FileJson, Palette, Eye, LayoutGrid, Image, Mail, MessageSquare, Phone, MapPin } from 'lucide-react';
import bridge from '../bridge/desktopBridge';
import type { AppSettings } from '../bridge/desktopBridge';
import { drawQRCanvas, generateQRSvg } from '../utils/qrDrawingUtil';
import type { QRDrawingOptions } from '../utils/qrDrawingUtil';

interface GenerateViewProps {
  settings: AppSettings;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  preFillContent: string | null;
  preFillType: 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo' | null;
  clearPreFill: () => void;
}

interface BatchQRCardProps {
  content: string;
  index: number;
  options: QRDrawingOptions;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

function BatchQRCard({ content, index, options, addToast }: BatchQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawQRCanvas(canvas, content, options).catch((err) => {
      console.error('Failed to draw batch item canvas:', err);
    });
  }, [content, options]);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const filename = `qrcode_batch_${index + 1}.png`;
      const res = await bridge.saveFile({
        content: dataUrl,
        encoding: 'dataUrl',
        filename,
        fileType: 'png',
      });
      if (res.success) {
        addToast(`已下载: ${res.path || filename}`, 'success');
      }
    } catch (e: any) {
      addToast(`下载失败: ${e.message}`, 'error');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative' }}>
      <div className="te-screw tl" style={{ width: '4px', height: '4px', border: '1px solid var(--border-glass)' }}></div>
      <div className="te-screw tr" style={{ width: '4px', height: '4px', border: '1px solid var(--border-glass)' }}></div>
      <div className="te-screw bl" style={{ width: '4px', height: '4px', border: '1px solid var(--border-glass)' }}></div>
      <div className="te-screw br" style={{ width: '4px', height: '4px', border: '1px solid var(--border-glass)' }}></div>
      
      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ITEM #{String(index + 1).padStart(2, '0')}</span>
      
      <div style={{ width: '100px', height: '100px', background: options.background || '#fff', padding: '4px', borderRadius: '2px', border: '1px solid var(--border-glass)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      
      <span 
        style={{ 
          fontSize: '0.6rem', 
          color: 'var(--text-title)', 
          maxWidth: '100px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap', 
          fontFamily: 'var(--font-mono)',
          textAlign: 'center'
        }}
        title={content}
      >
        {content}
      </span>
      
      <button className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '0.6rem', width: '100%', minHeight: 'auto', height: '24px' }} onClick={handleDownload}>
        下载 PNG
      </button>
    </div>
  );
}

export default function GenerateView({
  settings,
  addToast,
  preFillContent,
  preFillType,
  clearPreFill,
}: GenerateViewProps) {
  // Input tabs
  const [activeTab, setActiveTab] = useState<'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo'>('text');

  // Generation Mode and Batch Input States
  const [genMode, setGenMode] = useState<'single' | 'batch'>('single');
  const [batchInput, setBatchInput] = useState<string>('');

  // Schema state inputs
  const [textContent, setTextContent] = useState<string>('');
  const [urlContent, setUrlContent] = useState<string>('https://');
  
  // Wifi schema
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [wifiSecurity, setWifiSecurity] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  
  // vCard schema
  const [vcardName, setVcardName] = useState<string>('');
  const [vcardPhone, setVcardPhone] = useState<string>('');
  const [vcardEmail, setVcardEmail] = useState<string>('');
  const [vcardNote, setVcardNote] = useState<string>('');

  // Email schema
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');

  // SMS schema
  const [smsPhone, setSmsPhone] = useState<string>('');
  const [smsMessage, setSmsMessage] = useState<string>('');

  // Phone schema
  const [phoneNum, setPhoneNum] = useState<string>('');

  // Geolocation schema
  const [geoLat, setGeoLat] = useState<string>('');
  const [geoLng, setGeoLng] = useState<string>('');

  // Customizer styling options
  const [colorMode, setColorMode] = useState<'solid' | 'gradient'>('solid');
  const [solidColor, setSolidColor] = useState<string>('#8a2be2');
  const [gradColor1, setGradColor1] = useState<string>('#8a2be2');
  const [gradColor2, setGradColor2] = useState<string>('#00ffff');
  const [gradType, setGradType] = useState<'linear' | 'radial'>('linear');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  
  const [dotStyle, setDotStyle] = useState<'square' | 'dot' | 'rounded'>('square');
  const [eyeStyle, setEyeStyle] = useState<'square' | 'dot' | 'rounded'>('square');
  
  // Logo overlays
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [logoSizeRatio, setLogoSizeRatio] = useState<number>(0.2);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-fill handling (navigated from Scan result page)
  useEffect(() => {
    if (preFillContent && preFillType) {
      setActiveTab(preFillType as any);
      if (preFillType === 'text') setTextContent(preFillContent);
      else if (preFillType === 'url') setUrlContent(preFillContent);
      else if (preFillType === 'wifi') {
        const matchS = preFillContent.match(/S:([^;]+);/);
        const matchT = preFillContent.match(/T:([^;]+);/);
        const matchP = preFillContent.match(/P:([^;]+);/);
        if (matchS) setWifiSsid(matchS[1]);
        if (matchT) setWifiSecurity(matchT[1] as any);
        if (matchP) setWifiPassword(matchP[1]);
      } else if (preFillType === 'vcard') {
        const matchFN = preFillContent.match(/FN:([^\r\n]+)/);
        const matchTEL = preFillContent.match(/TEL;?[^:]*:([^\r\n]+)/);
        const matchEMAIL = preFillContent.match(/EMAIL;?[^:]*:([^\r\n]+)/);
        const matchNOTE = preFillContent.match(/NOTE:([^\r\n]+)/);
        if (matchFN) setVcardName(matchFN[1]);
        if (matchTEL) setVcardPhone(matchTEL[1]);
        if (matchEMAIL) setVcardEmail(matchEMAIL[1]);
        if (matchNOTE) setVcardNote(matchNOTE[1]);
      } else if (preFillType === 'email') {
        // Parse email mailto:recipient?subject=...&body=...
        const mailtoMatch = preFillContent.match(/^mailto:([^?]+)/i);
        if (mailtoMatch) setEmailTo(mailtoMatch[1]);
        const subMatch = preFillContent.match(/[?&]subject=([^&]+)/i);
        if (subMatch) setEmailSubject(decodeURIComponent(subMatch[1]));
        const bodyMatch = preFillContent.match(/[?&]body=([^&]+)/i);
        if (bodyMatch) setEmailBody(decodeURIComponent(bodyMatch[1]));
      } else if (preFillType === 'sms') {
        if (preFillContent.toLowerCase().startsWith('smsto:')) {
          const smsMatch = preFillContent.match(/^SMSTO:([^:]+):(.*)$/i);
          if (smsMatch) {
            setSmsPhone(smsMatch[1]);
            setSmsMessage(smsMatch[2]);
          }
        } else {
          const matchPhone = preFillContent.match(/^sms:([^?]+)/i);
          if (matchPhone) setSmsPhone(matchPhone[1]);
          const matchBody = preFillContent.match(/[?&]body=([^&]+)/i);
          if (matchBody) setSmsMessage(decodeURIComponent(matchBody[1]));
        }
      } else if (preFillType === 'phone') {
        const telMatch = preFillContent.match(/^tel:(.*)$/i);
        if (telMatch) setPhoneNum(telMatch[1]);
      } else if (preFillType === 'geo') {
        const geoMatch = preFillContent.match(/^geo:([^,;?]+),([^,;?]+)/i);
        if (geoMatch) {
          setGeoLat(geoMatch[1]);
          setGeoLng(geoMatch[2]);
        }
      }
      clearPreFill();
      addToast('内容已自动载入生成器', 'info');
    }
  }, [preFillContent, preFillType]);

  // Compute final QR content string depending on active Tab schema
  const getQrContent = (): string => {
    switch (activeTab) {
      case 'url':
        return urlContent.trim() || 'https://';
      case 'wifi':
        const escape = (val: string) => val.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/:/g, '\\:').replace(/,/g, '\\,');
        return `WIFI:S:${escape(wifiSsid)};T:${wifiSecurity};P:${escape(wifiPassword)};;`;
      case 'vcard':
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${vcardName.trim()}`,
          vcardPhone.trim() ? `TEL;TYPE=CELL:${vcardPhone.trim()}` : '',
          vcardEmail.trim() ? `EMAIL:${vcardEmail.trim()}` : '',
          vcardNote.trim() ? `NOTE:${vcardNote.trim()}` : '',
          'END:VCARD'
        ].filter(Boolean).join('\n');
      case 'email':
        return `mailto:${emailTo.trim()}?subject=${encodeURIComponent(emailSubject.trim())}&body=${encodeURIComponent(emailBody.trim())}`;
      case 'sms':
        return `SMSTO:${smsPhone.trim()}:${smsMessage.trim()}`;
      case 'phone':
        return `tel:${phoneNum.trim()}`;
      case 'geo':
        return `geo:${geoLat.trim()},${geoLng.trim()}`;
      default:
        return textContent || 'QR Scanner Desktop';
    }
  };

  // Compile final Foreground styling string
  const getForegroundOption = (): string => {
    if (colorMode === 'solid') {
      return solidColor;
    }
    return `gradient:${gradType}:${gradColor1}:${gradColor2}`;
  };

  // Real-time rendering effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const qrContent = getQrContent();
    const options: QRDrawingOptions = {
      width: 400,
      margin: 4,
      errorCorrectionLevel: logoDataUrl ? 'Q' : 'M',
      foreground: getForegroundOption(),
      background: bgColor,
      dotStyle,
      eyeStyle,
      logoDataUrl: logoDataUrl || undefined,
      logoSizeRatio,
    };

    drawQRCanvas(canvas, qrContent, options).catch((err) => {
      console.error('Failed to draw canvas:', err);
    });
  }, [
    activeTab,
    textContent,
    urlContent,
    wifiSsid,
    wifiPassword,
    wifiSecurity,
    vcardName,
    vcardPhone,
    vcardEmail,
    vcardNote,
    emailTo,
    emailSubject,
    emailBody,
    smsPhone,
    smsMessage,
    phoneNum,
    geoLat,
    geoLng,
    colorMode,
    solidColor,
    gradColor1,
    gradColor2,
    gradType,
    bgColor,
    dotStyle,
    eyeStyle,
    logoDataUrl,
    logoSizeRatio,
  ]);

  // Log and save generation history
  const logGenerateHistory = async () => {
    if (!settings.saveHistory) return;
    const content = getQrContent();
    try {
      await bridge.addHistory({
        type: 'generate',
        dataType: activeTab,
        content,
        source: 'manual',
      });
    } catch (e) {
      console.error('Failed to log generate history:', e);
    }
  };

  const batchItems = batchInput.split('\n').map(l => l.trim()).filter(Boolean);

  // Batch Export as PNGs
  const handleDownloadAll = async () => {
    if (batchItems.length === 0) {
      addToast('请先输入要生成的批量内容！', 'error');
      return;
    }
    addToast(`正在批量导出 ${batchItems.length} 个二维码...`, 'info');

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 400;
    offscreenCanvas.height = 400;

    const options: QRDrawingOptions = {
      width: 400,
      margin: 4,
      errorCorrectionLevel: logoDataUrl ? 'Q' : 'M',
      foreground: getForegroundOption(),
      background: bgColor,
      dotStyle,
      eyeStyle,
      logoDataUrl: logoDataUrl || undefined,
      logoSizeRatio,
    };

    let successCount = 0;
    for (let i = 0; i < batchItems.length; i++) {
      const content = batchItems[i];
      try {
        await drawQRCanvas(offscreenCanvas, content, options);
        const dataUrl = offscreenCanvas.toDataURL('image/png');
        const filename = `qrcode_batch_${i + 1}.png`;

        if (settings.saveHistory) {
          try {
            await bridge.addHistory({
              type: 'generate',
              dataType: 'text',
              content,
              source: 'manual',
            });
          } catch (e) {
            console.error('Failed to log history item:', e);
          }
        }

        const res = await bridge.saveFile({
          content: dataUrl,
          encoding: 'dataUrl',
          filename,
          fileType: 'png',
        });
        if (res.success) {
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to generate batch item ${i + 1}:`, err);
      }
    }
    
    addToast(`批量保存完成：成功 ${successCount}/${batchItems.length}`, 'success');
  };

  // Export as PNG
  const handleExportPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const filename = `qrcode_${Date.now()}.png`;

      await logGenerateHistory();
      const res = await bridge.saveFile({
        content: dataUrl,
        encoding: 'dataUrl',
        filename,
        fileType: 'png',
      });

      if (res.success) {
        addToast(`PNG 导出成功！保存至: ${res.path || filename}`, 'success');
      } else {
        addToast(`保存 PNG 失败: ${res.error}`, 'error');
      }
    } catch (err: any) {
      addToast(`导出失败: ${err.message || String(err)}`, 'error');
    }
  };

  // Export as SVG
  const handleExportSvg = async () => {
    try {
      const qrContent = getQrContent();
      const options: QRDrawingOptions = {
        width: 400,
        margin: 4,
        errorCorrectionLevel: logoDataUrl ? 'Q' : 'M',
        foreground: getForegroundOption(),
        background: bgColor,
        dotStyle,
        eyeStyle,
        logoDataUrl: logoDataUrl || undefined,
        logoSizeRatio,
      };

      const svgText = await generateQRSvg(qrContent, options);
      const filename = `qrcode_${Date.now()}.svg`;

      await logGenerateHistory();
      const res = await bridge.saveFile({
        content: svgText,
        encoding: 'text',
        filename,
        fileType: 'svg',
      });

      if (res.success) {
        addToast(`SVG 导出成功！保存至: ${res.path || filename}`, 'success');
      } else {
        addToast(`保存 SVG 失败: ${res.error}`, 'error');
      }
    } catch (err: any) {
      addToast(`导出 SVG 失败: ${err.message || String(err)}`, 'error');
    }
  };

  // Logo Upload Ingest
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('请选择有效的图片文件！', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoDataUrl(event.target?.result as string);
      addToast('Logo 已成功载入', 'success');
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoDataUrl('');
    addToast('Logo 已清除', 'info');
  };

  const handleSelectLogo = () => {
    document.getElementById('logo-file-picker')?.click();
  };

  return (
    <div className="view-container">
      
      {/* Left panel: Customizer controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* Generate Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-deep)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border-glass)', zIndex: 2 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>生成模式 [GEN_MODE]</span>
          <div className="te-jog-row" style={{ margin: 0, padding: '2px', width: '220px' }}>
            <button 
              className={`te-jog-btn ${genMode === 'single' ? 'active' : ''}`}
              onClick={() => setGenMode('single')}
              style={{ flex: 1, padding: '4px 0', fontSize: '0.7rem' }}
            >
              单条生成 [SINGLE]
            </button>
            <button 
              className={`te-jog-btn ${genMode === 'batch' ? 'active' : ''}`}
              onClick={() => setGenMode('batch')}
              style={{ flex: 1, padding: '4px 0', fontSize: '0.7rem' }}
            >
              批量生成 [BATCH]
            </button>
          </div>
        </div>

        {genMode === 'single' ? (
          <>
            {/* Tab Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="te-jog-row" style={{ padding: '2px' }}>
                <button className={`te-jog-btn ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>
                  <Type size={13} />
                  <span>文本 [TEXT]</span>
                </button>
                <button className={`te-jog-btn ${activeTab === 'url' ? 'active' : ''}`} onClick={() => setActiveTab('url')}>
                  <Link size={13} />
                  <span>网址 [LINK]</span>
                </button>
                <button className={`te-jog-btn ${activeTab === 'wifi' ? 'active' : ''}`} onClick={() => setActiveTab('wifi')}>
                  <Wifi size={13} />
                  <span>Wi-Fi [NET]</span>
                </button>
                <button className={`te-jog-btn ${activeTab === 'vcard' ? 'active' : ''}`} onClick={() => setActiveTab('vcard')}>
                  <User size={13} />
                  <span>名片 [CARD]</span>
                </button>
              </div>
              <div className="te-jog-row" style={{ padding: '2px' }}>
                <button className={`te-jog-btn ${activeTab === 'email' ? 'active' : ''}`} onClick={() => setActiveTab('email')}>
                  <Mail size={13} />
                  <span>邮件 [MAIL]</span>
                </button>
                <button className={`te-jog-btn ${activeTab === 'sms' ? 'active' : ''}`} onClick={() => setActiveTab('sms')}>
                  <MessageSquare size={13} />
                  <span>短信 [SMS]</span>
                </button>
                <button className={`te-jog-btn ${activeTab === 'phone' ? 'active' : ''}`} onClick={() => setActiveTab('phone')}>
                  <Phone size={13} />
                  <span>电话 [CALL]</span>
                </button>
                <button className={`te-jog-btn ${activeTab === 'geo' ? 'active' : ''}`} onClick={() => setActiveTab('geo')}>
                  <MapPin size={13} />
                  <span>位置 [GEO]</span>
                </button>
              </div>
            </div>

            {/* Content Form Inputs */}
            <div className="glass-panel" style={{ padding: '20px', position: 'relative' }}>
              <div className="te-screw tl"></div>
              <div className="te-screw tr"></div>
              <div className="te-screw bl"></div>
              <div className="te-screw br"></div>
              
              <h2 style={{ fontSize: '0.9rem', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 2, position: 'relative' }}>输入二维码内容 [PAYLOAD]</h2>
              
              {activeTab === 'text' && (
                <div className="form-group" style={{ margin: 0, zIndex: 2, position: 'relative' }}>
                  <label className="form-label">输入文本内容</label>
                  <textarea
                    className="form-input"
                    style={{ height: '110px', resize: 'none' }}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="请输入需要转换为二维码的文本内容..."
                  />
                </div>
              )}

              {activeTab === 'url' && (
                <div className="form-group" style={{ margin: 0, zIndex: 2, position: 'relative' }}>
                  <label className="form-label">输入网址链接</label>
                  <input
                    type="url"
                    className="form-input"
                    value={urlContent}
                    onChange={(e) => setUrlContent(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              )}

              {activeTab === 'wifi' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 2, position: 'relative' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">网络名称 (SSID)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="Wi-Fi SSID"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">访问密码</label>
                      <input
                        type="password"
                        className="form-input"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="WPA/WEP Password"
                        disabled={wifiSecurity === 'nopass'}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">安全类型</label>
                      <select
                        className="form-select"
                        value={wifiSecurity}
                        onChange={(e) => setWifiSecurity(e.target.value as any)}
                      >
                        <option value="WPA">WPA/WPA2</option>
                        <option value="WEP">WEP</option>
                        <option value="nopass">无加密 (Open)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'vcard' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', zIndex: 2, position: 'relative' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">姓名</label>
                    <input
                      type="text"
                      className="form-input"
                      value={vcardName}
                      onChange={(e) => setVcardName(e.target.value)}
                      placeholder="FN 姓名"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">移动电话</label>
                    <input
                      type="text"
                      className="form-input"
                      value={vcardPhone}
                      onChange={(e) => setVcardPhone(e.target.value)}
                      placeholder="TEL 电话"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                    <label className="form-label">电子邮箱</label>
                    <input
                      type="email"
                      className="form-input"
                      value={vcardEmail}
                      onChange={(e) => setVcardEmail(e.target.value)}
                      placeholder="EMAIL 地址"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                    <label className="form-label">额外备注</label>
                    <input
                      type="text"
                      className="form-input"
                      value={vcardNote}
                      onChange={(e) => setVcardNote(e.target.value)}
                      placeholder="NOTE 简要备注"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'email' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', zIndex: 2, position: 'relative' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">收件人邮箱</label>
                    <input
                      type="email"
                      className="form-input"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="recipient@example.com"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">邮件主题</label>
                    <input
                      type="text"
                      className="form-input"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject 主题"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                    <label className="form-label">邮件正文内容</label>
                    <textarea
                      className="form-input"
                      style={{ height: '70px', resize: 'none' }}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Email body 正文内容..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'sms' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 2, position: 'relative' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">接收人手机号码</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      placeholder="+8613800000000"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">短信正文</label>
                    <textarea
                      className="form-input"
                      style={{ height: '65px', resize: 'none' }}
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="SMS Text 短信内容..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'phone' && (
                <div className="form-group" style={{ margin: 0, zIndex: 2, position: 'relative' }}>
                  <label className="form-label">电话号码</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    placeholder="+8610086"
                  />
                </div>
              )}

              {activeTab === 'geo' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', zIndex: 2, position: 'relative' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">地理纬度 (Latitude)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={geoLat}
                      onChange={(e) => setGeoLat(e.target.value)}
                      placeholder="例如: 39.9042"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">地理经度 (Longitude)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={geoLng}
                      onChange={(e) => setGeoLng(e.target.value)}
                      placeholder="例如: 116.4074"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Batch Input Form */}
            <div className="glass-panel" style={{ padding: '20px', position: 'relative' }}>
              <div className="te-screw tl"></div>
              <div className="te-screw tr"></div>
              <div className="te-screw bl"></div>
              <div className="te-screw br"></div>
              
              <h2 style={{ fontSize: '0.9rem', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 2, position: 'relative' }}>
                批量输入二维码内容 [BATCH_PAYLOAD]
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 2, position: 'relative' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>输入批量文本 (每行生成一个二维码)</label>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '2px 8px', fontSize: '0.65rem', height: '22px', minHeight: 'auto', border: '1px solid var(--border-glass)' }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.txt,text/plain';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            setBatchInput(evt.target?.result as string);
                            addToast('文本文件导入成功', 'success');
                          };
                          reader.readAsText(file);
                        };
                        input.click();
                      }}
                    >
                      导入文本文件
                    </button>
                  </div>
                  <textarea
                    className="form-input"
                    style={{ height: '120px', resize: 'none', fontFamily: 'var(--font-mono)' }}
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    placeholder="第一行内容&#13;第二行内容&#13;第三行内容..."
                  />
                </div>
              </div>
            </div>

            {/* Batch QR Grid Display */}
            {batchItems.length > 0 && (
              <div className="glass-panel" style={{ padding: '20px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="te-screw tl"></div>
                <div className="te-screw tr"></div>
                <div className="te-screw bl"></div>
                <div className="te-screw br"></div>
                
                <h2 style={{ fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 2 }}>
                  实时二维码网格 [BATCH_PREVIEW_GRID]
                </h2>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                  gap: '12px', 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  paddingRight: '4px',
                  zIndex: 2 
                }}>
                  {batchItems.map((item, idx) => (
                    <BatchQRCard
                      key={idx}
                      content={item}
                      index={idx}
                      options={{
                        width: 200,
                        margin: 4,
                        errorCorrectionLevel: logoDataUrl ? 'Q' : 'M',
                        foreground: getForegroundOption(),
                        background: bgColor,
                        dotStyle,
                        eyeStyle,
                        logoDataUrl: logoDataUrl || undefined,
                        logoSizeRatio,
                      }}
                      addToast={addToast}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 2-Column Settings Deck */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px' }}>
          
          {/* Column 1: Color Engine Module */}
          <div className="glass-panel" style={{ padding: '20px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div className="te-screw tl"></div>
            <div className="te-screw tr"></div>
            <div className="te-screw bl"></div>
            <div className="te-screw br"></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', zIndex: 2, position: 'relative' }}>
              <Palette size={16} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>色彩设定 [COLORS_ENGINE]</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 2, position: 'relative', flex: 1, justifyContent: 'space-between' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>前景色模式 [FOREGROUND_MODE]</label>
                <div className="te-jog-row" style={{ padding: '2px' }}>
                  <button 
                    className={`te-jog-btn ${colorMode === 'solid' ? 'active' : ''}`}
                    onClick={() => setColorMode('solid')}
                    style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem' }}
                  >
                    单色 [SOLID]
                  </button>
                  <button 
                    className={`te-jog-btn ${colorMode === 'gradient' ? 'active' : ''}`}
                    onClick={() => setColorMode('gradient')}
                    style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem' }}
                  >
                    渐变 [GRAD]
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>通道色彩通道设定 [COLOR_CHANNELS]</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '10px', 
                  background: 'var(--bg-deep)', 
                  padding: '12px 6px', 
                  borderRadius: '4px', 
                  border: '1px solid var(--border-glass)',
                  alignItems: 'center'
                }}>
                  {/* Channel 1 / Solid Foreground */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {colorMode === 'solid' ? '前景 [FG]' : '渐变 1'}
                    </span>
                    <div className="color-picker-wrapper">
                      <div className="color-picker-preview" style={{ backgroundColor: colorMode === 'solid' ? solidColor : gradColor1 }} />
                      <input
                        type="color"
                        className="color-picker-input"
                        value={colorMode === 'solid' ? solidColor : gradColor1}
                        onChange={(e) => colorMode === 'solid' ? setSolidColor(e.target.value) : setGradColor1(e.target.value)}
                      />
                    </div>
                    <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-title)' }}>
                      {(colorMode === 'solid' ? solidColor : gradColor1).toUpperCase()}
                    </span>
                  </div>

                  {/* Channel 2: Gradient Foreground */}
                  {colorMode === 'gradient' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>渐变 2</span>
                      <div className="color-picker-wrapper">
                        <div className="color-picker-preview" style={{ backgroundColor: gradColor2 }} />
                        <input
                          type="color"
                          className="color-picker-input"
                          value={gradColor2}
                          onChange={(e) => setGradColor2(e.target.value)}
                        />
                      </div>
                      <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-title)' }}>
                        {gradColor2.toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.3 }}>N/A</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px dashed var(--border-glass)', opacity: 0.2 }} />
                      <span style={{ fontSize: '0.6rem', opacity: 0.3 }}>--</span>
                    </div>
                  )}

                  {/* Channel 3: Background */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>背景 [BG]</span>
                    <div className="color-picker-wrapper">
                      <div className="color-picker-preview" style={{ backgroundColor: bgColor }} />
                      <input
                        type="color"
                        className="color-picker-input"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                      />
                    </div>
                    <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-title)' }}>
                      {bgColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {colorMode === 'gradient' ? (
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>渐变方向设定 [GRAD_DIRECTION]</label>
                  <select
                    className="form-select"
                    value={gradType}
                    onChange={(e) => setGradType(e.target.value as any)}
                    style={{ fontSize: '0.75rem', height: '32px' }}
                  >
                    <option value="linear">线性渐变 (LINEAR)</option>
                    <option value="radial">径向渐变 (RADIAL)</option>
                  </select>
                </div>
              ) : (
                <div style={{ height: '51px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-glass)', borderRadius: '4px', opacity: 0.5 }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>GRAD_ENGINE_STANDBY</span>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Shapes & Logo stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Shapes Matrix */}
            <div className="glass-panel" style={{ padding: '16px 20px', position: 'relative' }}>
              <div className="te-screw tl"></div>
              <div className="te-screw tr"></div>
              <div className="te-screw bl"></div>
              <div className="te-screw br"></div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 2, position: 'relative' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <LayoutGrid size={13} color="var(--accent-orange)" />
                    <span className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>码点形状 [DOTS_MATRIX]</span>
                  </div>
                  <div className="te-jog-row" style={{ padding: '2px' }}>
                    <button 
                      className={`te-jog-btn ${dotStyle === 'square' ? 'active' : ''}`} 
                      onClick={() => setDotStyle('square')}
                      style={{ flex: 1, padding: '5px 0', fontSize: '0.75rem' }}
                    >
                      方形
                    </button>
                    <button 
                      className={`te-jog-btn ${dotStyle === 'dot' ? 'active' : ''}`} 
                      onClick={() => setDotStyle('dot')}
                      style={{ flex: 1, padding: '5px 0', fontSize: '0.75rem' }}
                    >
                      圆点
                    </button>
                    <button 
                      className={`te-jog-btn ${dotStyle === 'rounded' ? 'active' : ''}`} 
                      onClick={() => setDotStyle('rounded')}
                      style={{ flex: 1, padding: '5px 0', fontSize: '0.75rem' }}
                    >
                      圆角
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Eye size={13} color="var(--accent-orange)" />
                    <span className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>角眼形状 [EYES_BORDER]</span>
                  </div>
                  <div className="te-jog-row" style={{ padding: '2px' }}>
                    <button 
                      className={`te-jog-btn ${eyeStyle === 'square' ? 'active' : ''}`} 
                      onClick={() => setEyeStyle('square')}
                      style={{ flex: 1, padding: '5px 0', fontSize: '0.75rem' }}
                    >
                      直角
                    </button>
                    <button 
                      className={`te-jog-btn ${eyeStyle === 'dot' ? 'active' : ''}`} 
                      onClick={() => setEyeStyle('dot')}
                      style={{ flex: 1, padding: '5px 0', fontSize: '0.75rem' }}
                    >
                      圆环
                    </button>
                    <button 
                      className={`te-jog-btn ${eyeStyle === 'rounded' ? 'active' : ''}`} 
                      onClick={() => setEyeStyle('rounded')}
                      style={{ flex: 1, padding: '5px 0', fontSize: '0.75rem' }}
                    >
                      圆角
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Injector */}
            <div className="glass-panel" style={{ padding: '16px 20px', position: 'relative' }}>
              <div className="te-screw tl"></div>
              <div className="te-screw tr"></div>
              <div className="te-screw bl"></div>
              <div className="te-screw br"></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', zIndex: 2, position: 'relative' }}>
                <Image size={15} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>中心水印 [LOGO_INJECTOR]</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 2, position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={handleSelectLogo} style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', height: '30px' }}>
                    选择 LOGO 水印
                  </button>
                  {logoDataUrl && (
                    <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem', height: '30px' }} onClick={clearLogo}>
                      清除
                    </button>
                  )}
                </div>
                <input
                  id="logo-file-picker"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload}
                />
                
                {logoDataUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', background: 'var(--bg-deep)', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={logoDataUrl}
                        style={{ width: '28px', height: '28px', borderRadius: '2px', border: '1px solid var(--border-glass)', objectFit: 'contain', background: '#fff' }}
                        alt="Logo preview"
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-title)', lineHeight: '1.2' }}>已加载水印文件</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>STATUS: MOUNTED</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        <span>尺寸比例 [SCALE]</span>
                        <span style={{ color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>{Math.round(logoSizeRatio * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.3"
                        step="0.01"
                        style={{ width: '100%', margin: '4px 0' }}
                        value={logoSizeRatio}
                        onChange={(e) => setLogoSizeRatio(parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '48px', border: '1px dashed var(--border-glass)', borderRadius: '4px', background: 'rgba(0,0,0,0.1)' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>NO_LOGO_MOUNTED [0.0V]</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Right panel: Realtime visual preview & Export operations */}
      <div className="glass-panel" style={{ width: '320px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', flexShrink: 0, justifyContent: 'center', position: 'relative' }}>
        <div className="te-screw tl"></div>
        <div className="te-screw tr"></div>
        <div className="te-screw bl"></div>
        <div className="te-screw br"></div>
        
        {genMode === 'single' ? (
          <>
            <h2 style={{ fontSize: '0.9rem', margin: 0, alignSelf: 'flex-start', textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 2 }}>预览生成效果 [PREVIEW]</h2>
            
            {/* Dynamic preview canvas container */}
            <div className="qr-preview-wrapper" style={{ backgroundColor: bgColor, zIndex: 2 }}>
              <canvas 
                ref={canvasRef} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              />
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 2 }}>
              
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleExportPng}>
                <Download size={14} />
                <span>保存为 PNG 图片</span>
              </button>
              
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleExportSvg}>
                <FileJson size={14} />
                <span>保存为 SVG 矢量图</span>
              </button>

            </div>

            <div className="alert-box info" style={{ margin: 0, fontSize: '0.7rem', width: '100%', zIndex: 2 }}>
              提示: 自定义水印可能轻微降低识别速度，已自动提高纠错容错等级确保扫码可用性。
            </div>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: '0.9rem', margin: 0, alignSelf: 'flex-start', textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 2 }}>批量控制面板 [BATCH_CONSOLE]</h2>
            
            {/* Batch status console screen */}
            <div className="te-screen te-screen-pulse" style={{ width: '100%', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '2px solid #000', zIndex: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-orange)' }}>
                <div>STATUS: BATCH_READY</div>
                <div>TOTAL_QUEUED: {batchItems.length} ITEMS</div>
                <div>COLOR_MODE: {colorMode.toUpperCase()}</div>
                <div>DOTS_STYLE: {dotStyle.toUpperCase()}</div>
                <div>WATERMARK: {logoDataUrl ? 'MOUNTED_ACTIVE' : 'STANDBY_EMPTY'}</div>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 2 }}>
              
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDownloadAll} disabled={batchItems.length === 0}>
                <Download size={14} />
                <span>下载全部 PNG 图片 [DL_ALL]</span>
              </button>

            </div>

            <div className="alert-box info" style={{ margin: 0, fontSize: '0.7rem', width: '100%', zIndex: 2 }}>
              注意: 批量下载将在循环中自动触发多个下载，如遇提示请点击允许此网站下载多个文件。
            </div>
          </>
        )}

      </div>

    </div>
  );
}
