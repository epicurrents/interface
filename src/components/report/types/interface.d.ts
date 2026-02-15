declare type ConditionalFieldDefault = {
    /** Value to apply if a condition is met. */
    default: SchemaFieldValue
    /** The set of form fields that can satisfy the condition. */
    fields: {
        /** Field name. */
        name: string
        /** Should the field be empty or not. Alternative to `values`. */
        empty?: boolean
        /** Set of values ANY of which satisfies the condition. Alternative to `empty`. */
        values?: SchemaFieldValue[]
        /** Section of the field, defaults to the same section as the field with this condition. */
        section?: SchemaSection
    }[]
    /** Possible dsiabled state to apply. */
    disabled?: boolean
    /** Possible hidden state to apply. */
    hidden?: boolean
}
declare interface FormFieldParser {
    /**
     * parseFields is a method that takes as an argument a map of line arrays that
     * contains all the relevant field names and values. It returns an object with
     * parsing results as key-value pairs.
     * @param fields - Field values of interest as Map<section:field, value split into lines>.
     * @returns Process result as Map<key, value>.
     */
    parseFields: (fields: Map<string, string[]>) => Map<string, SchemaFieldValue>
}
declare type ReportCategory = {
    name: string
    model: {
        description: ReportModel
        evaluation: ReportModel
    }
    schemas: Map<string, ReporterSchema>
    setup: { default: string }
}
declare type ReportModel = {
    groups: Map<string, Map<string, SchemaFieldValue>[]>
    fields: Map<string, SchemaFieldValue>
}
declare type ReporterSchema = {
    description: Map<string, ReporterSchemaField> | null
    evaluation: Map<string, ReporterSchemaField> | null
    label: string
    name: string
    parsers: Map<string, FormFieldParser>
    report: ReportTemplate | null
}
declare type ReporterSchemaField = {
    conditions: ConditionalFieldDefault[]
    dependencies: string[]
    edited: boolean
    label: string
    items: ReporterSchemaField[]
    name: string
    rows: ReporterSchemaField[][]
    type: string
    value: SchemaFieldValue
    width: string,
    align?: string
    /** A preset code value for this field. Valid codes depend on the field type:
     *
     * **label**:
     * - `dash`: A long dash character (–).
     * - `ellipsis`: An ellipsis character (…).
     */
    code?: number | string
    default?: SchemaFieldValue
    disabled?: boolean
    expand?: boolean
    fields?: ReporterSchemaField[]
    freetext?: boolean
    height?: number | string
    hidden?: boolean
    icon?: string
    /** Margin to add before the field element. */
    indent?: number | string
    /** Input field content type. */
    input?: 'date' | 'number' | 'text'
    multiple?: boolean
    options?: string[]
    paragraph?: boolean
    parser?: string
    placeholder?: string
    /** Text to insert into the prefix field of an input. */
    prefix?: string
    /** A horizontal line to separate section. */
    separator?: boolean
    size?: string
    /** Text to insert into the suffix field of an input. */
    suffix?: string
    text?: string
}
