declare type SchemaFieldValidator = null | Boolean | Number | String
declare type SchemaFieldValue = boolean | null | number | number[] | string | string[]
declare type SchemaInputType = 'date' | 'datelist' | 'list' | 'number' | 'numberlist' | 'text'
declare type SchemaMatchType = 'all' | 'any' | 'none' | 'one'
declare type SchemaOptionType = 'default' | 'match' | 'template' | 'text'
declare type SchemaSatisfyType = 'all' | 'any' | 'none'
declare type SchemaSection = 'description' | 'evaluation'
declare type SchemaStructure = {
    /** Valid section names for field references. */
    REF_SECTIONS: ReportSection[]
    /** Shorthand references to section/field pairs. */
    SECTION_FIELD_REFS: SectionFieldReferences[]
    /** Valid option types. */
    OPTION_TYPES: (SchemaOptionType | undefined)[]
    /** Valid form and report sections. */
    SECTIONS: ('section' | (ReportSection | undefined)[])[]
    /** Array of valid schema field value types. */
    VALUE_TYPES: SchemaFieldValidator[]
    /**  Valid field values. */
    FIELD_VALUES: ('value' | SchemaFieldValidator | undefined)[]
    /** Regular expression matching both section [1] and field [2] in the same parameter. */
    SECTION_FIELD: RegExp
    /** Properties of values to fetch from the form or report. */
    VALUES_LIST: ([('field' | 'section'), String] | SectionFieldReferences | RegExp | undefined)[]
    /** Scope of the match operation. */
    MATCH_SCOPES: (SchemaMatchType | undefined)[]
    /** Condition satisfy scope. */
    SATISFY_SCOPES: (SchemaSatisfyType | undefined)[]
    /** Possible types for textual input. */
    INPUT_TYPES: (SchemaInputType | undefined)[]
    /** Assign a value to a variable if the field/option conditions are met. */
    ASSING_VARIABLE: (['variable', String] | ['value', SchemaFieldValidator] | undefined)[]
    /** Conditions that the match operation must fulfill. */
    MATCH_CONDITIONS: SchemaTemplateConditionsStructure
    /** Options to match against. */
    MATCH_OPTIONS: TemplateOptionsStructure
    /** Top level field list. */
    FIELD_LIST: [
        'fields',
        (
            ['name', String] |
            ['assign', SchemaStructure['ASSING_VARIABLE']] |
            ['field', [RegExp, String, undefined]] |
            ['input', SchemaStructure['INPUT_TYPES']] |
            ['match', SchemaStructure['MATCH_SCOPES']] |
            ['satisfy', SchemaStructure['SATISFY_SCOPES']] |
            ['template', [String, undefined]] |
            ['text', [String, undefined]] |
            ['type', String] |
            ['value', SchemaFieldValidator] |
            ['values', SchemaStructure['VALUES_LIST']] |
            ['default', SchemaFieldValidator] |
            SchemaTemplateConditionsStructure |
            SchemaStructure['SECTIONS'] |
            SectionFieldReferences |
            undefined
        )[]
    ]
}
declare type SchemaTemplate = {
    label: string
    version: string
} & SchemaStructure['FIELD_LIST']
declare type SchemaTemplateCondition = {
    description?: string
    evaluation?: string
    field?: string
    group?: string
    operator?: SchemaTemplateOperator
    section?: ReportSection
    value?: SchemaFieldValue
    variable?: string
}
declare type SchemaTemplateConditionsStructure = [
    string,
    (
        ([string, boolean | SchemaFieldValue[]]) | SchemaTemplateConditionsStructure | undefined
    )[]
]
declare type SchemaTemplateInputCondition = {
    /** The fields to check. */
    fields: {
        /** Name of the field (in the same scope). */
        name: string
        /** The field values to check for (matching any). Optional to `empty`. */
        values?: boolean[] | number[] | string[] | null[]
        /** Whether the field should be empty or not. Optional to `values`. */
        empty?: boolean
    }[]
    /** The default value to assign to this field if condition is met. */
    default?: SchemaFieldValue
    /** Didable this field if condition is met. */
    disabled?: boolean
    /** Hide this field if condition is met. */
    hidden?: boolean
}
declare type SchemaTemplateInputConfiguration = {
    label: string
    version: string
    fields: SchemaTemplateInputField[]
}
declare type SchemaTemplateInputField = {
    /**
     * Variables to assign if this field is matched successfully.
     *
     * Can either be a string with the variable name (the variable will be assigned as `true`), or an object with
     * variable name and the value to assign.
     */
    assing?: (string | {
        /** Name of the variable. */
        variable: string
        /** Value to assign. */
        value: SchemaFieldValidator
    })[]
    /** Conditions that must be met if this field is to be included. */
    conditions?: SchemaTemplateInputCondition[]
    /** Default value of this field. For select fields this is the index of the default option. */
    default?: SchemaFieldValue
    /** Description section field name to fetch value from. */
    description?: string
    /** Evaluation section field name to fetch value from. */
    evaluation?: string
    /** Should the field expand to the end of the row. */
    expand?: boolean
    /** Field name to get value from. */
    field?: string
    /** Is this field a free text input. */
    freetext?: boolean
    /** Icon to use at the start of the field. */
    icon?: string
    /** Group items. */
    items?: SchemaTemplateInputField[]
    /** Label to use for this field. */
    label?: string
    /** Which options to match. */
    match?: SchemaMatchType
    /** Unique name of this field. */
    name?: string
    /** Select field options. */
    options?: (string | number)[]
    /** Placeholder text to show on empty field. */
    placeholder?: string
    /** Conditions to satisfy. */
    satisfy?: SchemaSatisfyType
    /** Section to fetch value from. */
    section?: ReportSection
    /** Should a separator be shown after this field (only applies to 'break' type). */
    separator?: boolean
    /** Template to use as result string. */
    template?: string
    /** Static text to use as result string. */
    text?: string
    /** Type of the field. */
    type?: SchemaTemplateInputFieldType
    /** CSS width value for this field. */
    width?: string
}
declare type SchemaTemplateInputFieldType = 'break' | 'group' | 'header' | 'input' | 'label' | 'module' | 'select' |
                                            'section:end' | 'section:start' | 'switch' | 'textarea' | 'variable'
declare type SchemaTemplateOperator = 'ends-with' | 'greater-than' | 'less-than' | 'not' | 'starts-with'
declare type SchemaTemplateReport = {
    /** Name of the report. */
    name: string
    /** Version of the report schema. */
    version: string
    /** Report fields. */
    fields: SchemaTemplateReportField[]
}
declare type SchemaTemplateReportField = {
    /** Name of the field. */
    name: string
    /** Field value. */
    value: SchemaFieldValue
    /** Field type. */
    type: SchemaTemplateReportFieldType
    /** Conditions that must be met if this field is to be included. */
    conditions?: SchemaTemplateCondition[]
    /** Delimiter to use to separate group fields. */
    delimiter?: string
    /** Description section field name to fetch value from. */
    description?: string
    /** Evaluation section field name to fetch value from. */
    evaluation?: string
    /** Set of group fields to parse. */
    fields?: {
        /** Group item to check. */
        item: string
        /** Options for the item value. */
        options: {
            /** Conditions to check the value against. */
            conditions: {
                value: string | number | boolean | string[] | number[] | null
                operator?: SchemaTemplateOperator
            }[]
            /** Text to return if conditions are met. */
            text: string
        }
        /** Is this item required to meet conditions for the field string to be returned. */
        required?: boolean
    }[]
    /** Field label. */
    label?: string
    /** Field icon. */
    icon?: string
    /** Field input type hint for the parser. */
    input?: SchemaInputType
    /** Field options to match. */
    options?: SchemaTemplateReportOption[]
}
declare type SchemaTemplateReportFieldType = 'group' | 'match' | 'newline' | 'paragraph' | 'period' | 'text' |
                                             'variable'
declare type SchemaTemplateReportOption = {
    /** The description section field name to get the value from. */
    description?: string
    /** The evaluation section field name to get the value from. */
    evaluation?: string
    /** The field name to get the value from. */
    field?: string
    /** The field section to get the value from. */
    section?: ReportSection
    /** The template to use if this option's conditions are met. */
    template?: string
    /** The static string to return if this option's conditions are met. */
    text?: string
    /** Type of the option. */
    type?: SchemaTemplateReportOptionType
}
declare type SchemaTemplateReportOptionType = 'default' | 'template' | 'text'
declare type SectionFieldReferences = [ReportSection, [StringConstructor, undefined]]
