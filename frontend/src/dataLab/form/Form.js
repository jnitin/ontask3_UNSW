import React from "react";
import {
  Form,
  Icon,
  Tooltip,
  Input,
  Select,
  Modal,
  Divider,
  Button,
  List,
  Checkbox,
  DatePicker,
  Alert,
  notification,
  Drawer,
  Table
} from "antd";
import _ from "lodash";
import moment from "moment";

import FieldDesign from "./FieldDesign";

import formItemLayout from "../../shared/FormItemLayout";
import apiRequest from "../../shared/apiRequest";
import Field from "../../shared/Field";

class DataLabForm extends React.Component {
  state = { singleRecordIndex: 0 };

  componentWillMount() {
    const { columns, formDetails } = this.props;

    const labels = columns.map(item => item.label);

    const fields = _.get(formDetails, "fields", []);

    this.setState({
      labels,
      fields,
      fieldKeys: fields.map(() => _.uniqueId())
    });
  }

  componentDidUpdate(prevProps) {
    const { formDetails, form } = this.props;

    if (prevProps.formDetails !== formDetails) {
      const fields = _.get(formDetails, "fields", []);
      this.setState({
        fields,
        fieldKeys: fields.map(() => _.uniqueId()),
        error: false
      });
      form.resetFields();
    }
  }

  addField = () => {
    const { fields, fieldKeys } = this.state;

    this.setState({
      fields: [...fields, {}],
      fieldKeys: [...fieldKeys, _.uniqueId()],
      error: false
    });
  };

  deleteField = fieldIndex => {
    const { form } = this.props;
    const { fieldKeys } = this.state;
    const { getFieldValue, setFieldsValue } = form;

    Modal.confirm({
      title: "Confirm field deletion",
      content: `Are you sure you want to delete this field from the form?
        Any data entered in the form for this field will be lost.`,
      onOk: () => {
        const fields = getFieldValue("fields");

        fieldKeys.splice(fieldIndex, 1);
        fields.splice(fieldIndex, 1);

        this.setState({ fieldKeys, fields });
        setFieldsValue({ fields });
      }
    });
  };

  onChangePrimary = primary => {
    const { form } = this.props;
    const { getFieldValue, setFieldsValue } = form;

    const currentPrimary = getFieldValue("primary");

    setFieldsValue({
      visibleFields: getFieldValue("visibleFields").filter(
        field => field !== primary
      )
    });

    // Check if the chosen primary key is unique
    const performCheck = () => {
      // const partial = getFieldValue("steps").slice(0, stepIndex);
      // apiRequest(`/datalab/check_uniqueness/`, {
      //   method: "POST",
      //   payload: { partial, primary },
      //   onSuccess: result => {
      //     const { isUnique } = result;
      //     if (!isUnique) {
      //       notification["error"]({
      //         message: "Invalid primary key",
      //         description: `"${primary}" cannot be used as a primary key
      //         because the values are not unique.`
      //       });
      //       setFieldsValue({
      //         [`steps[${stepIndex}].form.primary`]: null
      //       });
      //     }
      //   }
      // });
    };

    if (currentPrimary) {
      Modal.confirm({
        title: "Confirm primary key change",
        content: `All data in this form will be irreversably deleted if the 
          primary key is changed.`,
        okText: "Continue",
        okType: "danger",
        cancelText: "Cancel",
        onOk: () => {
          performCheck();
          setFieldsValue({ primary });
        }
      });
    } else {
      performCheck();
      return primary;
    }

    return currentPrimary;
  };

  handleSubmit = () => {
    const {
      form,
      selectedId,
      dataLabId,
      containerId,
      updateForms,
      history
    } = this.props;

    form.validateFields((err, payload) => {
      const hasNoFields = _.get(payload, "fields", []).length === 0;
      if (hasNoFields) this.setState({ error: true });

      if (err || hasNoFields) return;

      this.setState({ loading: true });

      apiRequest(selectedId ? `/form/${selectedId}/` : "/form/", {
        method: selectedId ? "PATCH" : "POST",
        payload: { ...payload, datalab: dataLabId, container: containerId },
        onSuccess: updatedForm => {
          notification["success"]({
            message: `Form ${selectedId ? "updated" : "created"}`,
            description: `The form was successfully ${
              selectedId ? "updated" : "created"
            }.`
          });
          this.setState({ loading: false });
          updateForms({ updatedForm });
          if (!selectedId)
            history.push({
              pathname: `/datalab/${dataLabId}/form/${updatedForm.id}`
            });
        },
        onError: error => {
          console.log(error);
          this.setState({ loading: false });
        }
      });
    });
  };

  handleDelete = () => {
    const { selectedId, history, dataLabId, updateForms } = this.props;

    Modal.confirm({
      title: "Confirm form deletion",
      content: "All data collected through the form will also be deleted.",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: true
        });

        apiRequest(`/form/${selectedId}/`, {
          method: "DELETE",
          onSuccess: () => {
            this.setState({ deleting: false });
            notification["success"]({
              message: "Form deleted",
              description: "The form was successfully deleted."
            });
            history.push(`/datalab/${dataLabId}/settings`);
            updateForms({ isDelete: true });
          },
          onError: error => {
            this.setState({ deleting: false });
            notification["error"]({
              message: "Form deletion failed",
              description: error
            });
          }
        });
      }
    });
  };

  preview = () => {
    const { form, data } = this.props;
    const { singleRecordIndex } = this.state;
    const { getFieldsValue } = form;
    const { primary, visibleFields, fields, layout } = getFieldsValue();

    console.log(data);
    
    const columns = [
      primary,
      ...visibleFields,
      ...(fields || []).map(field => field.name)
    ];

    if (layout === "table") {
      const tableColumns = columns.map((column, columnIndex) => ({
        title: column,
        dataIndex: column,
        key: columnIndex,
        render: (text, record) => {
          const field = (fields || []).find(field => field.name === column);
          console.log(column);
          console.log(record);
          return (
            <Field
              readOnly={!field}
              field={field}
              value={column in record ? text : null}
            />
          );
        }
      }));

      return (
        <Table
          columns={tableColumns}
          dataSource={data}
          scroll={{ x: (columns.length - 1) * 175 }}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: ["10", "25", "50", "100"]
          }}
          rowKey={(record, i) => i}
        />
      );
    } else if (layout === "vertical") {
      const tableColumns = [
        {
          title: "Field",
          dataIndex: "column"
        },
        {
          title: "Value",
          dataIndex: "value",
          render: (text, record) => {
            const field = (fields || []).find(
              field => field.name === record.column
            );

            return (
              <Field
                primaryKey={_.get(record.item, primary)} // Force re-render of the field component after changing the selected record
                readOnly={!field}
                field={field}
                value={text}
              />
            );
          }
        }
      ];

      return (
        <div>
          <div style={{ marginBottom: 5 }}>Choose a record:</div>

          <Select
            showSearch
            allowClear
            style={{ width: "100%", maxWidth: 350 }}
            onChange={singleRecordIndex => this.setState({ singleRecordIndex })}
            filterOption={(input, option) =>
              option.props.children
                .toLowerCase()
                .indexOf(input.toLowerCase()) >= 0
            }
            value={_.get(data, `${singleRecordIndex}.${primary}`)}
          >
            {(data || []).map((record, index) => (
              <Select.Option key={index}>{record[primary]}</Select.Option>
            ))}
          </Select>

          <Divider />

          <Table
            bordered
            columns={tableColumns}
            dataSource={columns.map((column, i) => ({
              column,
              value: _.get(data, `${singleRecordIndex}.${column}`),
              item: _.get(data, singleRecordIndex),
              key: i
            }))}
            pagination={false}
          />
        </div>
      );
    }
  };

  render() {
    const { formDetails, form, selectedId } = this.props;
    const {
      labels,
      fields,
      fieldKeys,
      error,
      loading,
      deleting,
      preview
    } = this.state;
    const { getFieldDecorator, getFieldValue, getFieldsValue } = form;

    const primary = getFieldValue("primary") || _.get(formDetails, "primary");

    return (
      <Form layout="horizontal" style={{ maxWidth: 700, overflow: "hidden" }}>
        <h2>Details</h2>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Form name
              <Tooltip
                title="The name provided will be used as the page title 
                when a user accesses the form"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("name", {
            initialValue: _.get(formDetails, "name"),
            rules: [{ required: true, message: "Name is required" }]
          })(<Input />)}
        </Form.Item>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Primary key
              <Tooltip
                title="The field from the DataLab that will be used 
                to identify the data collected through this form"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator(`primary`, {
            rules: [{ required: true, message: "Primary key is required" }],
            getValueFromEvent: this.onChangePrimary,
            initialValue: _.get(formDetails, "primary")
          })(
            <Select>
              {labels.map(label => (
                <Select.Option value={label} key={label}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          )}
        </Form.Item>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Additional fields
              <Tooltip
                title="You may specify fields from other modules that 
                should be shown in the form (read only)"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("visibleFields", {
            initialValue: _.get(formDetails, "visibleFields", [])
          })(
            <Select
              mode="multiple"
              maxTagCount={5}
              maxTagPlaceholder={`...${getFieldValue("visibleFields").length -
                5} more fields selected`}
            >
              {labels.map(label => (
                <Select.Option
                  disabled={label === primary}
                  value={label}
                  key={label}
                >
                  <Tooltip
                    title={
                      label === primary
                        ? "The primary key of the form is included by default"
                        : ""
                    }
                  >
                    {label}
                  </Tooltip>
                </Select.Option>
              ))}
            </Select>
          )}
        </Form.Item>

        <Divider />

        <h2>Design</h2>

        <div>
          <Button icon="plus" onClick={this.addField}>
            Add field
          </Button>

          <Tooltip
            title={
              !getFieldValue("primary")
                ? "The primary key must be specified before you can preview the form"
                : ""
            }
          >
            <Button
              disabled={!getFieldValue("primary")}
              style={{ marginLeft: 10 }}
              icon="experiment"
              onClick={() => this.setState({ preview: true })}
            >
              Preview
            </Button>
          </Tooltip>
        </div>

        <List
          size="large"
          bordered
          dataSource={fieldKeys}
          style={{ marginTop: 10, overflowY: "auto", maxHeight: 300 }}
          locale={{ emptyText: "No fields have been added yet." }}
          renderItem={(key, fieldIndex) => {
            return (
              <List.Item>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%"
                  }}
                >
                  <FieldDesign
                    key={key}
                    labels={[
                      ...labels,
                      ..._.get(getFieldsValue(), "fields", []).map(
                        (field, i) => i !== fieldIndex && field.name
                      )
                    ]}
                    field={fields[fieldIndex]}
                    fieldIndex={fieldIndex}
                    form={form}
                    deleteField={() => this.deleteField(fieldIndex)}
                    updateClonedField={field => {
                      const updatedFields = [...fields];
                      updatedFields[fieldIndex] = field;
                      this.setState({ fields: updatedFields });
                    }}
                  />
                </div>
              </List.Item>
            );
          }}
        />

        <Form.Item
          {...formItemLayout}
          style={{ marginTop: 10 }}
          label={
            <span>
              Layout
              <Tooltip
                title="Choose whether the form will be represented as a single-record 
                vertical form (mobile friendly) or a table (desktop friendly)"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("layout", {
            initialValue: _.get(formDetails, "layout", "table")
          })(
            <Select>
              <Select.Option value="vertical">Single-record form</Select.Option>
              <Select.Option value="table">Data table</Select.Option>
            </Select>
          )}
        </Form.Item>

        <Divider />

        <h2>Access</h2>

        <Form.Item {...formItemLayout} label="Active from">
          {getFieldDecorator("activeFrom", {
            initialValue: _.get(formDetails, "activeFrom")
              ? moment(_.get(formDetails, "activeFrom"))
              : undefined
          })(
            <DatePicker
              style={{ width: "100%" }}
              showTime
              format="DD/MM/YYYY HH:mm"
            />
          )}
        </Form.Item>

        <Form.Item {...formItemLayout} label="Active to">
          {getFieldDecorator("activeTo", {
            initialValue: _.get(formDetails, "activeTo")
              ? moment(_.get(formDetails, "activeTo"))
              : undefined
          })(
            <DatePicker
              style={{ width: "100%" }}
              showTime
              format="DD/MM/YYYY HH:mm"
            />
          )}
        </Form.Item>

        <Form.Item {...formItemLayout} label="Allow access via user email">
          {getFieldDecorator("emailAccess", {
            initialValue: _.get(formDetails, "emailAccess") || false,
            valuePropName: "checked"
          })(<Checkbox />)}
        </Form.Item>

        <Form.Item {...formItemLayout} label="Allow access via LTI">
          {getFieldDecorator("ltiAccess", {
            initialValue: _.get(formDetails, "ltiAccess") || false,
            valuePropName: "checked"
          })(<Checkbox />)}
        </Form.Item>

        {(getFieldValue("ltiAccess") || getFieldValue("emailAccess")) && (
          <div>
            <Form.Item
              {...formItemLayout}
              label={
                <span>
                  Match permission with
                  <Tooltip
                    title="Grant access on a record-by-record basis by comparing the given 
                DataLab field value with the access method(s) specified above"
                  >
                    <Icon
                      style={{ marginLeft: 5, cursor: "help" }}
                      type="question-circle"
                    />
                  </Tooltip>
                </span>
              }
            >
              {getFieldDecorator("permission", {
                rules: [
                  {
                    required: true,
                    message:
                      "Permission matching field is required if access is allowed via LTI or user email"
                  }
                ],
                initialValue: _.get(formDetails, "permission")
              })(
                <Select>
                  {labels.map(label => (
                    <Select.Option value={label} key={label}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </Form.Item>

            <Form.Item {...formItemLayout} label="Restriction type">
              {getFieldDecorator("restriction", {
                rules: [
                  {
                    required: true,
                    message: "Restriction type is required"
                  }
                ],
                initialValue: _.get(formDetails, "restriction", "private")
              })(
                <Select>
                  <Select.Option value="private">
                    <Tooltip
                      title="Users can only see and edit the records for which they have
                  explicit access"
                    >
                      Limited read, limited write
                    </Tooltip>
                  </Select.Option>
                  <Select.Option value="limited">
                    <Tooltip
                      title="Users that have access to at least one record can see all 
                  records but can only edit those for which they have explicit access"
                    >
                      Open read, limited write
                    </Tooltip>
                  </Select.Option>
                  <Select.Option value="open">
                    <Tooltip
                      title="Users that have access to at least one record can see and 
                  edit all other records"
                    >
                      Open read, open write
                    </Tooltip>
                  </Select.Option>
                </Select>
              )}
            </Form.Item>
          </div>
        )}

        {error && (
          <Alert
            style={{ marginTop: 20 }}
            type="error"
            message="At least one field is required in the form"
          />
        )}

        <div style={{ marginTop: 20 }}>
          {selectedId && (
            <Button
              type="danger"
              style={{ marginRight: 10 }}
              loading={deleting}
              onClick={this.handleDelete}
            >
              Delete
            </Button>
          )}

          <Button type="primary" onClick={this.handleSubmit} loading={loading}>
            {selectedId ? "Save" : "Submit"}
          </Button>
        </div>

        {getFieldValue("primary") && (
          <Drawer
            className="form-drawer"
            title="Form Preview"
            placement="right"
            onClose={() => this.setState({ preview: false })}
            visible={preview}
          >
            {this.preview()}
            <Alert
              style={{ marginTop: 20, maxWidth: 500 }}
              type="info"
              showIcon
              message="Data entered in this form preview will not be saved"
            />
          </Drawer>
        )}
      </Form>
    );
  }
}

export default Form.create()(DataLabForm);