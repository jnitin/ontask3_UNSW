import React from "react";
import { Modal, Button, Icon, Table } from "antd";

class PreviewModal extends React.Component {
  state = { index: 0 };

  handleClose = () => {
    const { onClose } = this.props;

    this.setState({ index: 0 });
    onClose();
  };

  render() {
    const { visible, populatedContent, records, order } = this.props;
    const { index } = this.state;

    if (!populatedContent) return null;

    return (
      <Modal
        visible={visible}
        title={`Preview content: ${index + 1}`}
        onCancel={this.handleClose}
        footer={null}
        className="preview"
        style={{ minWidth: "60%" }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Button.Group
            size="large"
            style={{ marginBottom: "10px", textAlign: "center" }}
          >
            <Button
              type="primary"
              disabled={index === 0 || populatedContent.length === 0}
              onClick={() => this.setState({ index: index - 1 })}
            >
              <Icon type="left" />
              Previous
            </Button>

            <Button
              type="primary"
              disabled={
                index === populatedContent.length - 1 ||
                populatedContent.length === 0
              }
              onClick={() => this.setState({ index: index + 1 })}
            >
              Next
              <Icon type="right" />
            </Button>
          </Button.Group>

          {populatedContent.length > 0 ? (
            <div>
              <h3>Data</h3>
              <Table
                size="small"
                scroll={{ x: (order.length - 1) * 175 }}
                style={{ marginBottom: 15 }}
                pagination={false}
                dataSource={[records[index]]}
                columns={order.map(item => ({
                  title: item,
                  dataIndex: item
                }))}
                rowKey={(record, i) => i}
              />

              <h3>Content</h3>
              <div
                style={{
                  padding: "10px",
                  border: "1px solid #F1F1F1",
                  maxHeight: 300,
                  overflowY: "scroll"
                }}
                dangerouslySetInnerHTML={{
                  __html: populatedContent[index]
                }}
              />
            </div>
          ) : (
            <div
              style={{
                padding: "10px",
                border: "1px solid #F1F1F1",
                textAlign: "center"
              }}
            >
              After filtering, no results were returned from your view.
            </div>
          )}
        </div>
      </Modal>
    );
  }
}

export default PreviewModal;
