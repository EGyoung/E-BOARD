import { Container } from 'inversify';
import {
  IPointerEventService,
  ISelectionService,
  PointerEventService,
  SelectionService,
} from '../../services';
import { eBoardContainer } from '../IocContainer';

const commonServicesMap = [
  {
    name: IPointerEventService,
    service: PointerEventService,
  },
  {
    name: ISelectionService,
    service: SelectionService,
  },
] as const;
export const bindCommonServices = () => {
  commonServicesMap.forEach(({ name, service }) => {
    eBoardContainer.bind(name).to(service).inSingletonScope();
  });
};

export { commonServicesMap };
