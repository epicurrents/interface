/** Valid section names for field references. */
export const REF_SECTIONS = ['description', 'evaluation', 'parsed'] as ReportSection[]
/** Shorthand references to section/field pairs. */
export const SECTION_FIELD_REFS = REF_SECTIONS.map(s => [s, [String, undefined]] as SectionFieldReferences)
/** Valid option types. */
export const OPTION_TYPES = ['default', 'match', 'value', undefined]
/** Valid form and report sections. */
export const SECTIONS = ['section', [...REF_SECTIONS, undefined]]
/** Array of valid schema field value types. */
export const VALUE_TYPES = [null, Boolean, Number, String, undefined]
/**  Valid field values. */
export const FIELD_VALUES = ['value', VALUE_TYPES]
/** Regular expression matching both section [1] and field [2] in the same parameter. */
export const SECTION_FIELD = /(.+?):(.+?)/
/** Properties of values to fetch from the form or report. */
export const VALUES_LIST = [['section', String], ['field', String], SECTION_FIELD_REFS, SECTION_FIELD, undefined]
/** Scope of the match operation. */
export const MATCH_SCOPES = ['all', 'any', 'none', 'one', undefined]
/** Condition satisfy scope. */
export const SATISFY_SCOPES = ['all', 'any', 'none', undefined]
/** Possible types for textual input. */
export const INPUT_TYPES = ['date', 'datelist', 'list', 'number', 'numberlist', 'text', undefined]
/** Assign a value to a variable if the field/option conditions are met. */
export const ASSING_VARIABLE = [['variable', String], ['value', VALUE_TYPES], undefined]
/** Conditions that the match operation must fulfill. */
export const MATCH_CONDITIONS = ['conditions', [
    ['empty', [Boolean, undefined]],
    ['field', [SECTION_FIELD, String, undefined]],
    ['group', [String, undefined]],
    ['operator', [String, undefined]],
    ['variable', [String, undefined]],
    FIELD_VALUES,
    MATCH_SCOPES,
    SECTIONS,
    ...SECTION_FIELD_REFS,
    undefined
]] as SchemaTemplateConditionsStructure
MATCH_CONDITIONS[1].push(MATCH_CONDITIONS)
/** Options to match against. */
export const MATCH_OPTIONS = ['options', [
    ['assign', ASSING_VARIABLE],
    ['field', [String, undefined]],
    ['input', INPUT_TYPES],
    ['group', [String, undefined]],
    ['match', MATCH_SCOPES],
    ['satisfy', SATISFY_SCOPES],
    ['template', [String, undefined]],
    ['text', [String, undefined]],
    ['type', OPTION_TYPES],
    ['values', VALUES_LIST],
    ['default', VALUE_TYPES],
    FIELD_VALUES,
    MATCH_CONDITIONS,
    SECTIONS,
    ...SECTION_FIELD_REFS,
]] as TemplateOptionsStructure
// Allow nested match options.
MATCH_OPTIONS[1].push(MATCH_OPTIONS)
/** Top level field types. */
export const FIELD_TYPES = [
    'dynamic',
    'group',
    'list',
    'match',
    'newline',
    'paragraph',
    'period',
    'template',
    'text',
    'variable',
]
/** Top level field list. */
export const FIELD_LIST = ['fields', [
    ['name', String],
    ['assign', ASSING_VARIABLE],
    ['field', [SECTION_FIELD, String, undefined]],
    ['input', INPUT_TYPES],
    ['match', MATCH_SCOPES],
    ['newline', [Boolean, undefined]],
    ['paragraph', [Boolean, undefined]],
    ['satisfy', SATISFY_SCOPES],
    ['template', [String, undefined]],
    ['text', [String, undefined]],
    ['title', [String, undefined]],
    ['type', FIELD_TYPES],
    ['value', VALUE_TYPES],
    ['values', VALUES_LIST],
    ['default', VALUE_TYPES],
    MATCH_CONDITIONS,
    MATCH_OPTIONS,
    SECTIONS,
    ...SECTION_FIELD_REFS,
    undefined,
]] as [string, any[]]
export const REPORT_SCHEMA = [
    FIELD_LIST,
    ['label', String],
    ['version', String],
]
export default REPORT_SCHEMA
