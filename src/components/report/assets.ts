/**
 * Reporting tool assets.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

// const SCOPE = 'assets'

export const _fieldTypesWithDependencies = [ 'input', 'select', 'switch' ]

export const _addEmptyFormRow = (group: ReporterSchemaField, index = -1) => {
    if (group.type !== 'group' || !group.items?.length || index > group.rows.length) {
        return
    }
    const row = []
    for (const item of group.items) {
        const rowItem = {
            ...item,
            // Attempt to copy properties from the item, but ensure we don't point to any original properties.
            conditions: item.conditions?.length ? [...item.conditions.map(c => { return { ...c } })] : [],
            dependencies: item.dependencies?.length ? [...item.dependencies] : [],
            items: item.items?.length ? [...item.items.map(i => { return { ...i } })] : [],
            rows: item.rows?.length ? [...item.rows.map(r => { return [...r] })] : [],
            value: item.default !== undefined ? item.default : null,
            fields: item.fields?.length ? [...item.fields.map(f => { return { ...f } })] : [],
            options: item.options?.length ? [...item.options] : [],
        } as ReporterSchemaField
        _addMissingFieldProperties(rowItem)
        row.push(rowItem)
    }
    if (index === -1 || index === group.rows.length) {
        group.rows.push(row)
    } else {
        group.rows.splice(index, 0, row)
    }
}

let genericCounter = 0
export const _addMissingFieldProperties = (field: ReporterSchemaField) => {
    field.conditions = field.conditions || []
    field.dependencies = field.dependencies || []
    field.items = field.items || []
    field.rows = field.rows || []
    const genericFields = ['break', 'header', 'label']
    if (!field.name && genericFields.includes(field.type)) {
        // This is probably never reached any more as field names are assigned in SchemaManager...
        field.name = `${field.type}${genericCounter++}`
    }
}

export const _getFieldValueFromEvent = (fieldType: string, event: any) => {
    return  fieldType === 'select'
            ? event.target.multiple
                ? event.target.value.length
                    ? event.target.value.map((v: string) => parseInt(v))
                    : null
                : parseInt(event.target.value)
            : fieldType === 'switch' ? event.target.checked
            : fieldType === 'input' && !event.target.value.length ? null
            : event.target.value
}
