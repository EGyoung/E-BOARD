import React from 'react';

interface PresetColorsProps {
  colors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const PresetColors: React.FC<PresetColorsProps> = ({ colors, selectedColor, onColorSelect }) => {
  return (
    <div className="preset-colors">
      {colors.map((color) => (
        <div
          key={color}
          className={`color-option ${selectedColor === color ? 'selected' : ''}`}
          style={{ backgroundColor: color }}
          onClick={() => onColorSelect(color)}
          title={color}
        />
      ))}
    </div>
  );
};

export default PresetColors;
