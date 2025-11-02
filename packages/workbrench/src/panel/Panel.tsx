import React, { useState, useRef } from 'react';
import { ToolHeader, ColorSection, ThicknessSection } from './components';
import './styles.css';

interface PanelWithBoardProps {
    board?: any; // EBoard instance
    onColorChange?: (color: string) => void;
    onThicknessChange?: (thickness: number) => void;
    defaultColor?: string;
    defaultThickness?: number;
}


// 预设颜色
const presetColors = [
    '#ffffff', // 白色
    '#000000', // 黑色
    '#ff0000', // 红色
    '#00ff00', // 绿色
    '#0000ff', // 蓝色
    '#ffff00', // 黄色
    '#ff00ff', // 品红
    '#00ffff', // 青色
    '#ff8800', // 橙色
    '#8800ff', // 紫色
];

// 预设粗细
const presetThickness = [1, 2, 4, 6, 8, 12, 16, 20];

const Panel: React.FC<PanelWithBoardProps> = ({
    board,
    onColorChange,
    onThicknessChange,
    defaultColor = '#ffffff',
    defaultThickness = 4,
}) => {
    const [selectedColor, setSelectedColor] = useState(defaultColor);
    const [selectedThickness, setSelectedThickness] = useState(defaultThickness);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);


    const handleColorSelect = (color: string) => {
        setSelectedColor(color);
        onColorChange?.(color);

        // 如果传入了 board 实例，更新配置服务
        if (board && board.getService) {
            try {
                const IConfigService = Symbol.for('IConfigService');
                const configService = board.getService(IConfigService);
                if (configService && configService.setCtxConfig) {
                    configService.setCtxConfig({ strokeStyle: color });
                }
            } catch (error) {
                console.warn('无法更新配置服务:', error);
            }
        }
    };

    const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value;
        handleColorSelect(color);
    };

    const handleThicknessSelect = (thickness: number) => {
        setSelectedThickness(thickness);
        onThicknessChange?.(thickness);

        // 如果传入了 board 实例，更新配置服务
        if (board && board.getService) {
            try {
                const IConfigService = Symbol.for('IConfigService');
                const configService = board.getService(IConfigService);
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
