import React from 'react';

interface ColorDisplayProps {
  color: string;
}

const ColorDisplay: React.FC<ColorDisplayProps> = ({ color }) => {
  return (
    <div className="color-display-wrapper">
      <div
        className="color-display"
        style={{ backgroundColor: color }}
        title="当前颜色"
      />
      <span className="color-value">{color}</span>
    </div>
  );
};

export default ColorDisplay;
