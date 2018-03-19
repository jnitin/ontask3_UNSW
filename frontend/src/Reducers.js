import { combineReducers } from 'redux';

import containers from './container/ContainerReducers';
import view from './view/ViewReducers';
import datasource from './datasource/DatasourceReducers';
import workflow from './workflow/WorkflowReducers';

const rootReducer = combineReducers({
  containers,
  view,
  datasource,
  workflow
});

export default rootReducer;