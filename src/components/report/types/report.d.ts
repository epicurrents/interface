declare type ConditionOperator = "ends-with" | "not" | "greater-than" | "less-than" | "longer-than" |
                                 "shorter-than" | "starts-with"
declare type ConditionSatisfyType = "all" | "any" | "none"
declare type ParserFieldEntry = {
    names: string[],
    pattern: RegExp,
    types: string[]
}
/**
 * A field that forms a part of the report text.
 */
declare type ReportField = {
    /** Field type (only visible types). */
    type: "bullet" | "newline" | "paragraph" | "period" | "text"
    /** Automatically created content for this field, if the field type is text. */
    autoText?: string
    /** Has the content of this field been completely deleted. */
    deleted?: boolean
    /** Has the content of this field been edited. */
    edited?: boolean
    /** Poissible errors in this field. */
    errors?: string[]
    /** Possible list of source form fields that affect the content of this report field, if field type is `text`. */
    sources?: {
        /** Form field name. */
        field: string
        /** Form field section. */
        section: ReportSection
    }[]
    /** Content of this field if field type is `text`. */
    text?: string
}
declare type ReportSection = "description" | "evaluation" | "parsed" | "variable"
declare type ReportTemplate = {
    fields: TemplateField[]
    label: string
    version: string
}
declare type TemplateField = {
    options: TemplateFieldOption[]
    name: string
    assign?: TemplateVariableAssign[]
    /** Conditions that must be met for this field. */
    conditions?: TemplateFieldCondition[]
    default?: TemplateFieldValue
    /** Delimiter to separate group rows in the report. */
    delimiter?: string
    field?: string
    fields?: TemplateField[]
    input?: TemplateFieldInput
    /** Possible group item name. */
    item?: string
    match?: TemplateMatchType
    /** Is this group on its own line. */
    newline?: boolean
    /** Is this group in its own paragraph. */
    paragraph?: boolean
    /** Is this group item required to be non-null. */
    required?: boolean
    /** What conditions must be satisfied (default 'all'). */
    satisfy?: ConditionSatisfyType
    section?: ReportSection
    /** A text template for inserting dynamic values. */
    template?: string
    /** Title to prepend this group with. */
    title?: string
    /** A static text element. */
    text?: string
    type?: TemplateFieldType
    value?: string
    values?: TemplateFieldReference[]
} & TemplateFieldSection
declare type TemplateFieldCondition = {
    field: string
    section: ReportSection
    value: TemplateFieldValue | TemplateFieldValue[]
    conditions?: TemplateFieldCondition[]
    /** Should this text or select field be empty. */
    empty?: boolean
    group?: string
    operator?: ConditionOperator
    /** Which of the **nested** conditions must be satisfied. */
    satisfy?: ConditionSatisfyType
    variable?: string
} & TemplateFieldSection
/**
 * Input type for a field for possible localized conversion.
 * - `date`: A date input.
 * - `datelist`: A list of dates.
 * - `list`: A list of strings.
 * - `number`: A number input.
 * - `numberlist`: A list of numbers.
 * - `text`: A text input (default).
 */
declare type TemplateFieldInput = "date" | "datelist" | "list" | "number" | "numberlist" | "text"
declare type TemplateFieldReference = {
    field: string
    section: ReportSection
    value: TemplateFieldValue
}
declare type TemplateFieldOption = {
    assign?: TemplateVariableAssign[]
    /** Conditions that must be met for this option. */
    conditions?: TemplateFieldCondition[]
    default?: TemplateFieldValue
    field?: string
    input?: TemplateFieldInput
    match?: TemplateMatchType
    /**
     * Nested options to go through if the parent option is a match.
     * If none of the `options` match, the parent option's `values` are returned instead (if present).
     */
    options?: TemplateFieldOption[]
    /** What conditions must be satisfied (default 'all'). */
    satisfy?: ConditionSatisfyType
    section?: ReportSection
    /** Type of match to expect from the conditions. */
    type?: "default" | "match" | "template" | "text"
    /**
     * Template for text to be added to the report if the label is matched. Either `template` or `text` must be defined.
     */
    template?: string
    /** This text is added to the report if the label is matched. Either `template` or `text` must be defined. */
    text?: string
    values?: TemplateFieldReference[]
} & TemplateFieldSection
declare type TemplateFieldSection = {
    description?: string
    evaluation?: string
    parsed?: string
    variable?: string
}
declare type TemplateFieldType = "break" | "bullet" | "dynamic" | "group" | "list" | "match" | "module" | "newline" |
                                 "paragraph" | "period" | "template" | "text" | "variable"
declare type TemplateFieldValue = boolean | number | number[] | string | string[] | null
declare type TemplateOptionsStructure = [
    string,
    (
        ([string, SchemaFieldValue[]]) | TemplateOptionsStructure
    )[]
]
declare type TemplateMatchType = "all" | "any" | "none" | "one"
declare type TemplateVariableAssign = {
    variable: string
    value: TemplateFieldValue
}
declare type SchemaItem = [string, any]
