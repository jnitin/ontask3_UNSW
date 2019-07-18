import React from "react";

function Rules(options) {
  const { rules, types, colours } = options;

  return {
    renderNode(props, editor, next) {
      const { attributes, children, node } = props;
      console.log("HEY");
      switch (node.type) {
        case "condition":
          console.log("HI");
          const ruleIndex = node.data.get("ruleIndex");
          const conditionId = node.data.get("conditionId");
          // The "else" blocks have a label of "else",
          // otherwise generate a name for the condition based on
          // the condition parameters
          let label = node.data.get("label");
          if (!label) label = generateLabel(ruleIndex, conditionId, rules, types);

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
          return next();
      };
    }
  };
};

export function generateLabel(ruleIndex, conditionId, rules, types) {
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

export default Rules;