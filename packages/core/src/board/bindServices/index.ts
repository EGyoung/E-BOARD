import { resetContainer } from '../../common/IocContainer';
import { bindCommonServices } from '../../common/initServices';
const bindServices = () => {
  resetContainer();
  bindCommonServices();
};

export { bindServices };
