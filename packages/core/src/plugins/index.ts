import { IPlugin } from "./type";

class BasePlugin implements IPlugin {
    pluginName: string;
    constructor() {
        this.pluginName = 'BasePlugin';
    }
    init() {
        console.log('BasePlugin init');
    }
    dispose() {
        console.log('BasePlugin dispose');
    }
}

export default BasePlugin;
export type { IPlugin };