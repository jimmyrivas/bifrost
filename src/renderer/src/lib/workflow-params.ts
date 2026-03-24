/**
 * Parameterized Workflow Engine
 * Detects {{param}} placeholders in commands and prompts user for values.
 */

const PARAM_REGEX = /\{\{(\w+)(?::([^}]*))?\}\}/g

export interface WorkflowParam {
  name: string
  defaultValue: string
}

/**
 * Extract parameter names from a command template.
 */
export function extractParams(template: string): WorkflowParam[] {
  const params: WorkflowParam[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  PARAM_REGEX.lastIndex = 0
  while ((match = PARAM_REGEX.exec(template)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1])
      params.push({ name: match[1], defaultValue: match[2] ?? '' })
    }
  }
  return params
}

/**
 * Check if a command contains parameters.
 */
export function hasParams(template: string): boolean {
  PARAM_REGEX.lastIndex = 0
  return PARAM_REGEX.test(template)
}

/**
 * Resolve parameters in a template with provided values.
 */
export function resolveParams(template: string, values: Record<string, string>): string {
  return template.replace(PARAM_REGEX, (_match, name: string, defaultVal?: string) => {
    return values[name] ?? defaultVal ?? ''
  })
}

/**
 * Prompt user for all parameters using window.prompt.
 * Returns null if user cancels any prompt.
 */
export function promptForParams(template: string): string | null {
  const params = extractParams(template)
  if (params.length === 0) return template

  const values: Record<string, string> = {}
  for (const param of params) {
    const value = window.prompt(
      `Enter value for "${param.name}":`,
      param.defaultValue
    )
    if (value === null) return null // cancelled
    values[param.name] = value
  }

  return resolveParams(template, values)
}
