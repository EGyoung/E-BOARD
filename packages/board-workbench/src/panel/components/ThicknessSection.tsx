import React from 'react';
import ThicknessOptions from './ThicknessOptions';
import ThicknessSlider from './ThicknessSlider';

interface ThicknessSectionProps {
  presetThickness: number[];
  selectedThickness: number;
  color: string;
  onThicknessSelect: (thickness: number) => void;
}

const ThicknessSection: React.FC<ThicknessSectionProps> = ({
  presetThickness,
  selectedThickness,
  color,
  onThicknessSelect,
}) => {
  return (
    <div className="panel-section">
      <div className="panel-label">粗细</div>
      <div className="panel-content">
        <ThicknessOptions
          presetThickness={presetThickness}
          selectedThickness={selectedThickness}
          color={color}
          onSelect={onThicknessSelect}
        />
        <ThicknessSlider
          value={selectedThickness}
          onChange={onThicknessSelect}
        />
      </div>
    </div>
  );
};

export default ThicknessSection;
