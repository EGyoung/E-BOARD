import React from 'react';
import ColorDisplay from './ColorDisplay';
import ColorPicker from './ColorPicker';

interface FillColorSectionProps {
    presetColors: string[];
    selectedColor: string;
    onColorSelect: (color: string) => void;
    onCustomColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FillColorSection: React.FC<FillColorSectionProps> = ({
    presetColors,
    selectedColor,
    onColorSelect,
    onCustomColorChange,
}) => {
    return (
        <div className="panel-section">
            <div className="panel-label">填充颜色</div>
            <div className="panel-content">
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

export default FillColorSection;
