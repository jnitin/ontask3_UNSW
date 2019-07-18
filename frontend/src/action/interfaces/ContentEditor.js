import React from "react";
import { Popover, Tooltip, Popconfirm, Input, Select, Button } from "antd";

import { SketchPicker } from 'react-color';

import { Editor, getEventTransfer } from "slate-react";
import Html from "slate-html-serializer";
import SoftBreak from "slate-soft-break";
import { Value } from "slate";
import { isKeyHotkey } from "is-hotkey";
import sanitizeHtml from "sanitize-html";

import FontFamilyList from './FontFamilyList';

/**
 * TODO
 * Content Editor Cursor disappears after choosing color
 * Font Family
 * (Font Size?)
 * Undo Redo
 */

const DEFAULT_NODE = "paragraph";

const plugins = [SoftBreak({ shift: true })];

const BLOCK_TAGS = {
  p: "paragraph",
  li: "list-item",
  ul: "bulleted-list",
  ol: "numbered-list",
  blockquote: "quote",
  pre: "code",
  h1: "heading-one",
  h2: "heading-two",
  h3: "heading-three",
  h4: "heading-four",
  h5: "heading-five",
  h6: "heading-six"
};

const MARK_TAGS = {
  strong: "bold",
  em: "italic",
  u: "underlined",
  s: "strikethrough",
  code: "code",
  span: "span"
};

const parseStyles = styles => {
  return styles
    ? styles
        .split(";")
        .filter(style => style.split(":")[0] && style.split(":")[1])
        .map(style => [
          style
            .split(":")[0]
            .trim()
            .replace(/-./g, c => c.substr(1).toUpperCase()),
          style.split(":")[1].trim()
        ])
        .reduce(
          (styleObj, style) => ({
            ...styleObj,
            [style[0]]: style[1]
          }),
          {}
        )
    : styles;
};

const rules = [
  {
    serialize(obj, children) {
      if (["block", "inline"].includes(obj.object)) {
        switch (obj.type) {
          case "heading-one":
            return <h1>{children}</h1>;
          case "heading-two":
            return <h2>{children}</h2>;
          case "paragraph":
            return <p>{children}</p>;
          case "numbered-list":
            return <ol>{children}</ol>;
          case "bulleted-list":
            return <ul>{children}</ul>;
          case "list-item":
            return <li>{children}</li>;
          case "link":
            return (
              <a
                href={obj.data.get("href")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          case "image":
            return (
              <img
                src={obj.data.get("src")}
                alt={obj.data.get("alt")}
                style={{ maxWidth: "100%" }}
              />
            );
          case "attribute":
            return <attribute>{obj.data.get("field")}</attribute>;
          case "condition":
            return <div>{children}</div>;
          default:
            return;
        }
      }
    }
  },
  {
    serialize(obj, children) {
      if (obj.object === "mark") {
        switch (obj.type) {
          case "span":
            return (
              <span style={parseStyles(obj.data.get("style"))}>{children}</span>
            );
          case "bold":
            return <strong>{children}</strong>;
          case "italic":
            return <em>{children}</em>;
          case "underlined":
            return <u>{children}</u>;
          case "code":
            return (
              <pre>
                <code>{children}</code>
              </pre>
            );
          default:
            return;
        }
      }
    }
  },
  {
    deserialize(el, next) {
      const block = BLOCK_TAGS[el.tagName.toLowerCase()];

      if (block) {
        return {
          object: "block",
          type: block,
          nodes: next(el.childNodes)
        };
      }
    }
  },
  {
    deserialize(el, next) {
      const mark = MARK_TAGS[el.tagName.toLowerCase()];

      if (mark) {
        return {
          object: "mark",
          type: mark,
          nodes: next(el.childNodes),
          data:
            mark === "span"
              ? {
                  style: el.getAttribute("style")
                }
              : undefined
        };
      }
    }
  },
  {
    // Special case for code blocks, which need to grab the nested childNodes.
    deserialize(el, next) {
      if (el.tagName.toLowerCase() === "pre") {
        const code = el.childNodes[0];
        const childNodes =
          code && code.tagName.toLowerCase() === "code"
            ? code.childNodes
            : el.childNodes;

        return {
          object: "block",
          type: "code",
          nodes: next(childNodes)
        };
      }
    }
  },
  {
    // Special case for images, to grab their src.
    deserialize(el, next) {
      if (el.tagName.toLowerCase() === "img") {
        return {
          object: "block",
          type: "image",
          isVoid: true,
          nodes: next(el.childNodes),
          data: {
            src: el.getAttribute("src")
          }
        };
      }
    }
  },
  {
    // Special case for links, to grab their href.
    deserialize(el, next) {
      if (el.tagName.toLowerCase() === "a") {
        return {
          object: "inline",
          type: "link",
          nodes: next(el.childNodes),
          data: {
            href: el.getAttribute("href")
          }
        };
      }
    }
  },
  {
    deserialize(el, next) {
      if (!el.nodeValue || el.nodeValue.trim() === "") return null;
    }
  }
];

const initialValue = Value.fromJSON({
  document: {
    nodes: [
      {
        object: "block",
        type: "paragraph",
        nodes: [
          {
            object: "text",
            leaves: [
              {
                text: ""
              }
            ]
          }
        ]
      }
    ]
  }
});

const isBoldHotkey = isKeyHotkey("mod+b");
const isItalicHotkey = isKeyHotkey("mod+i");
const isUnderlinedHotkey = isKeyHotkey("mod+u");
const isCodeHotkey = isKeyHotkey("mod+`");

class ContentEditor extends React.Component {
  constructor(props) {
    super(props);
    const { blockMap } = props;

    this.state = {
      isInside: false,
      value: blockMap ? Value.fromJSON(blockMap) : initialValue,
      contentLoading: false,
      hyperlink: { label: null, url: null },
      image: { src: null, alt: null }
    };
  }

  componentDidUpdate() {
    const { mouseEvent, ruleIndex, rules } = this.props;
    const { isInside } = this.state;

    if (mouseEvent) {
      const contentEditor = this.editorDiv.getBoundingClientRect();

      const isInsideX =
        mouseEvent.clientX >= contentEditor.x &&
        mouseEvent.clientX <= contentEditor.x + contentEditor.width;
      const isInsideY =
        mouseEvent.clientY >= contentEditor.y &&
        mouseEvent.clientY <= contentEditor.y + contentEditor.height;

      if (!isInside && isInsideX && isInsideY)
        this.setState({ isInside: true });

      if (isInside && !(isInsideX && isInsideY))
        this.setState({ isInside: false });
    }

    if (ruleIndex !== null && isInside) {
      this.setState({ isInside: false });

      const rule = rules[ruleIndex];

      rule.conditions.forEach(condition => {
        this.editor.insertBlock({
          type: "condition",
          data: {
            conditionId: condition.conditionId,
            ruleIndex
          }
        });
      });

      this.editor.insertBlock({
        type: "condition",
        data: {
          label: "else",
          conditionId: rule.catchAll,
          ruleIndex
        }
      });
    }
  }

  generateLabel = (ruleIndex, conditionId) => {
    const { rules, types } = this.props;
    const rule = rules[ruleIndex];

    if (!rule) return "MISSING_RULE";

    const condition = rule.conditions.find(
      condition => condition.conditionId === conditionId
    );

    const operatorMap = {
      "==": "="
    };

    const transformValues = (type, configuration) => {
      const valueKeys = ["rangeFrom", "rangeTo", "comparator"];
      valueKeys.forEach(key => {
        if (!configuration[key]) return;

        if (type === "date")
          configuration[key] = configuration[key].slice(0, 10);
      });

      return configuration;
    };

    let label = [];
    rule.parameters.forEach((parameter, parameterIndex) => {
      let configuration = transformValues(
        types[parameter],
        condition.formulas[parameterIndex]
      );

      let operator = configuration.operator;
      if (operator === "between") {
        label.push(`${parameter} >= ${configuration.rangeFrom}`);
        label.push(`${parameter} <= ${configuration.rangeTo}`);
      } else if (configuration.comparator) {
        operator = operator in operatorMap ? operatorMap[operator] : operator;
        label.push(`${parameter} ${operator} ${configuration.comparator}`);
      } else {
        label.push(`${parameter} ${operator}`);
      }
    });

    label = label.join(", ");

    return label;
  };

  renderMarkButton = (type, icon) => {
    const isActive = this.hasMark(type);

    return (
      <i
        className={`material-icons ${isActive ? "active" : ""}`}
        onMouseDown={event => this.onClickMark(event, type)}
      >
        {icon}
      </i>
    );
  };

  renderBlockButton = (type, icon) => {
    let isActive = this.hasBlock(type);

    if (["numbered-list", "bulleted-list"].includes(type)) {
      const { document, blocks } = this.state.value;

      if (blocks.size > 0) {
        const parent = document.getParent(blocks.first().key);
        isActive = this.hasBlock("list-item") && parent && parent.type === type;
      }
    }

    return (
      <i
        className={`material-icons ${isActive ? "active" : ""}`}
        onMouseDown={event => this.onClickBlock(event, type)}
      >
        {icon}
      </i>
    );
  };

  hasMark = type => {
    const { value } = this.state;
    return value.activeMarks.some(mark => mark.type === type);
  };

  onClickMark = (event, type) => {
    event.preventDefault();
    this.editor.toggleMark(type);
  };

  renderMark = props => {
    const { children, mark, attributes } = props;

    switch (mark.type) {
      case "bold":
        return <strong {...attributes}>{children}</strong>;
      case "code":
        return <code {...attributes}>{children}</code>;
      case "italic":
        return <em {...attributes}>{children}</em>;
      case "underlined":
        return <u {...attributes}>{children}</u>;
      case "span":
        return (
          <span style={parseStyles(mark.data.get("style"))} {...attributes}>
            {children}
          </span>
        );
      default:
        return;
    }
  };

  hasBlock = type => {
    const { value } = this.state;
    return value.blocks.some(node => node.type === type);
  };

  onClickBlock = (event, type) => {
    event.preventDefault();
    const { value } = this.state;
    const { document } = value;

    // Handle everything but list buttons.
    if (type !== "bulleted-list" && type !== "numbered-list") {
      const isActive = this.hasBlock(type);
      const isList = this.hasBlock("list-item");

      if (isList) {
        this.editor
          .setBlocks(isActive ? DEFAULT_NODE : type)
          .unwrapBlock("bulleted-list")
          .unwrapBlock("numbered-list");
      } else {
        this.editor.setBlocks(isActive ? DEFAULT_NODE : type);
      }
    } else {
      // Handle the extra wrapping required for list buttons.
      const isList = this.hasBlock("list-item");
      const isType = value.blocks.some(block => {
        return !!document.getClosest(block.key, parent => parent.type === type);
      });

      if (isList && isType) {
        this.editor
          .setBlocks(DEFAULT_NODE)
          .unwrapBlock("bulleted-list")
          .unwrapBlock("numbered-list");
      } else if (isList) {
        this.editor
          .unwrapBlock(
            type === "bulleted-list" ? "numbered-list" : "bulleted-list"
          )
          .wrapBlock(type);
      } else {
        this.editor.setBlocks("list-item").wrapBlock(type);
      }
    }
  };

  renderBlock = props => {
    const { colours } = this.props;
    const { attributes, children, node } = props;

    switch (node.type) {
      case "paragraph":
        return <p {...attributes}>{children}</p>;
      case "bulleted-list":
        return <ul {...attributes}>{children}</ul>;
      case "heading-one":
        return <h1 {...attributes}>{children}</h1>;
      case "heading-two":
        return <h2 {...attributes}>{children}</h2>;
      case "list-item":
        return <li {...attributes}>{children}</li>;
      case "numbered-list":
        return <ol {...attributes}>{children}</ol>;
      case "link":
        let href = node.data.get("href");
        if (!(href.startsWith("http://") || href.startsWith("https://")))
          href = `//${href}`;
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
      case "image":
        const src = node.data.get("src");
        const alt = node.data.get("alt");
        return (
          <img
            {...attributes}
            src={src}
            alt={alt}
            style={{ maxWidth: "100%" }}
          />
        );
      case "attribute":
        const field = node.data.get("field");
        return (
          <span
            {...attributes}
            style={{
              display: "inline-block",
              padding: "0 5px",
              lineHeight: "1.25em",
              background: "#eee"
            }}
          >
            {field}
          </span>
        );
      case "condition":
        const ruleIndex = node.data.get("ruleIndex");
        const conditionId = node.data.get("conditionId");
        // The "else" blocks have a label of "else",
        // otherwise generate a name for the condition based on
        // the condition parameters
        let label = node.data.get("label");
        if (!label) label = this.generateLabel(ruleIndex, conditionId);

        return (
          <div
            className="condition_block"
            style={{ borderColor: colours[ruleIndex] }}
          >
            <div
              className="condition_name"
              style={{ color: colours[ruleIndex] }}
            >
              If <strong>{label}</strong>:
            </div>
            {children}
          </div>
        );
      default:
        return;
    }
  };

  onKeyDown = (event, change) => {
    if (event.key === "Enter" && !event.shiftKey) {
      const { value } = change;
      const { startBlock } = value;
      if (startBlock.type !== "list-item")
        return change.insertBlock("paragraph");
    }

    let mark;
    if (isBoldHotkey(event)) {
      mark = "bold";
    } else if (isItalicHotkey(event)) {
      mark = "italic";
    } else if (isUnderlinedHotkey(event)) {
      mark = "underlined";
    } else if (isCodeHotkey(event)) {
      mark = "code";
    } else {
      return;
    }

    event.preventDefault();
    change.toggleMark(mark);
    return true;
  };

  onChange = ({ value }) => {
    this.setState({ value });
  };

  generateHtml = () => {
    const { value } = this.state;

    const html = new Html({ rules });
    const output = value.document.nodes.map(node => {
      const pseudoValue = { document: { nodes: [node] } };
      return html.serialize(pseudoValue);
    });

    return [...output];
  };

  FontButton = () => {
    // Get Font of Current Selection

    return (
      <Select
        showSearch
        placeholder="Choose a font"
        size="small"
        value={undefined}
        onChange={field => this.onChangeFont(field)}
        // onChange={field => {
        //   change.insertInline({
        //     type: "attribute",
        //     data: { field },
        //     isVoid: true
        //   });
        //   this.onChange(change);
        // }}
        className="attribute_select"
        dropdownMatchSelectWidth={false}
        filterOption={(input, option) =>
          option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
        }
      >
        {FontFamilyList.map((item, i) => (
          <Select.Option value={item.name} key={i}>
            {item.name}
          </Select.Option>
        ))}
      </Select>
    );
  };

  onChangeFont = (font) => {
    const type = "fontFamily";

    console.log(font);
    // Remove Current Font
    let value = this.state.value;
    const fontMarks = value.marks.filter(mark => mark.type === type);
    fontMarks.map(mark => {
      this.editor.removeMark(mark);
    });

    const data = {
      'style': `fontFamily: ${font}`
    }

    // Add new font
    value = this.state.value;
    this.editor.addMark({ type, data });
  };

  ColourButton = () => {
    const { value } = this.state;

    // Get current colour of selection (May need refactoring)
    let oldColor = "#000000"
    const marks = value.marks.toJSON();
    const markObj = marks.find(obj => obj.type === "span");
    // Requires span mark w/ color in style
    if (typeof markObj !== 'undefined') {
      const style = parseStyles(markObj.data.style);
      if ("color" in style) {
        oldColor = style.color;
      }
    }

    return (
      <Popover
        content={
          <SketchPicker
            color={oldColor}
            onChangeComplete={(color, event) => this.onChangeColor(color, event)}
          />
        }
      >
        <i
          className="material-icons"
          style={{ color: oldColor }}
        >
          format_color_text
        </i>
      </Popover>
    );
  };

  onChangeColor = (color, event) => {
    // Remove Current Color
    const type = 'span';
    let value = this.state.value;
    const spanMarks = value.marks.filter(mark => mark.type === type);
    spanMarks.map(mark => {
      this.editor.removeMark(mark);
    });

    // Add new color
    const data = {
      'style': `color: ${color.hex}`
    }

    value = this.state.value;
    this.editor.addMark({ type, data });
  }

  LinkButton = () => {
    const { hyperlink } = this.state;

    return (
      <Popconfirm
        icon={null}
        title={
          <div className="action_toolbar_popup">
            <Input
              placeholder="Label"
              size="small"
              onChange={e =>
                this.setState({
                  hyperlink: { ...hyperlink, label: e.target.value }
                })
              }
              value={hyperlink.label}
            />
            <Input
              placeholder="URL"
              size="small"
              onChange={e =>
                this.setState({
                  hyperlink: { ...hyperlink, url: e.target.value }
                })
              }
              value={hyperlink.url}
            />
          </div>
        }
        onVisibleChange={visible => {
          if (!visible)
            this.setState({ hyperlink: { label: null, url: null } });
        }}
        onConfirm={() => {
          if (!(hyperlink.label && hyperlink.url)) return;

          this.editor
            .insertText(hyperlink.label)
            .moveFocusBackward(hyperlink.label.length)
            .wrapInline({
              type: "link",
              data: { href: hyperlink.url }
            })
            .moveToEnd();
        }}
      >
        <i className="material-icons">insert_link</i>
      </Popconfirm>
    );
  };

  ImageButton = () => {
    const { image } = this.state;

    return (
      <Popconfirm
        icon={null}
        title={
          <div className="action_toolbar_popup">
            <Input
              placeholder="Image URL"
              size="small"
              onChange={e =>
                this.setState({
                  image: { ...image, src: e.target.value }
                })
              }
              value={image.src}
            />
            <Input
              placeholder="Description/Alt tag"
              size="small"
              onChange={e =>
                this.setState({
                  image: { ...image, alt: e.target.value }
                })
              }
              value={image.alt}
            />
          </div>
        }
        onVisibleChange={visible => {
          if (!visible) this.setState({ image: { src: null, alt: null } });
        }}
        onConfirm={() => {
          this.editor.insertInline({
            type: "image",
            data: { src: image.src, alt: image.alt },
            isVoid: true
          });
        }}
      >
        <i className="material-icons">insert_photo</i>
      </Popconfirm>
    );
  };

  onPaste = (event, change) => {
    const transfer = getEventTransfer(event);
    if (transfer.type !== "html") return;

    const sanitizedHtml = sanitizeHtml(transfer.html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "h1",
        "h2",
        "span",
        "img",
        "u"
      ]),
      allowedAttributes: {
        "*": ["style"],
        a: ["href", "name", "target"],
        img: ["src"]
      },
      allowedStyles: {
        "*": {
          color: [/^.*$/]
          // "font-size": [/^.*$/],
          // "font-family": [/^.*$/]
        }
      },
      transformTags: {
        b: sanitizeHtml.simpleTransform("strong"),
        i: sanitizeHtml.simpleTransform("em")
      }
    });

    const html = new Html({ rules });
    const { document } = html.deserialize(sanitizedHtml);
    change.insertFragment(document);

    return true;
  };

  AttributeButton = () => {
    const { order } = this.props;

    return (
      <Select
        placeholder="Add a field"
        size="small"
        value={undefined}
        onChange={field => {
          this.editor.insertInline({
            type: "attribute",
            data: { field },
            isVoid: true
          });
        }}
        className="attribute_select"
        dropdownMatchSelectWidth={false}
      >
        {order.map((item, i) => (
          <Select.Option value={item} key={i}>
            {item}
          </Select.Option>
        ))}
      </Select>
    );
  };

  previewContent = () => {
    const { onPreview } = this.props;
    const { value } = this.state;

    const content = {
      blockMap: value.toJSON(),
      html: this.generateHtml()
    };

    this.setState({ error: null, previewing: true });

    onPreview({
      content,
      onSuccess: () => this.setState({ previewing: false }),
      onError: error => this.setState({ error })
    });
  };

  updateContent = () => {
    const { onUpdate } = this.props;
    const { value } = this.state;

    const content = {
      blockMap: value.toJSON(),
      html: this.generateHtml()
    };

    this.setState({ error: null, loading: true });

    onUpdate({
      content,
      onSuccess: () => this.setState({ loading: false }),
      onError: error => this.setState({ error })
    });
  };

  render() {
    const { value, isInside, previewing, loading } = this.state;

    return (
      <div>
        <div className="toolbar">
          {this.renderMarkButton("bold", "format_bold")}
          {this.renderMarkButton("italic", "format_italic")}
          {this.renderMarkButton("underlined", "format_underlined")}
          {this.renderMarkButton("code", "code")}
          {this.FontButton()}
          {this.ColourButton()}
          {this.LinkButton()}
          {this.ImageButton()}
          {this.renderBlockButton("heading-one", "looks_one")}
          {this.renderBlockButton("heading-two", "looks_two")}
          {this.renderBlockButton("paragraph", "short_text")}
          {this.renderBlockButton("numbered-list", "format_list_numbered")}
          {this.renderBlockButton("bulleted-list", "format_list_bulleted")}
          {this.AttributeButton()}
        </div>

        <Editor
          className={`content_editor ${isInside ? "isInside" : ""}`}
          value={value}
          ref={editor => (this.editor = editor)}
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          renderBlock={this.renderBlock}
          renderMark={this.renderMark}
          renderEditor={props => (
            <div ref={editor => (this.editorDiv = editor)}>{props.children}</div>
          )}
          plugins={plugins}
          placeholder={"Create content by entering text here"}
          onPaste={this.onPaste}
        />

        <div style={{ marginTop: "10px" }}>
          <Button
            loading={previewing}
            style={{ marginRight: "10px" }}
            size="large"
            onClick={this.previewContent}
          >
            Preview
          </Button>
          <Button
            loading={loading}
            type="primary"
            size="large"
            onClick={this.updateContent}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }
}

export default ContentEditor;
