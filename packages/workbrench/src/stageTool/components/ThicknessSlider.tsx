import React from 'react';

interface ThicknessSliderProps {
  value: number;
  onChange: (thickness: number) => void;
}

const ThicknessSlider: React.FC<ThicknessSliderProps> = ({ value, onChange }) => {
  return (
    <div className="thickness-slider">
      <input
        type="range"
        min="1"
        max="50"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider"
      />
      <span className="slider-value">{value}px</span>
    </div>
  );
};

export default ThicknessSlider;
