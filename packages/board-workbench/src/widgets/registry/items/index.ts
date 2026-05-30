import { FloatingToolbarItem } from '../ToolbarRegistry';
import { ACTION_ITEMS } from './actionItems';
import { APPEARANCE_ITEMS } from './appearanceItems';
import { TEXT_ITEMS } from './textItems';

export const DEFAULT_TOOLBAR_ITEMS: FloatingToolbarItem[] = [
    ...APPEARANCE_ITEMS,
    ...TEXT_ITEMS,
    ...ACTION_ITEMS,
];
