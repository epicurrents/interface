/**
 * Reporting tool form parser.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

//const SCOPE = 'FormParser'

export default class FormParser implements FormFieldParser {

    // Try to determine the correct decimal delimiter based on user's locale.
    protected _decimalDelimiter = 1.1.toLocaleString().substring(1, 2)
    protected _fields = new Map<string, ParserFieldEntry[]>()

    constructor (
        inputName: string,
        fields: { names: string[], pattern: string, types: string[] }[],
        decimalDelimiter?: string
    ) {
        if (decimalDelimiter) {
            this._decimalDelimiter = decimalDelimiter
        }
        const inputFields = [] as ParserFieldEntry[]
        for (const field of fields) {
            inputFields.push({
                names: field.names,
                pattern: new RegExp(field.pattern),
                types: field.types || []
            })
        }
        this._fields.set(inputName, inputFields)
    }

    parseFields (fields: Map<string, string[]>) {
        const parsed = new Map<string, SchemaFieldValue>()
        for (const [name, lines] of fields) {
            const inputFields = this._fields.get(name)
            if (!inputFields) {
                continue
            }
            field_loop:
            for (const parserField of inputFields) {
                for (const line of lines) {
                    const match = line.match(parserField.pattern)
                    if (match) {
                        for (let i=1; i<match.length; i++) {
                            const value = parserField.types[i-1] === 'number'
                                          ? match[i].includes(this._decimalDelimiter)
                                            ? parseFloat(match[i].replace(this._decimalDelimiter, '.'))
                                            : parseInt(match[i])
                                          : match[i]
                            parsed.set(`${name}:${parserField.names[i-1]}`, value)
                        }
                        continue field_loop
                    }
                }
                parserField.names.map(fieldName => {
                    parsed.set(`${name}:${fieldName}`, null)
                })
            }
        }
        return parsed
    }
}
