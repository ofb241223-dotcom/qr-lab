import { useState, useEffect } from 'react';
import { Search, Trash2, Copy, RefreshCw, Scan, QrCode, Globe, Wifi, User, FileText, X, Mail, MessageSquare, Phone, MapPin } from 'lucide-react';
import bridge from '../bridge/desktopBridge';
import type { HistoryItem } from '../bridge/desktopBridge';

interface HistoryViewProps {
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onGeneratePreFill: (content: string, type: 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo') => void;
}

export default function HistoryView({ addToast, onGeneratePreFill }: HistoryViewProps) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'scan' | 'generate'>('all');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  // Load history on mount
  const loadHistory = async () => {
    try {
      const items = await bridge.getHistory();
      setHistoryItems(items);
    } catch (e) {
      console.error('Failed to load history:', e);
      addToast('获取历史记录失败', 'error');
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await bridge.copyToClipboard(text);
      addToast('已复制内容到剪贴板！', 'success');
    } catch (e) {
      addToast('复制失败', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await bridge.deleteHistory(id);
      addToast('已删除该记录', 'success');
      loadHistory();
    } catch (e) {
      addToast('删除记录失败', 'error');
    }
  };

  const handleExportCsv = async () => {
    if (historyItems.length === 0) return;
    try {
      const headers = ['ID', '类型', '格式', '识别内容', '扫描来源', '记录时间'];
      const rows = historyItems.map(item => [
        item.id,
        item.type === 'scan' ? '扫描' : '生成',
        getDataTypeText(item.dataType),
        `"${item.content.replace(/"/g, '""')}"`,
        getSourceText(item.source),
        new Date(item.timestamp).toLocaleString('zh-CN')
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const filename = `qr_history_export_${Date.now()}.csv`;
      
      const res = await bridge.saveFile({
        content: csvContent,
        encoding: 'text',
        filename,
        fileType: 'txt'
      });
      
      if (res.success) {
        addToast(`历史记录已导出！保存至: ${res.path || filename}`, 'success');
      } else {
        addToast(`导出失败: ${res.error}`, 'error');
      }
    } catch (e: any) {
      addToast(`导出 CSV 失败: ${e.message || String(e)}`, 'error');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('您确定要清空全部历史记录吗？此操作不可撤销。')) return;
    try {
      await bridge.clearHistory();
      addToast('历史记录已完全清清空', 'success');
      loadHistory();
    } catch (e) {
      addToast('清空历史记录失败', 'error');
    }
  };

  // Filter lists
  const filteredItems = historyItems.filter((item) => {
    const matchesSearch = item.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getDataTypeIcon = (type: 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo') => {
    switch (type) {
      case 'url': return <Globe size={14} color="var(--accent-cyan)" />;
      case 'wifi': return <Wifi size={14} color="var(--accent-green)" />;
      case 'vcard': return <User size={14} color="var(--accent-orange)" />;
      case 'email': return <Mail size={14} color="var(--accent-cyan)" />;
      case 'sms': return <MessageSquare size={14} color="var(--accent-green)" />;
      case 'phone': return <Phone size={14} color="var(--accent-orange)" />;
      case 'geo': return <MapPin size={14} color="var(--accent-purple)" />;
      default: return <FileText size={14} color="var(--text-muted)" />;
    }
  };

  const getDataTypeText = (type: 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone' | 'geo') => {
    switch (type) {
      case 'url': return '网址';
      case 'wifi': return 'Wi-Fi';
      case 'vcard': return '名片';
      case 'email': return '邮件';
      case 'sms': return '短信';
      case 'phone': return '电话';
      case 'geo': return '位置';
      default: return '文本';
    }
  };

  const getSourceText = (src?: string) => {
    switch (src) {
      case 'camera': return '摄像头';
      case 'screen': return '屏幕截图';
      case 'file': return '本地文件';
      default: return '手动创建';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      
      {/* Search and Filters panel */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
        <div className="te-screw tl"></div>
        <div className="te-screw tr"></div>
        <div className="te-screw bl"></div>
        <div className="te-screw br"></div>
        
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', zIndex: 2 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="搜索历史记录内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category filters */}
        <div className="te-jog-row" style={{ zIndex: 2 }}>
          <button 
            className={`te-jog-btn ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            全部
          </button>
          <button 
            className={`te-jog-btn ${categoryFilter === 'scan' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('scan')}
          >
            扫描
          </button>
          <button 
            className={`te-jog-btn ${categoryFilter === 'generate' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('generate')}
          >
            生成
          </button>
        </div>

        {/* Export Action */}
        <button 
          className="btn btn-secondary" 
          style={{ zIndex: 2 }}
          onClick={handleExportCsv}
          disabled={historyItems.length === 0}
        >
          <Copy size={14} />
          <span>导出记录 [EXPORT]</span>
        </button>

        {/* Clear Actions */}
        <button 
          className="btn btn-secondary" 
          style={{ borderColor: 'rgba(255, 51, 102, 0.25)', color: 'var(--accent-red)', zIndex: 2 }}
          onClick={handleClearAll}
          disabled={historyItems.length === 0}
        >
          <Trash2 size={14} />
          <span>清空历史</span>
        </button>

      </div>

      {/* History table list */}
      <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div className="te-screw tl"></div>
        <div className="te-screw tr"></div>
        <div className="te-screw bl"></div>
        <div className="te-screw br"></div>
        
        {filteredItems.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-muted)', minHeight: '300px' }}>
            <Trash2 size={40} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '0.9rem' }}>暂无历史记录</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>类型</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>格式</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>识别内容</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>扫描来源</th>
                <th style={{ padding: '16px 20px', fontWeight: '600' }}>时间</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => (
                <tr 
                  key={item.id} 
                  style={{ borderBottom: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'background 0.2s' }}
                  className="history-row"
                  onClick={() => setSelectedItem(item)}
                >
                  
                  {/* Category Type */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.type === 'scan' ? (
                        <Scan size={14} color="var(--accent-cyan)" />
                      ) : (
                        <QrCode size={14} color="var(--accent-purple)" />
                      )}
                      <span style={{ fontWeight: '500' }}>{item.type === 'scan' ? '扫描' : '生成'}</span>
                    </div>
                  </td>

                  {/* Schema format */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {getDataTypeIcon(item.dataType)}
                      <span>{getDataTypeText(item.dataType)}</span>
                    </div>
                  </td>

                  {/* Content Preview */}
                  <td style={{ padding: '14px 20px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.content}
                  </td>

                  {/* Source device tag */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      padding: '3px 8px', 
                      borderRadius: '4px',
                      color: 'var(--text-muted)'
                    }}>
                      {getSourceText(item.source)}
                    </span>
                  </td>

                  {/* Datetime local */}
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                    {formatDate(item.timestamp)}
                  </td>

                  {/* Operations actions */}
                  <td style={{ padding: '14px 20px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="复制" onClick={() => handleCopy(item.content)}>
                        <Copy size={13} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} title="生成同款" onClick={() => onGeneratePreFill(item.content, item.dataType)}>
                        <RefreshCw size={13} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', color: 'var(--accent-red)', borderColor: 'rgba(255, 51, 102, 0.15)' }} title="删除" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        )}

      </div>

      {/* Details viewing Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '480px', position: 'relative' }}>
            <div className="te-screw tl"></div>
            <div className="te-screw tr"></div>
            <div className="te-screw bl"></div>
            <div className="te-screw br"></div>
            
            <div className="modal-header" style={{ zIndex: 2 }}>
              <h3>记录详情 [LOG_READOUT]</h3>
              <button className="modal-close-btn" onClick={() => setSelectedItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem', zIndex: 2, position: 'relative' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>操作类型:</span>
                <strong>{selectedItem.type === 'scan' ? '扫描二维码' : '生成二维码'}</strong>
                
                <span style={{ color: 'var(--text-muted)' }}>数据格式:</span>
                <span>{getDataTypeText(selectedItem.dataType)}</span>
                
                <span style={{ color: 'var(--text-muted)' }}>识别来源:</span>
                <span>{getSourceText(selectedItem.source)}</span>
                
                <span style={{ color: 'var(--text-muted)' }}>记录时间:</span>
                <span>{new Date(selectedItem.timestamp).toLocaleString()}</span>
              </div>

              <div style={{ height: '1px', background: 'var(--border-glass)' }} />

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>文本内容 [DATA]:</span>
                <div 
                  className="te-screen te-screen-pulse"
                  style={{ 
                    padding: '12px', 
                    border: '2px solid #000',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    wordBreak: 'break-all',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    color: 'var(--accent-orange)',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  <div style={{ position: 'relative', zIndex: 12 }}>
                    {selectedItem.content}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button className="btn btn-secondary" onClick={() => handleCopy(selectedItem.content)}>
                  <Copy size={14} />
                  <span>复制内容</span>
                </button>
                <button className="btn btn-primary" onClick={() => {
                  onGeneratePreFill(selectedItem.content, selectedItem.dataType);
                  setSelectedItem(null);
                }}>
                  <RefreshCw size={14} />
                  <span>载入生成</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
