import { Variable, VariableValue } from './types';

/**
 * Interpolate {{variableName}} tokens in text with actual variable values.
 * Example: "Hello, {{userName}}!" with userName = "World" → "Hello, World!"
 */
export function interpolateText(
  text: string,
  variables: Variable[],
  variableValues: VariableValue[]
): string {
  if (!text || !text.includes('{{')) return text;

  return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmedName = varName.trim();
    // First try runtime value
    const vv = variableValues.find(v => {
      const vDef = variables.find(def => def.id === v.variableId);
      return vDef?.name === trimmedName;
    });
    if (vv) return String(vv.value);
    // Fall back to default value
    const v = variables.find(v => v.name === trimmedName);
    if (v) return String(v.defaultValue);
    return match; // keep original if not found
  });
}

/**
 * Extract all variable names referenced in a text string.
 * Returns array of variable names (without the {{ }}).
 */
export function extractVariableRefs(text: string): string[] {
  if (!text) return [];
  const refs: string[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    refs.push(match[1].trim());
  }
  return refs;
}
