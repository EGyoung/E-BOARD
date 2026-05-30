import React from 'react';

export interface FloatingToolbarContext {
    selectedElements: any[];
    isSingleType: boolean;
    elementType: string | null;
    isShape: boolean;
    hasFill: boolean;
    isText: boolean;
    isPicture: boolean;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    opacity: number;
    fontSize: number;
    textAlign: 'left' | 'center' | 'right';
    lineDash: number[];
    setStrokeColor: (value: string) => void;
    setFillColor: (value: string) => void;
    setStrokeWidth: (value: number) => void;
    setOpacity: (value: number) => void;
    setFontSize: (value: number) => void;
    setTextAlign: (value: 'left' | 'center' | 'right') => void;
    setLineDash: (value: number[]) => void;
    updateElement: (updates: any) => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
}

export interface FloatingToolbarItem {
    id: string;
    order?: number;
    isVisible?: (context: FloatingToolbarContext) => boolean;
    render: (context: FloatingToolbarContext) => React.ReactNode;
}

class FloatingToolbarRegistry {
    private items: Map<string, FloatingToolbarItem> = new Map();
    private listeners: Set<() => void> = new Set();

    register(item: FloatingToolbarItem) {
        this.items.set(item.id, item);
        this.emit();
    }

    unregister(id: string) {
        this.items.delete(id);
        this.emit();
    }

    getAllItems() {
        return Array.from(this.items.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    getVisibleItems(context: FloatingToolbarContext) {
        return this.getAllItems().filter(item => item.isVisible ? item.isVisible(context) : true);
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit() {
        this.listeners.forEach(listener => listener());
    }
}

export const floatingToolbarRegistry = new FloatingToolbarRegistry();