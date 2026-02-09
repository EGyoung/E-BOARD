import React from 'react';
import ThicknessOption from './ThicknessOption';

interface ThicknessOptionsProps {
  presetThickness: number[];
  selectedThickness: number;
  color: string;
  onSelect: (thickness: number) => void;
}

const ThicknessOptions: React.FC<ThicknessOptionsProps> = ({
  presetThickness,
  selectedThickness,
  color,
  onSelect,
}) => {
  return (
    <div className="thickness-options">
      {presetThickness.map((thickness) => (
        <ThicknessOption
          key={thickness}
          thickness={thickness}
          isSelected={selectedThickness === thickness}
          color={color}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

export default ThicknessOptions;
