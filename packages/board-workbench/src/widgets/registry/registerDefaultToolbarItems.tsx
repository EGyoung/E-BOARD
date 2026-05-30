import { floatingToolbarRegistry } from './ToolbarRegistry';
import { DEFAULT_TOOLBAR_ITEMS } from './items';

let defaultsRegistered = false;

export function registerDefaultToolbarItems() {
    if (defaultsRegistered) return;

    DEFAULT_TOOLBAR_ITEMS.forEach(item => {
        floatingToolbarRegistry.register(item);
    });

    defaultsRegistered = true;
}