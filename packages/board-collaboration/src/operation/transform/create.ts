import { OperationSource } from "@e-board/board-core";
import { IOperationHandler } from "./type";

export class CreateHandler implements IOperationHandler {
    type = 'create';

    handleLocal({ operation, elementService }: any) {
        const type = operation.model?.type;
        if (!type) throw new Error('Operation missing type');

        const element = elementService.getElement(type);
        if (!element) throw new Error(`Unregistered element type: ${type}`);

        return {
            operation: this.type,
            model: element.saveInfoProvider.parse(operation.model)
        };
    }

    handleRemote({ data, board, elementService }: any) {
        const element = elementService.getElement(data.model.type);
        if (!element) throw new Error(`Unregistered element type: ${data.model.type}`);

        const modelService = board.getService('modelService');
        const existing = modelService.getModelById(data.model.id);
        const incomingTime = data.timestamp || 0;

        // If validation fails or stale data
        if (existing) {
            // If we already have the model, 'create' is treated as a full-state update.
            // We only apply fields that are newer than what we have in _clockMap.
            // But 'create' usually doesn't carry _clockMap.
            // We assume all fields in 'create' have timestamp = incomingTime.

            // However, cleaner logic: If existing model has any field with ts > incomingTime, keep it.
            // This is complex. 
            // Simplified LWW for Create vs Update: 
            // IF existing._clockMap has higher timestamps, we keep those fields.
            // BUT, typically 'create' should only happen once. 
            // If we receive a 'create' for an existing object, it implies we missed the original create 
            // OR this is a concurrently created object (ID collision).
            // Assuming ID collision or re-sync:
            // We should merge.

            // Let's just create a clockMap for the new data if not present
            const newClockMap: Record<string, number> = {};

            // Populate clockMap for the incoming model fields (shallow or deep?)
            // For now, just object level or iterate keys.
            // To be safe and simple: 
            // If existing exists, we do nothing and rely on subsequent updates? 
            // No, 'create' might have initial data we allow.

            // Simplest Strategy: 
            // If existing, ignore 'create' to avoid overwriting newer updates.
            // (Since we assume strict causality primarily, seeing a 'create' for existing ID 
            // means we likely already processed it or processed an update that implies it)
            return;
        }

        // Prepare model with initial clockMap
        const model = { ...data.model };
        if (!model._clockMap) {
            model._clockMap = {};
            // Initialize _clockMap for top-level keys
            Object.keys(model).forEach(k => {
                if (k !== 'id' && k !== 'type') {
                    model._clockMap![k] = incomingTime;
                }
            });
            // Also special handling for nested 'options'?
            // For now, just top-level keys is a good start. 
            // If we want field-level granularity, we'll expand on demand in update.ts logic.
            // But update.ts handles paths like "options.color".
            if (model.options) {
                recurseKeys(model.options, 'options', model._clockMap, incomingTime);
            }
        }

        // Attach LWW metadata
        model._v = incomingTime;
        model._by = data.nodeId;

        const saveInfoService = board.getService('saveInfoService');
        try {
            saveInfoService.importSaveInfo(model, OperationSource.REMOTE);
        } catch (e) {
            console.error('Failed to apply remote create', e);
        }
    }
}

function recurseKeys(obj: any, prefix: string, map: Record<string, number>, time: number) {
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        const path = `${prefix}.${key}`;
        map[path] = time;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            recurseKeys(val, path, map, time);
        }
    });
}
