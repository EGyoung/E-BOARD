import React from 'react';
import PresetColors from './PresetColors';
import CustomColorPicker from './CustomColorPicker';

interface ColorPickerProps {
  presetColors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
  onCustomColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  presetColors,
  selectedColor,
  onColorSelect,
  onCustomColorChange,
}) => {
  return (
    <div className="color-picker-panel">
      <PresetColors 
        colors={presetColors}
        selectedColor={selectedColor}
        onColorSelect={onColorSelect}
      />
      <CustomColorPicker
        color={selectedColor}
        onChange={onCustomColorChange}
      />
    </div>
  );
};

export default ColorPicker;
