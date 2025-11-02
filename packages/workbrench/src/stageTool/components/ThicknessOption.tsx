import React from 'react';

interface ThicknessOptionProps {
  thickness: number;
  isSelected: boolean;
  color: string;
  onSelect: (thickness: number) => void;
}

const ThicknessOption: React.FC<ThicknessOptionProps> = ({
  thickness,
  isSelected,
  color,
  onSelect,
}) => {
  return (
    <div
      className={`thickness-option ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(thickness)}
      title={`${thickness}px`}
    >
      <div
        className="thickness-preview"
        style={{
          width: `${thickness}px`,
          height: `${thickness}px`,
          backgroundColor: color,
        }}
      />
      <span className="thickness-label">{thickness}</span>
    </div>
  );
};

export default ThicknessOption;
