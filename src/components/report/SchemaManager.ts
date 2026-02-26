/**
 * Reporting tool schema manager.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { parseDocument } from 'yaml'
import { isArray, mergeWith } from 'lodash'
import { Log } from 'scoped-event-log'
import FormParser from './FormParser'

import {
    v1_0_0,
} from './schemas'

const SCOPE = 'SchemaManager'

export default class SchemaManager {

    modules = new Map<string, ReporterSchema>()
    parsers = new Map<string, Map<string, FormFieldParser>>()
    runningID = 0
    schema: SchemaStructure
    schemas = new Map<string, ReportCategory>()
    schemasLoaded = false
    version: string

    constructor (version = '1.0.0') {
        this.version = version
        if (version === '1.0.0') {
            this.schema = v1_0_0 as SchemaStructure
        } else {
            Log.error(`Schema version ${version} not found.`, SCOPE)
            this.schema = v1_0_0 as SchemaStructure
        }
    }

    convertFields (fields: (TemplateField | TemplateFieldOption)[], recursive = true) {
        for (let i=0; i<fields.length; i++) {
            const field = fields[i]
            if (!field.section) {
                for (const sectName of this.schema.REF_SECTIONS) {
                    if (Object.hasOwn(field, sectName)) {
                        field.section = sectName as ReportSection
                        field.field = field[sectName] as string
                        // Remove the shorthand reference from the item.
                        delete field[sectName]
                        break
                    }
                }
            }
            if (field.type === 'module' && field.section && field.name) {
                const mod = this.modules.get(field.name)?.[
                                field.section as keyof ReporterSchema
                            ] as ReportTemplate | undefined
                if (mod) {
                    // Replace the module with its fields.
                    fields.splice(i, 1,
                        ...mod.fields?.map(f => {
                            return { ...f }
                        })
                    )
                }
            }
            if (recursive) {
                if (field.options) {
                    this.convertFields(field.options)
                }
                if (field.conditions) {
                    this.convertFields(field.conditions)
                }
                if (field.values) {
                    this.convertFields(field.values)
                }
            }
        }
    }

    async parseModule (name: string, url: string | URL) {
        try {
            const newModule = parseDocument(
                await (await fetch(`${url}/setup.yaml`)).text()
            ).contents?.toJSON()
            if (newModule?.description || newModule?.evaluation) {
                const inputResponse = await fetch(`${url}/inputs.yaml`)
                if (inputResponse.ok) {
                    //console.log(await(await inputResponse.blob()).text())
                    const inputJson = parseDocument(await inputResponse.text()).contents?.toJSON()
                    if (inputJson.description) {
                        newModule.description = new Map<string, ReporterSchemaField>()
                        this.parseSectionProperties(
                            inputJson.description,
                            newModule.description
                        )
                    } else {
                        newModule.description = null
                    }
                    if (inputJson.evaluation) {
                        newModule.evaluation = new Map<string, ReporterSchemaField>()
                        this.parseSectionProperties(
                            inputJson.evaluation,
                            newModule.evaluation
                        )
                    } else {
                        newModule.evaluation = null
                    }
                } else {
                    Log.error(`${name} module inputs fetch error: ${inputResponse.statusText}.`, SCOPE)
                    return null
                }
            }
            if (newModule?.report) {
                const reportResponse = await fetch(`${url}/report.yaml`)
                if (reportResponse.ok) {
                    //console.log(await(await reportResponse.blob()).text())
                    const reportJson = parseDocument(await reportResponse.text()).contents?.toJSON()
                    newModule.report = reportJson || null
                    if (newModule.report?.fields.length) {
                        // Convert sections in the report fields.
                        this.convertFields(newModule.report.fields)
                    }
                } else {
                    Log.error(`${name} module report fetch error: ${reportResponse.statusText}.`, SCOPE)
                    return null
                }
            }
            return newModule
        } catch (e) {
            Log.error(`Failed to parse module ${name}.`, SCOPE, e as Error)
            return null
        }
    }

    async parseSchemas (url?: string | URL) {
        if (!url) {
            url = new URL('/report/setup.yaml', __EPICURRENTS__.SETUP.assetPath)
        }
        const schemas = await fetch(url)
        if (!schemas.ok) {
            Log.error(`Loading schema setup failed: ${schemas.statusText} (${schemas.status}).`, SCOPE)
            return false
        }
        const schemaText = await schemas.text()
        const setup = parseDocument(schemaText).contents?.toJSON()
        const rootUrl = setup.rootUrl
        if (!rootUrl) {
            Log.error('Schema setup is missing root URL.', SCOPE)
            return false
        }
        // First try to load modules
        if (setup.modules) {
            for (const mod of setup.modules.items) {
                const modSchema = await this.parseModule(mod, `${rootUrl}/${setup.modules.path}/${mod}`)
                this.modules.set(modSchema.name, modSchema)
            }
        }
        // Go through categories
        if (setup.categories) {
            for (const category of setup.categories) {
                try {
                    const catSetup = parseDocument(
                        await (await fetch(`${rootUrl}/${category}/setup.yaml`)).text()
                    ).contents?.toJSON()
                    if (!catSetup) {
                        Log.error(`Loading category ${category} setup failed.`, SCOPE)
                        continue
                    }
                    const newCategory = {
                        model: {
                            description: {
                                fields: new Map<string, SchemaFieldValue>(),
                                groups: new Map<string, Map<string, SchemaFieldValue>[]>(),
                            },
                            evaluation: {
                                fields: new Map<string, SchemaFieldValue>(),
                                groups: new Map<string, Map<string, SchemaFieldValue>[]>(),
                            }
                        },
                        name: category,
                        schemas: new Map<string, ReporterSchema>(),
                        setup: catSetup,
                    }
                    // Load possible category modules.
                    if (catSetup.modules) {
                        for (const catMod of catSetup.modules.items) {
                            const modSchema = await this.parseModule(
                                catMod,
                                `${rootUrl}/${category}/${catSetup.modules.path}/${catMod}`
                            )
                            // Override possible generic module name with category-specific module name.
                            this.modules.set(modSchema.name, modSchema)
                        }
                    }
                    this.schemas.set(category, newCategory)
                    for (const item of catSetup.items) {
                        const itemSetup = await fetch(`${rootUrl}/${category}/${item}/setup.yaml`)
                        //console.log('ITEM SETUP', itemSetup)
                        if (!itemSetup) {
                            Log.error(`Loading category ${category} item ${item} setup failed.`, SCOPE)
                            continue
                        }
                        //console.log(await(await itemSetup.blob()).text())
                        const itemJson = parseDocument(await itemSetup.text()).contents?.toJSON()
                        const itemSchema = {
                            description: null,
                            evaluation: null,
                            label: itemJson.label || '',
                            model: newCategory.model,
                            name: item,
                            parsers: new Map<string, FormFieldParser>(),
                            report: null,
                        } as ReporterSchema
                        //console.log('ITEM JSON', itemJson)
                        if (itemJson.description || itemJson.evaluation) {
                            const inputResponse = await fetch(`${rootUrl}/${category}/${item}/inputs.yaml`)
                            if (inputResponse.ok) {
                                const inputJson = parseDocument(await inputResponse.text()).contents?.toJSON()
                                //console.log('INPUT JSON', inputJson)
                                if (inputJson.description) {
                                    itemSchema.description = new Map<string, ReporterSchemaField>()
                                    this.parseSectionProperties(
                                        inputJson.description,
                                        itemSchema.description
                                    )
                                }
                                if (inputJson.evaluation) {
                                    itemSchema.evaluation = new Map<string, ReporterSchemaField>()
                                    this.parseSectionProperties(
                                        inputJson.evaluation,
                                        itemSchema.evaluation
                                    )
                                }
                            } else {
                                Log.error(
                                    `Category ${category} item ${item} inputs fetch error: ${inputResponse.statusText}.`,
                                    SCOPE
                                )
                                return false
                            }
                        }
                        if (itemJson.parsers) {
                            const parsersResponse = await fetch(`${rootUrl}/${category}/${item}/parsers.yaml`)
                            if (parsersResponse.ok) {
                                //console.log(await(await reportResponse.blob()).text())
                                const parserJson = parseDocument(await parsersResponse.text()).contents?.toJSON()
                                for (const [name, parserSchema] of Object.entries(parserJson)) {
                                    const parser = new FormParser(
                                        (parserSchema as any).input_field,
                                        (parserSchema as any).fields
                                    )
                                    itemSchema.parsers.set(name, parser)
                                }
                            } else {
                                Log.error(
                                    `Category ${
                                        category
                                    } item ${
                                        item
                                    } parsers fetch error: ${
                                        parsersResponse.statusText
                                    }.`,
                                    SCOPE
                                )
                                return false
                            }
                        }
                        if (itemJson.report) {
                            const reportResponse = await fetch(`${rootUrl}/${category}/${item}/report.yaml`)
                            if (reportResponse.ok) {
                                //console.log(await(await reportResponse.blob()).text())
                                const reportJson = parseDocument(await reportResponse.text()).contents?.toJSON()
                                itemSchema.report = reportJson || null
                                if (itemSchema.report?.fields.length) {
                                    // Convert sections in the report fields.
                                    this.convertFields(itemSchema.report.fields)
                                }
                            } else {
                                Log.error(
                                    `Category ${category} item ${item} report fetch error: ${reportResponse.statusText}.`,
                                    SCOPE
                                )
                                return false
                            }
                        }
                        this.schemas.get(category)?.schemas.set(item, itemSchema)
                    }
                } catch (e) {
                    Log.error(`Failed to parse category ${category}.`, SCOPE, e as Error)
                    return false
                }
            }
        }
        this.schemasLoaded = true
        //console.log(this.schemas)
        //console.log(this.modules)
        return true
    }
    /**
     * Parse section properties from the given fields and add them to the schema section.
     * @param fields - Fields to parse.
     * @param schemaSection - Schema section to add parsed fields to.
     */
    parseSectionProperties (
        fields: SchemaTemplateInputField[],
        schemaSection: Map<string, ReporterSchemaField>,
    ) {
        //console.log('PARSING SECTION', fields, schemaSection)
        /**
         * Convert a SchemaTemplateInputField to a ReporterSchemaField.
         * @param field - Field to convert to a ReporterSchemaField.
         * @returns The field with initialized ReporterSchemaField properties.
         */
        const convertField = (field: SchemaTemplateInputField): ReporterSchemaField => {
            const schemaField = {
                ...field,
                items: field.items?.map(i => convertField(i)),
                dependencies: [] as string[],
                edited: false,
                label: field.label || '',
                rows: [],
                value: field.default || null,
            } as ReporterSchemaField
            return schemaField
        }
        /**
         * Customizer function for the `mergeWith` function for merging arrays in schema sections.
         */
        const mergeCustomizer = (objVal: unknown, srcVal: unknown) => {
            if (isArray(objVal)) {
                if (isArray(srcVal)) {
                    objVal.push(...srcVal)
                } else {
                    objVal.push(srcVal)
                }
                return objVal
            }
            return undefined
        }
        const sectionProperties = new Map<string, { [name: string ]: unknown }>()
        for (let i=0; i<fields.length; i++) {
            const field = fields[i]
            if (field.type === 'module' && field.section) {
                const mod = this.modules.get(field.name!)
                const modSection = mod?.[
                                    field.section as keyof ReporterSchema
                                ] as Map<string, SchemaTemplateInputField> | undefined
                if (mod && modSection) {
                    const prevField = Array.from(schemaSection.values())[schemaSection.size - 1]
                    if (
                        prevField && prevField.type !== 'break' &&
                        !['break', 'header'].includes(Array.from(modSection.values())[0]?.type || '')
                    ) {
                        // Add a separator after the module.
                        const name = `field-${this.runningID++}`
                        schemaSection.set(
                            name,
                            convertField({
                                name,
                                type: 'header',
                                text: mod.label,
                                separator: true,
                            })
                        )
                    }
                    for (const [modName, modField] of modSection) {
                        schemaSection.set(modName, convertField(modField))
                    }
                    const nextField = fields[i + 1]
                    if (nextField && nextField.type !== 'break' && nextField.type !== 'module') {
                        // Add a separator after the module.
                        const sepName = `field-${this.runningID++}`
                        schemaSection.set(
                            sepName,
                            convertField({
                                name: sepName,
                                type: 'break',
                                separator: true,
                            })
                        )
                    }
                }
            } else {
                if (field.type === 'section:end') {
                    sectionProperties.delete(field.name!)
                    continue
                }
                if (field.type === 'section:start') {
                    const name = field.name!
                    // Remove type and name from field properties and save the rest.
                    delete field.type
                    delete field.name
                    sectionProperties.set(name, field)
                    continue
                }
                for (const [_name, props] of sectionProperties) {
                    // Assign all active section properties to this field.
                    mergeWith(field, props, mergeCustomizer)
                }
                if (!field.name) {
                    // Map keys must be unique.
                    field.name = `field-${this.runningID++}`
                }
                schemaSection.set(field.name, convertField(field as SchemaTemplateInputField))
            }
        }
    }
    /**
     * Update the field values of the given report category model.
     * @param category - Name of the report category.
     * @param description - Description fields to update.
     * @param evaluation - Evaluation fields to update.
     */
    updateModel (
        category: string,
        description: Map<string, ReporterSchemaField> | null,
        evaluation: Map<string, ReporterSchemaField> | null,
    ) {
        const categoryModel = this.schemas.get(category)?.model
        if (!categoryModel) {
            Log.error(`Cannot update model, category ${category} not found.`, SCOPE)
            return
        }
        const updateFields = (
            context: 'description' | 'evaluation',
            fields: Map<string, ReporterSchemaField> | null
        ) => {
            if (!fields) {
                return
            }
            for (const [name, field] of fields) {
                if (field.value === undefined || field.value === null && field.type !== 'group') {
                    // Remove field from model if value is nullish.
                    categoryModel[context].fields.delete(name)
                    continue
                } else if (field.type === 'group') {
                    // Groups are stored as arrays of field maps.
                    const newValues = [] as Map<string, SchemaFieldValue>[]
                    for (const row of field.rows) {
                        const modelRow = new Map<string, SchemaFieldValue>()
                        for (const item of row) {
                            modelRow.set(item.name, item.value)
                            newValues.push(modelRow)
                        }
                        newValues.push(modelRow)
                    }
                    // Overwrite existing group values.
                    categoryModel[context].groups.set(name, newValues)
                    continue
                }
                categoryModel[context].fields.set(name, field.value)
            }
        }
        updateFields('description', description)
        updateFields('evaluation', evaluation)
    }
    /**
     * Validate the given report template against available schemas.
     * @param template - Report template to validate.
     * @returns true/false
     */
    validateTemplate (template: ReportTemplate): boolean {
        console.debug(`Validating template`, template)
        // Check version
        if (template.version === undefined) {
            console.error(`Report template is missing a version number, cannot validate template.`)
            return false
        }
        if (!Object.keys(this.version).includes(template.version)) {
            console.error(`Report template version ${template.version} is not supported, cannot validate template.`)
            return false
        }
        const fieldPath = [] as string[]
        let fieldName = 'unknown'
        /**
         * Validate the given field against an array of schema fields.
         * @param field - Template field to validate.
         * @param schemaFields - Schema fields to validate against.
         * @returns true/false
         */
        const validateField = (field: [string, any], schemaFields: [string, any][], level = 0, rootField = false) => {
            const [name, value] = field
            if (fieldPath.length <= level) {
                fieldPath.push(name)
            } else {
                fieldPath[level] = name
            }
            // Try to preserve the name of the root field to use in error messages.
            if (level === 1 && name === 'name') {
                fieldName = value as string
            } else if (rootField) {
                // Reset when a new root field is started.
                fieldName = 'unknown'
            }
            for (let i=0; i<schemaFields.length; i++) {
                if (schemaFields[i] && schemaFields[i][0] === name) {
                    // Remove the field from schema array and validate
                    const sf = schemaFields[i]
                    // Check for value match
                    if (
                        (value !== null && value.constructor === sf[1]) ||
                        value === sf[1]
                    ) {
                        return true
                    } else if (Array.isArray(sf[1])) {
                        // Check falsy values like empty arrays.
                        if ((!value || !value.length) && sf[1].includes(undefined)) {
                            return true
                        }
                        // Check if value is an array of template fields
                        if (value !== null && typeof value === 'object' && Object.keys(value).length) {
                            if (Array.isArray(value)) {
                                for (const arrVal of value) {
                                    // Check for primitive values
                                    for (const sfi of sf[1]) {
                                        if (
                                            (arrVal !== null && arrVal.constructor === sfi) ||
                                            arrVal === sfi
                                        ) {
                                            return true
                                        }
                                    }
                                }
                            }
                            // Expect to find fields that can't be undefined.
                            const expectedFields = sf[1].filter(
                                                        f => f && (!Array.isArray(f[1]) || !f[1].includes(undefined))
                                                    ).map(f => f[0] || f)
                            // Validate sub-fields
                            for (const subField of Object.values(value)) {
                                for (const sfProp of Object.entries(subField as object)) {
                                    if (!validateField(sfProp as SchemaItem, sf[1], level + 1)) {
                                        return false
                                    }
                                    expectedFields.splice(expectedFields.indexOf(sfProp[0]), 1)
                                }
                            }
                            // Check if any there are any schema fields left
                            if (expectedFields.length) {
                                console.error(
                                    `Invalid template: The following level ${
                                        level
                                    } schema fields were not included in ${
                                        field[0]
                                    }: ${
                                        expectedFields.join(', ')
                                    }`
                                )
                                return false
                            } else {
                                return true
                            }
                        }
                        // Match any of the options
                        for (const sfi of sf[1]) {
                            if (
                                (value !== null && value.constructor === sfi) ||
                                value === sfi
                            ) {
                                return true
                            }
                        }
                    }
                }
            }
            console.error([
                `Invalid template: Could not validate property '${
                    fieldPath.join('.')
                }' for root field '${
                    fieldName
                }'; '${
                    value
                }' is not a supported value.`
            ])
            return false
        }
        const templateEntries = Object.entries(template)
        // Check fields
        const expectedFields = this.schema.FIELD_LIST.map(f => f[0])
        let name = ''
        while (templateEntries.length) {
            const nextField = templateEntries.shift()
            if (!nextField) {
                break
            }
            // This is the root level, don't check version again
            if (nextField[0] === 'version') {
                expectedFields.splice(expectedFields.indexOf(nextField[0]), 1)
                continue
            }
            fieldPath.splice(0, fieldPath.length, nextField[0])
            if (!validateField(nextField, this.schema.FIELD_LIST as SchemaItem, 0, true)) {
                return false
            } else {
                if (nextField[0] === 'label') {
                    name = nextField[1] as string
                }
                expectedFields.splice(expectedFields.indexOf(nextField[0]), 1)
            }
        }
        // Check if any root level schema fields have not been matched
        const unmatchedFields = Object.keys(expectedFields)
        if (unmatchedFields.length) {
            console.error(
                `Invalid template: The following schema fields were not included: ${unmatchedFields.join(', ')}`
            )
            return false
        }
        console.debug(`Template for schema '${name}' is valid.`)
        return true
    }
}
