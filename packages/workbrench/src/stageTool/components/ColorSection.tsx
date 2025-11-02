import React from 'react';
import ColorDisplay from './ColorDisplay';
import ColorPicker from './ColorPicker';

interface ColorSectionProps {
  presetColors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
  onCustomColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ColorSection: React.FC<ColorSectionProps> = ({
  presetColors,
  selectedColor,
  onColorSelect,
  onCustomColorChange,
}) => {
  return (
    <div className="stage-tool-section">
      <div className="stage-tool-label">颜色</div>
      <div className="stage-tool-content">
        <ColorDisplay color={selectedColor} />
        <ColorPicker
          presetColors={presetColors}
          selectedColor={selectedColor}
          onColorSelect={onColorSelect}
          onCustomColorChange={onCustomColorChange}
        />
      </div>
    </div>
  );
};

export default ColorSection;
