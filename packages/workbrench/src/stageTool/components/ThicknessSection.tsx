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
    <div className="stage-tool-section">
      <div className="stage-tool-label">粗细</div>
      <div className="stage-tool-content">
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
