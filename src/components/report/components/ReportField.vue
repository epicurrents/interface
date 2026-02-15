<template>
    <template v-if="idx && field.type === 'break'">
        <div :class="{
            'break': true,
            'paragraph': field.paragraph || false,
            'separator': field.separator || false,
        }"></div>
    </template>
    <template v-else-if="field.type === 'header'">
        <component :is="field.separator ? 'h5' : 'h4'"
            :class="{
                'break': idx > 0,
                'separator': field.separator || false,
            }"
        >
            <wa-icon v-if="field.icon" :name="field.icon" variant="regular"></wa-icon>
            {{ field.text }}
        </component>
    </template>
    <template v-else-if="field.type === 'label'">
        <span v-if="field.text" class="field" :style="labelStyles(field)">
            <wa-icon v-if="field.icon" :name="field.icon" variant="regular"></wa-icon>
            {{ field.text }}
        </span>
        <span v-else-if="field.code === 'dash'" class="field">&mdash;</span>
        <span v-else-if="field.code === 'ellipsis'" class="field">&hellip;</span>
    </template>
    <template v-else-if="field.type === 'dynamic'">
        <wa-tag
            class="field"
            :size="field.size || 'small'"
            :style="labelStyles(field)"
        ><wa-icon v-if="field.icon" :name="field.icon" variant="regular"></wa-icon>{{ field.value }}</wa-tag>
    </template>
    <template v-else-if="field.type === 'input'">
        <wa-input class="field"
            :disabled="field.disabled || (field.freetext && !allowFreetext) || undefined"
            :label="field.label ? `&nbsp;${field.label}&nbsp;` : undefined"
            :name="field.name"
            :placeholder="field.placeholder || ''"
            :size="field.size || 'small'"
            :style="fieldStyles(field)"
            :value="field.value || ''"
            @change="$emit('field-changed', $event)"
            @input="$emit('field-input', $event)"
        >
            <span v-if="field.prefix" slot="start">{{ field.prefix }}</span>
            <span v-if="field.suffix" slot="end">{{ field.suffix }}</span>
        </wa-input>
    </template>
    <template v-else-if="field.type === 'select'">
        <wa-select class="field"
            :disabled="field.disabled || undefined"
            hoist
            :label="field.label ? `&nbsp;${field.label}&nbsp;` : undefined"
            :multiple="field.multiple || undefined"
            :name="field.name"
            :placeholder="field.placeholder || ''"
            :style="fieldStyles(field)"
            :size="field.size || 'small'"
            :value="field.multiple && Array.isArray(field.value)
                        ? (field.value as number[]).map(v => v.toString())
                        : field.value?.toString() || ''
                    "
            @change="$emit('field-changed', $event)"
        >
            <wa-option v-for="(opt, idy) in (field.options as string[])"
                :key="`field-${idx}-opt-${idy}`"
                :value="idy.toString()"
            >{{ opt }}</wa-option>
        </wa-select>
    </template>
    <template v-else-if="field.type === 'switch'">
        <wa-switch class="field"
            :disabled="field.disabled || undefined"
            :checked="field.value || undefined"
            :name="field.name"
            :size="field.size || 'small'"
            :style="fieldStyles(field)"
            @change="$emit('field-changed', $event)"
        >{{ field.label }}</wa-switch>
    </template>
    <template v-else-if="field.type === 'textarea'">
        <wa-textarea class="field"
            :disabled="field.disabled || undefined"
            :name="field.name"
            :style="fieldStyles(field)"
            :rows="field.height || 4"
            @change="$emit('field-changed', $event)"
            @input="$emit('field-input', $event)"
        >{{ field.label }}</wa-textarea>
    </template>
</template>


<script lang="ts">
import { defineComponent, PropType, ref } from 'vue'
import {
    _addEmptyFormRow,
    _addMissingFieldProperties,
    _fieldTypesWithDependencies,
    _getFieldValueFromEvent,
} from '../assets'

export default defineComponent({
    name: 'Reporter',
    props: {
        allowFreetext: {
            type: Boolean,
            default: true,
        },
        context: {
            type: String,
            required: true,
        },
        field: {
            type: Object as PropType<ReporterSchemaField>,
            required: true,
        },
        idx: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const wrapper = ref<HTMLDivElement>()
        return {
            wrapper,
        }
    },
    methods: {
        fieldStyles (field: ReporterSchemaField) {
            let styles = field.width ? `width:${field.width};flex-basis:${field.width};` : ''
            // Textarea height is measured in rows.
            if (field.height && field.type !== 'textarea') {
                if (typeof field.height === 'number') {
                    styles += `height:${field.height + 1}em;` // 1 em for paddings;
                } else {
                    styles += `height:${field.height};`
                }
            }
            if (field.expand) {
                styles += 'flex-grow:1;flex-shrink:1;margin-right:0;'
                if (!field.width) {
                    styles += 'flex-basis:0;'
                }
            }
            if (field.indent) {
                if (typeof field.indent === 'number') {
                    styles += `margin-inline-start:${field.indent}em;`
                } else {
                    styles += `margin-inline-start:${field.indent};`
                }
            }
            // Component specific styles.
            if (field.type === 'switch') {
                styles += '--width: 2.5em; --height: 1.75em;'
            }
            return styles
        },
        labelStyles (label: ReporterSchemaField) {
            let styles = ''
            if (this.field.width) {
                styles += `width:${label.width};flex-basis:${label.width};`
            }
            if (label.expand) {
                styles += 'flex-grow:1;flex-shrink:1;margin-right:0;'
            }
            if (label.indent) {
                if (typeof label.indent === 'number') {
                    styles += `margin-inline-start:${label.indent}em;`
                } else {
                    styles += `margin-inline-start:${label.indent};`
                }
            }
            if (label.text && label.align) {
                styles += `text-align:${label.align};`
            }
            return styles
        },
    },
    mounted () {
        // Give WA components time to render and emit the loaded event.
        requestAnimationFrame(() => {
            this.$emit('loaded')
        })
        console.log(this.idx, this.field)
    },
})
</script>

<style scoped>
.field {
    display: inline-block;
    flex-grow: 0;
    flex-shrink: 0;
    margin-right: 10px;
}
    .field[readonly] {
        opacity: 0.6;
    }
.expander {
    flex-grow: 1;
    flex-shrink: 1;
    margin-right: 0;
}
h5.separator {
    /* In-section separator */
    margin: 0.75rem 0 0 0;
}
/** WebAwesome overrides. */
wa-input span[slot="start"], wa-input span[slot="end"] {
    height: var(--wa-form-control-height);
    line-height: var(--wa-form-control-height);
}
wa-select::part(form-control) {
    position: relative;
}
wa-select::part(form-control-label) {
    position: absolute;
    top: -0.5em;
    left: 0.1em;
    font-size: 0.8em;
    height: 1em;
    line-height: 1em;
    color: #707070;
    background-color: #f8f8f8;
    z-index: 1;
}
wa-switch[size=medium]::part(base) {
    height: 100%;
}
wa-tag.field {
    line-height: 2.5rem;
}
</style>
