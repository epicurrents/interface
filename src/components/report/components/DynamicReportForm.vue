<template>
    <wa-scroller orientation="vertical">
        <wa-select
            class="main"
            :disabled="!selectedCategory?.schemas.size || undefined"
            :value="selectedSchema?.name"
            @change="schemaChanged"
        >
            <wa-option v-for="([key, schema], idx) in selectedCategory?.schemas" :key="`schema-${key}-${idx}`"
                :value="key"
            >{{ schema.label }}</wa-option>
        </wa-select>
        <collapsible-wrapper ref="description" :id="`${selectedSchema?.name}-description`"
            :open="true"
            title="Description"
        >
            <div class="wrapper">
                <template v-for="(field, idx) in (activeDescription?.values() || [])" :key="`field-${idx}`">
                    <template v-if="field.type === 'group'">
                        <h5 class="group-header">
                            {{ field.label }}
                            <wa-button
                                appearance="outlined"
                                :id="`add-row-${idx}`"
                                size="regular"
                                variant="neutral"
                                @click="addRow(field.name)"
                            >
                                <wa-icon
                                    class="wa-brand"
                                    name="plus"
                                    variant="solid"
                                ></wa-icon>
                            </wa-button>
                            <wa-tooltip :for="`add-row-${idx}`" position="top">
                                Add a row
                            </wa-tooltip>
                        </h5>
                        <div class="group">
                            <template v-for="(row, idy) in field.rows" :key="`field-${idx}-row-${idy}`">
                                <div v-if="idy" :class="`break${field.paragraph ? ' paragraph' : ''}`"></div>
                                <template v-for="(member, idz) of row" :key="`field-${idx}-row-${idy}-item-${idz}`">
                                    <report-field v-if="!member.hidden"
                                        :allow-freetext="allowFreetext"
                                        :context="'description'"
                                        :field="member"
                                        :idx="idx"
                                        v-on:field-changed="fieldChanged(
                                            $event, 'description', member.type, field.name, idy
                                        )"
                                        v-on:field-input="fieldInput(
                                            $event, 'description', member.type, field.name, idy
                                        )"
                                        v-on:loaded="fieldLoaded('description')"
                                    >
                                    </report-field>
                                </template>
                                <wa-button
                                    appearance="outlined"
                                    :id="`remove-row-${idx}-${idy}`"
                                    size="regular"
                                    variant="neutral"
                                    @click="removeRow(field.name, idy)"
                                >
                                    <wa-icon
                                        class="wa-danger"
                                        name="trash"
                                        variant="regular"
                                    >
                                    </wa-icon>
                                </wa-button>
                                <wa-tooltip :for="`remove-row-${idx}-${idy}`" position="top">
                                    {{ idy ? "Delete row" : "Clear row" }}
                                </wa-tooltip>
                            </template>
                        </div>
                    </template>
                    <template v-else>
                        <report-field v-if="!field.hidden"
                            :allow-freetext="allowFreetext"
                            :context="'description'"
                            :field="field"
                            :idx="idx"
                            v-on:field-changed="fieldChanged($event, 'description', field.type)"
                            v-on:field-input="fieldInput($event, 'description', field.type)"
                            v-on:loaded="fieldLoaded('description')"
                        >
                        </report-field>
                    </template>
                </template>
            </div>
        </collapsible-wrapper>
    </wa-scroller>
</template>


<script lang="ts">
import { defineComponent, PropType, Ref, ref } from 'vue'
import {
    _addEmptyFormRow,
    _addMissingFieldProperties,
    _fieldTypesWithDependencies,
    _getFieldValueFromEvent,
} from '../assets'
import type { default as SchemaManager } from '../SchemaManager'
import CollapsibleWrapper from './CollapsibleWrapper.vue'
import ReportField from './ReportField.vue'
import { Log } from 'scoped-event-log'

export default defineComponent({
    name: 'DynamicReportForm',
    components: {
        CollapsibleWrapper,
        ReportField,
    },
    props: {
        allowFreetext: {
            type: Boolean,
            default: true,
        },
        category: {
            type: String,
            required: true,
        },
        manager: {
            type: Object as PropType<SchemaManager>,
            required: true,
        },
    },
    setup () {
        const description = ref<typeof CollapsibleWrapper>() as Ref<typeof CollapsibleWrapper>
        const evaluation = ref<typeof CollapsibleWrapper>() as Ref<typeof CollapsibleWrapper>
        const parsed = new Map<string, SchemaFieldValue>()
        const selectedCategory = ref(null as ReportCategory | null)
        const selectedSchema = ref(null as ReporterSchema | null)
        const waitingToResize = {
            description: 0,
            evaluation: 0,
        } as Record<ReportSection, number>
        return {
            description,
            evaluation,
            parsed,
            selectedCategory,
            selectedSchema,
            waitingToResize,
        }
    },
    computed: {
        activeDescription () {
            if (!this.selectedSchema) {
                return null
            }
            return this.selectedSchema.description || null
        },
        activeEvaluation () {
            if (!this.selectedSchema) {
                return null
            }
            return this.selectedSchema.evaluation || null
        },
    },
    methods: {
        activeContext (context: string) {
            return context === 'description' ? this.activeDescription : this.activeEvaluation
        },
        addRow (group: string, index?: number) {
            const contextGroup = this.activeDescription?.get(group)
            if (!contextGroup) {
                return
            }
            _addEmptyFormRow(contextGroup, index !== undefined ? index + 1 : undefined)
        },
        applyDefaultConditions (context: string) {
            const eventForField = (field: ReporterSchemaField) => {
                if (field.type === 'select') {
                    return {
                        target: { name: field.name, value: field.default || 0 }
                    }
                } else if (field.type === 'input') {
                    return {
                        target: { name: field.name, value: field.default || '' }
                    }
                } else if (field.type === 'switch') {
                    return {
                        target: { name: field.name, value: field.default || false }
                    }
                }
                // Not an input field
                return null
            }
            for (const [_key, field] of (this.activeContext(context) || [])) {
                const ev = eventForField(field)
                if (ev) {
                    this.fieldChanged(ev, context)
                }
            }
        },
        fieldChanged (event: any, context: string, type = '', group = '', index = 0) {
            const contextGroup = group ? this.activeContext(context)?.get(group) : null
            let fIdx = -1
            // Check for any errors if this is a group field
            if (contextGroup) {
                if (!contextGroup.rows || index < 0 ||
                    contextGroup.rows.length <= index
                ) {
                    return
                }
                fIdx = contextGroup.rows[index]
                       .map(f => f.name)
                       .indexOf(event.target.name)
                if (fIdx < 0) {
                    return
                }
            }
            const field = contextGroup
                        ? contextGroup.rows[index][fIdx]
                        : this.activeContext(context)?.get(event.target.name)
            if (!field) {
                return
            }
            field.edited = true
            field.value = _getFieldValueFromEvent(type, event)
            if (_fieldTypesWithDependencies.includes(type)) {
                for (const dep of field.dependencies) {
                    // Split at the first colon.
                    const [ctx, name] = dep.split(/:/)
                    Log.debug(`Reloading ${ctx}:${name}.`, this.$options.name!)
                    this.reloadField(ctx, name)
                }
            }
            if (field.parser) {
                this.parseForm()
            }
            if (this.selectedCategory) {
                this.manager.updateModel(
                    this.selectedCategory.name,
                    context === 'description' ? this.activeDescription : null,
                    context === 'evaluation' ? this.activeEvaluation : null
                )
                console.log(this.selectedCategory.model)
            }
        },
        fieldInput (event: any, context: string, type = '', group = '', index = 0) {
            // Reload fields that depend (visibility, enabled/disabled) on the content of this field,
            // but don't parse the form and recompile the report on every input.
            const contextGroup = group ? this.activeContext(context)?.get(group) : null
            let fIdx = -1
            // Check for any errors if this is a group field
            if (contextGroup) {
                if (!contextGroup.rows || index < 0 ||
                    contextGroup.rows.length <= index
                ) {
                    return
                }
                fIdx = contextGroup.rows[index]
                       .map(f => f.name)
                       .indexOf(event.target.name)
                if (fIdx < 0) {
                    return
                }
            }
            const field = contextGroup
                        ? contextGroup.rows[index][fIdx]
                        : this.activeContext(context)?.get(event.target.name)
            if (!field) {
                return
            }
            field.value = _getFieldValueFromEvent(type, event)
            if (_fieldTypesWithDependencies.includes(type)) {
                for (const dep of field.dependencies) {
                    // Split at the first colon.
                    const [ctx, name] = dep.split(/:/)
                    Log.debug(`Reloading ${ctx}:${name}.`, this.$options.name!)
                    this.reloadField(ctx, name)
                }
            }
        },
        fieldLoaded (context: ReportSection) {
            const wrapper = this.$refs[context] as typeof CollapsibleWrapper
            // Again, give the DOM a beat to catch up to the changes and resize the wrapper.
            // Only fire the resize event once per frame.
            this.waitingToResize[context]++
            requestAnimationFrame(() => {
                this.waitingToResize[context]--
                if (this.waitingToResize[context] > 0) {
                    // More loaded events have fired after this one, don't resize yet.
                    return
                }
                wrapper?.resize()
            })
        },
        getField (context: string, name: string) {
            return this.activeContext(context)?.get(name) || null
        },
        moveRow (group: string, index: number, target: number) {
            const contextGroup = this.activeDescription?.get(group)
            if (!contextGroup) {
                return
            }
            if (index < 0 || index >= contextGroup.rows.length) {
                return
            }
            if (index === target) {
                return
            }
            if (target < 0) {
                target = 0
            }
            if (target > contextGroup.rows.length) {
                target = contextGroup.rows.length
            }
            contextGroup.rows.splice(target, 0, contextGroup.rows.splice(index, 1)[0])
        },
        parseForm () {
            this.parsed.clear()
            const desc = this.activeDescription
            const evl = this.activeEvaluation
            if (!this.selectedSchema || !desc || !evl) {
                return
            }
            const parserVals = new Map<string, string[]>()
            for (const [name, field] of desc) {
                if (field.parser) {
                    const value = field.value as string
                    if (value) {
                        parserVals.set(`description:${name}`, value.split('\n'))
                    }
                    const schemaParser = this.selectedSchema?.parsers?.get(field.parser)
                    if (schemaParser) {
                        this.parsed = new Map([...this.parsed, ...schemaParser.parseFields(parserVals)])
                    }
                }
            }
            for (const [name, field] of evl) {
                if (field.parser) {
                    const value = field.value as string
                    if (value) {
                        parserVals.set(`evaluation:${name}`, value.split('\n'))
                    }
                    const schemaParser = this.selectedSchema?.parsers?.get(field.parser)
                    if (schemaParser) {
                        this.parsed = new Map([...this.parsed, ...schemaParser.parseFields(parserVals)])
                    }
                }
            }
        },
        reloadField (context: string, name: string) {
            const field =  this.getField(context, name)
            if (!field || field.edited) {
                return
            }
            field.disabled = undefined
            field.hidden = undefined
            field.value = field.default !== undefined ? field.default : null
            condition_loop:
            for (const cond of field.conditions) {
                field_loop:
                for (const cf of cond.fields) {
                    const cField = this.activeDescription?.get(cf.name)
                    if (!cField) {
                        continue field_loop
                    }
                    if (cf.empty !== undefined) {
                        const isEmpty = cField.value === null || cField.value === undefined || cField.value === ''
                        if (isEmpty === cf.empty) {
                            if (cond.default !== undefined) {
                                field.value = cond.default
                            }
                            if (cond.disabled !== undefined) {
                                field.disabled = cond.disabled
                            }
                            if (cond.hidden !== undefined) {
                                field.hidden = cond.hidden
                            }
                            continue condition_loop
                        }
                    } else {
                        // Check if any value matches.
                        for (const val of Array.isArray(cf.values) ? cf.values : [cf.values]) {
                            if (cField.value === val) {
                                if (cond.default !== undefined) {
                                    field.value = cond.default
                                }
                                if (cond.disabled !== undefined) {
                                    field.disabled = cond.disabled
                                }
                                if (cond.hidden !== undefined) {
                                    field.hidden = cond.hidden
                                }
                                // Stop at first satisfied condition.
                                continue condition_loop
                            }
                        }
                    }
                }
            }
        },
        reloadSchema () {
            if (!this.selectedSchema || !this.selectedSchema.description) {
                return
            }
            // Fields with conditional dependencies.
            const condFields = {
                description: [] as string[],
                evaluation: [] as string[],
            }
            /**
             * Add dependencies to fields based on options or conditions.
             * @param section - 'description' or 'evaluation'.
             * @param field - Field to add as a dependency.
             * @param key - Key of the field.
             */
            const addDependencies = (
                section: 'description' | 'evaluation',
                field: ReporterSchemaField | TemplateField,
                key: string
            ) => {
                if (field.options) {
                    for (const option of field.options as TemplateFieldOption[]) {
                        if (option && option.field) {
                            const context = option.section || section
                            const source = context === 'description'
                                         ? description.get(option.field)
                                         : evaluation.get(option.field)
                            if (source && !source.dependencies.includes(key)) {
                                source.dependencies.push(`${section}:${key}`)
                                condFields[section].push(field.name)
                            }
                        }
                    }
                }
                if (field.conditions) {
                    for (const condition of field.conditions as ConditionalFieldDefault[]) {
                        const deps = condition.fields || field.fields
                        if (!deps) {
                            return
                        }
                        for (const dep of deps) {
                            const context = dep.section || section
                            const source = context === 'description'
                                        ? description.get(dep.name)
                                        : evaluation.get(dep.name)
                            if (!source) {
                                continue
                            }
                            source.dependencies.push(`${section}:${key}`)
                            condFields[section].push(field.name)
                        }
                    }
                }
            }
            // Revert fields to initial and default values
            const description = this.selectedSchema.description
            const modelDescription = this.selectedCategory?.model.description
            for (const [key, field] of description) {
                _addMissingFieldProperties(field)
                // Parse group items if not already done
                if (field.type === 'group') {
                    if (!field.rows.length) {
                        // Add an initial empty row.
                        for (const item of field.items) {
                            item.value = item.default !== undefined ? item.default : null
                            item.edited = false
                            _addMissingFieldProperties(item)
                        }
                        _addEmptyFormRow(field)
                    }
                } else {
                    // Get any saved value from the model or use default if available.
                    field.value = field.default !== undefined
                                ? modelDescription?.fields.get(key) ?? field.default
                                : null
                }
                description.set(key, field)
            }
            for (const [key, field] of description.entries()) {
                addDependencies('description', field, key)
            }
            // Same for evaluation part
            if (!this.selectedSchema.evaluation) {
                return
            }
            const evaluation = this.selectedSchema.evaluation
            for (const [key, field] of evaluation) {
                field.value = field.default !== undefined ? field.default : null
                _addMissingFieldProperties(field)
                // Parse group items if not already done
                if (field.type === 'group' && field.items && !field.rows.length) {
                    for (const item of field.items) {
                        item.value = item.default !== undefined ? item.default : null
                        item.edited = false
                        _addMissingFieldProperties(item)
                    }
                    _addEmptyFormRow(field)
                }
                evaluation.set(key, field)
            }
            for (const [key, field] of evaluation.entries()) {
                addDependencies('evaluation', field, key)
            }
            // Reload conditional fields to apply initial state.
            for (const [context, fields] of Object.entries(condFields)) {
                for (const name of fields) {
                    this.reloadField(context, name)
                }
            }
        },
        removeRow (group: string, index: number) {
            const contextGroup = this.activeDescription?.get(group)
            if (!contextGroup) {
                return
            }
            if (index < 0 || index >= contextGroup.rows.length) {
                return
            }
            if (contextGroup.rows.length === 1) {
                // If this is the last row, reset to defaults
                for (const field of contextGroup.rows[0]) {
                    field.value = field.default || null
                }
            } else {
                // Otherwise remove the row
                contextGroup.rows.splice(index, 1)
            }
        },
        schemaChanged (event: any) {
            this.selectedSchema = this.selectedCategory?.schemas.get(event.target.value) || null
            this.reloadSchema()
        },
        tabOpened () {
            Log.debug(
                `Tab opened for ${this.selectedCategory?.name}/${this.selectedSchema?.name}.`,
                this.$options.name!
            )
            this.description.reload()
            Log.debug('Description loaded.', this.$options.name!)
            this.evaluation.reload()
            Log.debug('Evaluation loaded.', this.$options.name!)
        },
    },
    beforeMount () {
        this.selectedCategory = this.manager.schemas.get(this.category) || null
        if (!this.selectedCategory) {
            Log.warn(`Report category ${this.category} not found.`, this.$options.name!)
            return
        }
    },
    mounted () {
        if (this.selectedCategory?.setup.default) {
            this.selectedSchema = this.selectedCategory.schemas.get(this.selectedCategory.setup.default) || null
            this.reloadSchema()
        }
    },
})
</script>

<style scoped>
wa-switch {
    margin: 0 0.5rem;
}
.wrapper {
    display: flex;
    flex-wrap: wrap;
    line-height: 2rem;
}
.main {
    flex: 1 1 0;
}
div.collapsible-wrapper,
:deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5) {
    flex-basis: 100%;
}
:deep(h4) {
    height: 1.75em;
    margin: 0;
    margin-bottom: 1rem;
    color: var(--wa-color-blue-30);
    line-height: 2.5em;
    font-size: 1.2rem;
}
:deep(h4.break) {
    border-top: 1px solid #bdf;
    margin-top: 1rem;
}
:deep(h4 wa-icon), :deep(span wa-icon) {
    position: relative;
    top: 0.125em;
    margin-right: 0.25em;
    color: #069;
}
:deep(h5) {
    display: flex;
    justify-content: space-between;
    margin: 1rem 0 0.5rem 0;
    font-size: 1rem;
    height: var(--wa-form-control-height);
    line-height: var(--wa-form-control-height);
    color: var(--wa-color-blue-40);
}
    :deep(h5 wa-button::part(label)) {
        color: var(--wa-color-brand-on-normal);
    }
:deep(div.break) {
    flex-basis: 100%;
    height: 0.5em;
}
    :deep(div.break.paragraph) {
        height: 1.5em;
    }
    :deep(div.break.separator) {
        height: 1em;
        border-top: 1px solid #def;
        margin-top: 1em;
    }
:deep(div.group) {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    line-height: 2rem;
}
    :deep(div.group wa-button) {
        margin-inline-start: 0.25rem;
    }
        :deep(div.group wa-button::part(label)) {
            color: var(--wa-color-danger-on-normal);
        }
:deep(.field) {
    display: inline-block;
    margin-right: 10px;
    flex-grow: 0;
    flex-shrink: 0;
}
:deep(.filler) {
    flex-grow: 1;
    flex-shrink: 1;
    margin-right: 0;
}
:deep(span) {
    height: 2rem;
    line-height: 2.5rem;
}
/* Shoelace overrides */
:deep(.wrapper wa-switch) {
    line-height: 2rem;
    margin-left: 0;
}
</style>
