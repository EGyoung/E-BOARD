import { OperationSource } from "@e-board/board-core";
import { IOperationHandler } from "./type";

export class UpdateHandler implements IOperationHandler {
    type = 'update';

    handleLocal({ operation, modelService, elementService, timestamp, nodeId }: any) {
        const modelId = operation.modelId;
        const model = modelService.getModelById(modelId);
        const type = model?.type;
        if (!type) throw new Error('Operation missing type');

        const element = elementService.getElement(type);
        if (!element) throw new Error(`Unregistered element type: ${type}`);

        const updates = element.saveInfoProvider.parse(operation.updates);

        if (timestamp && nodeId && model) {
             if (!model._clockMap) model._clockMap = {};
             // Update local _clockMap to reflect this local mutation
             const recurseSet = (obj: any, prefix = '') => {
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    const fullPath = prefix ? `${prefix}.${key}` : key;
                    if (val && typeof val === 'object' && !Array.isArray(val)) {
                        recurseSet(val, fullPath);
                    } else {
                        model._clockMap![fullPath] = { ts: timestamp, nodeId };
                    }
                });
            };
            recurseSet(updates);
            model._v = Math.max(model._v || 0, timestamp);
            model._by = nodeId;
        }

        return {
            operation: this.type,
            updates,
            previousState: element.saveInfoProvider.parse(operation.previousState),
            modelId: operation.modelId
        };
    }

    handleRemote({ data, modelService }: any) {
        const modelId = data.modelId;
        const model = modelService.getModelById(modelId);
        if (!model) return;

        const incomingTime = data.timestamp || 0;
        const currentClockMap = model._clockMap || {};
        const newClockMap = { ...currentClockMap };

        const validUpdates: any = {};
        let hasChanges = false;

        const processUpdates = (source: any, pathPrefix = '') => {
            Object.keys(source).forEach(key => {
                const value = source[key];
                const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    processUpdates(value, fullPath);
                    return;
                }

                // If path is deeply nested inside arrays (not expected for IModel simple props), handle with care.
                // Assuming standard atomic arrays.

                const incomingNode = data.nodeId || ''; // Assume incoming node ID is present
                const localData = newClockMap[fullPath];
                const localTs = localData?.ts || 0;
                const localNode = localData?.nodeId || '';

                // LWW Check
                let applyUpdate = false;
                if (incomingTime > localTs) {
                    applyUpdate = true;
                } else if (incomingTime === localTs) {
                    // Tie-break: if timestamps are equal, compare nodeIds to ensure convergence.
                    if (incomingNode > localNode) {
                        applyUpdate = true;
                    }
                }

                if (applyUpdate) {
                    setDeepValue(validUpdates, fullPath, value);
                    newClockMap[fullPath] = { ts: incomingTime, nodeId: incomingNode };
                    hasChanges = true;
                }
            });
        };

        const setDeepValue = (obj: any, path: string, value: any) => {
            const keys = path.split('.');
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
        };

        processUpdates(data.updates);

        if (hasChanges) {
            // Apply updates. 
            // We use 'validUpdates' which contains only the winning fields.
            // We also persist the updated clock map.

            // Safety measure for nested objects (like options):
            // If validUpdates is sparse (e.g. {options: {color: 'red'}}), 
            // ensure we don't accidentally wipe other options if updateModel is not deep-merging.
            if (validUpdates.options && model.options) {
                validUpdates.options = { ...model.options, ...validUpdates.options };
            }

            const metaUpdates = {
                ...validUpdates,
                _clockMap: newClockMap,
                _v: Math.max(model._v || 0, incomingTime)
            };

            modelService.updateModel(modelId, metaUpdates, OperationSource.REMOTE);
        }
    }
}
