import React from 'react';

interface ToolHeaderProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const ToolHeader: React.FC<ToolHeaderProps> = ({ isCollapsed, onToggle }) => {
  return (
    <div className="stage-tool-header">
      <span className="stage-tool-title">画笔工具</span>
      <button 
        className="stage-tool-toggle"
        onClick={onToggle}
        title={isCollapsed ? '展开' : '收起'}
      >
        {isCollapsed ? '▼' : '▲'}
      </button>
    </div>
  );
};

export default ToolHeader;
