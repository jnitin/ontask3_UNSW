import {
  OPEN_VIEW_MODAL,
  CLOSE_VIEW_MODAL,
  
  CLEAR_MATCHING_FIELD,
  RESOLVE_MATCHING_FIELD,
  FAILURE_FIELD_MATCH_RESULT,
  RECIEVE_FIELD_MATCH_RESULT,
  REFRESH_VIEW_FORM_STATE,
  UPDATE_VIEW_FORM_STATE,

  BEGIN_REQUEST_DATA_PREVIEW,
  FAILURE_REQUEST_DATA_PREVIEW,
  RECEIVE_DATA_PREVIEW,

  BEGIN_REQUEST_VIEW,
  FAILURE_REQUEST_VIEW,
  SUCCESS_CREATE_VIEW
} from './ViewActions';

import _ from 'lodash';

function view(state = {}, action) {
  switch (action.type) {
    case OPEN_VIEW_MODAL:
      return Object.assign({}, state, {
        visible: true,
        containerId: action.containerId,
        datasources: action.datasources,
        views: action.views
      });

    case CLOSE_VIEW_MODAL:
      return Object.assign({}, state, {
        visible: false,
        error: null,
        loading: false,
        containerId: null,
        datasources: null,
        views: null,
        view: null,
        formState: null
      });

    case CLEAR_MATCHING_FIELD:
      return Object.assign({}, state, {
        fieldMatchResult: null,
        matchingField: null,
        formState: action.payload
      });

    case RESOLVE_MATCHING_FIELD:
      return Object.assign({}, state, {
        fieldMatchResult: null,
        matchingField: null
      });

    case FAILURE_FIELD_MATCH_RESULT:
      return Object.assign({}, state, {
        error: action.error
      });

    case RECIEVE_FIELD_MATCH_RESULT:
      return Object.assign({}, state, {
        fieldMatchResult: action.fieldMatchResult,
        matchingField: action.matchingField,
        error: null
      });

    case REFRESH_VIEW_FORM_STATE:
      return Object.assign({}, state, {
        formState: action.payload
      });

    case UPDATE_VIEW_FORM_STATE:
      return Object.assign({}, state, {
        formState: _.merge(state.formState, action.payload)
      });

    case BEGIN_REQUEST_DATA_PREVIEW:
      return Object.assign({}, state, {
        dataLoading: true
      });

    case FAILURE_REQUEST_DATA_PREVIEW:
      return Object.assign({}, state, {
        dataLoading: false,
        error: action.error
      });

    case RECEIVE_DATA_PREVIEW:
      return Object.assign({}, state, {
        dataLoading: false,
        dataPreview: action.dataPreview
      });

    case BEGIN_REQUEST_VIEW:
      return Object.assign({}, state, {
        loading: true
      });

    case FAILURE_REQUEST_VIEW:
      return Object.assign({}, state, {
        loading: false,
        error: action.error
      });

    case SUCCESS_CREATE_VIEW:
      return Object.assign({}, state, {
        loading: false,
        error: null
      });

    default:
      return state;
  }
};

export default view;
