import React, { useState, useRef } from 'react';
import { ToolHeader, ColorSection, FillColorSection, ThicknessSection } from './components';
import './styles.css';
import type { EBoard } from '@e-board/board-core';

interface PanelWithBoardProps {
    board?: EBoard | null; // EBoard instance
    onColorChange?: (color: string) => void;
    onFillColorChange?: (color: string) => void;
    onThicknessChange?: (thickness: number) => void;
    defaultColor?: string;
    defaultFillColor?: string;
    defaultThickness?: number;
}


// 预设颜色
const presetColors = [
    '#ffffff', // 白色
    '#000000', // 黑色
    '#ff0000', // 红色
    '#0000ff', // 蓝色
    '#ffff00', // 黄色
    '#00ff00', // 绿色
];

// 预设粗细
const presetThickness = [1, 2, 4, 8, 12, 16];

const Panel: React.FC<PanelWithBoardProps> = ({
    board,
    onColorChange,
    onFillColorChange,
    onThicknessChange,
    defaultColor = '#ffffff',
    defaultFillColor = '#ffffff',
    defaultThickness = 4,
}) => {
    const [selectedColor, setSelectedColor] = useState(defaultColor);
    const [selectedFillColor, setSelectedFillColor] = useState(defaultFillColor);
    const [selectedThickness, setSelectedThickness] = useState(defaultThickness);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const colorPickerRef = useRef<HTMLDivElement>(null);


    const handleColorSelect = (color: string) => {
        setSelectedColor(color);
        onColorChange?.(color);
    };

    const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value;
        handleColorSelect(color);
    };

    const handleFillColorSelect = (color: string) => {
        setSelectedFillColor(color);
        onFillColorChange?.(color);
    };

    const handleCustomFillColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value;
        handleFillColorSelect(color);
    };

    const handleThicknessSelect = (thickness: number) => {
        setSelectedThickness(thickness);
        onThicknessChange?.(thickness);

        // 如果传入了 board 实例，更新配置服务
        if (board && board.getService) {
            try {
                // const IConfigService = Symbol.for('IConfigService');
                const configService = board.getService('configService')
                if (configService && configService.setCtxConfig) {
                    configService.setCtxConfig({ lineWidth: thickness });
                }
            } catch (error) {
                console.warn('无法更新配置服务:', error);
            }
        }
    };

    return (
        <div className={`panel ${isCollapsed ? 'collapsed' : ''}`} ref={colorPickerRef}>
            <ToolHeader
                isCollapsed={isCollapsed}
                onToggle={() => setIsCollapsed(!isCollapsed)}
            />

            {!isCollapsed && (
                <div className="panel-body">
                    <ColorSection
                        presetColors={presetColors}
                        selectedColor={selectedColor}
                        onColorSelect={handleColorSelect}
                        onCustomColorChange={handleCustomColorChange}
                    />

                    <FillColorSection
                        presetColors={presetColors}
                        selectedColor={selectedFillColor}
                        onColorSelect={handleFillColorSelect}
                        onCustomColorChange={handleCustomFillColorChange}
                    />

                    <ThicknessSection
                        presetThickness={presetThickness}
                        selectedThickness={selectedThickness}
                        color={selectedColor}
                        onThicknessSelect={handleThicknessSelect}
                    />
                </div>
            )}
        </div>
    );
};

export default Panel;
