import React from 'react';

interface CustomColorPickerProps {
  color: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CustomColorPicker: React.FC<CustomColorPickerProps> = ({ color, onChange }) => {
  return (
    <div className="custom-color">
      <label htmlFor="custom-color-input">自定义颜色：</label>
      <input
        id="custom-color-input"
        type="color"
        value={color}
        onChange={onChange}
      />
    </div>
  );
};

export default CustomColorPicker;
