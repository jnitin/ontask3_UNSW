import React, { useState } from "react";

import { Popover, Tooltip, Popconfirm, Input, Select, Row, Col } from "antd";

function Link(options) {
  return {
    renderInline(props, editor, next) {
      const { attributes, children, node } = props;

      switch (node.type) {
        case "hyperlink":
          let href = node.data.get("href");
          if (
            href &&
            !(href.startsWith("http://") || href.startsWith("https://"))
          )
            href = `//${href}`;

          const paramName = node.data.get("paramName");
          const paramValue = node.data.get("paramValue");
          if (paramName && paramValue)
            href = `${href}?${paramName}=<${paramValue}>`;

          return (
            <Popover
              content={
                <div>
                  {/* <Tooltip title="Edit link">
                    <i
                      style={{ cursor: "pointer", marginRight: 5 }}
                      className="material-icons"
                    >
                      create
                    </i>
                  </Tooltip> */}
                  <Tooltip title="Go to link">
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "rgba(0, 0, 0, 0.65)" }}
                    >
                      <i className="material-icons">public</i>
                    </a>
                  </Tooltip>
                </div>
              }
            >
              <a {...attributes}>{children}</a>
            </Popover>
          );

          // The below is retained for backwards compatability only
          case "link":
            href = node.data.get("href");
            if (href && !(href.startsWith("http://") || href.startsWith("https://")))
              href = `//${href}`;
            return (
              <Popover
                content={
                  <div>
                    <Tooltip title="Go to link">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "rgba(0, 0, 0, 0.65)" }}
                      >
                        <i className="material-icons">public</i>
                      </a>
                    </Tooltip>
                  </div>
                }
              >
                <a {...attributes}>{children}</a>
              </Popover>
            );

        default:
          return next();
      }
    }
  };
}

export const LinkButton = ({ editor, order }) => {
  const [hyperlink, setHyperlink] = useState({ label: null, url: null });

  return (
    <Popconfirm
      icon={null}
      title={
        <div className="action_toolbar_popup">
          <Input
            placeholder="Label"
            size="small"
            onChange={e =>
              setHyperlink({ ...hyperlink, label: e.target.value })
            }
            value={hyperlink.label}
          />
          <Input
            placeholder="URL"
            size="small"
            onChange={e => setHyperlink({ ...hyperlink, url: e.target.value })}
            value={hyperlink.url}
          />
          URL parameter (optional):
          <Row style={{ display: "flex" }} gutter={8}>
            <Col xs={12}>
              <Input
                style={{ width: "100%" }}
                placeholder="Parameter"
                size="small"
                onChange={e =>
                  setHyperlink({ ...hyperlink, paramName: e.target.value })
                }
                value={hyperlink.paramName}
              />
            </Col>

            <Col xs={12}>
              <Select
                placeholder="Field"
                style={{ width: "100%" }}
                size="small"
                value={hyperlink.paramValue}
                onChange={paramValue =>
                  setHyperlink({ ...hyperlink, paramValue })
                }
              >
                {order.map(field => {
                  return (
                    <Select.Option value={field} key={field}>
                      {field}
                    </Select.Option>
                  );
                })}
              </Select>
            </Col>
          </Row>
        </div>
      }
      onVisibleChange={visible => {
        if (!visible) setHyperlink({ label: null, url: null });
      }}
      onConfirm={() => {
        if (!(hyperlink.label && hyperlink.url)) return;
        editor
          .insertText(hyperlink.label)
          .moveFocusBackward(hyperlink.label.length)
          .wrapInline({
            type: "hyperlink",
            data: {
              href: hyperlink.url,
              paramName: hyperlink.paramName,
              paramValue: hyperlink.paramValue
            }
          })
          .moveToEnd();
      }}
    >
      <Tooltip title="Insert Link">
        <i className="material-icons">insert_link</i>
      </Tooltip>
    </Popconfirm>
  );
};

export default Link;
