<template>
    <split-panel-view
        data-component="tab-viewer"
        :primary-size-bounds="['300px', '40%']"
        primary-slot="end"
        :primary-start-size="350"
    >
        <template v-slot:start>
            <div
                class="tables"
                :style="{ fontSize: tableScale }"
                ref="component"
            >
                <div v-if="!isLoaded" class="container loading">
                    <wa-spinner class="inline"></wa-spinner>
                    {{ $t('Loading data, please wait...') }}
                </div>
                <div v-else-if="RESOURCE.state === 'error'" class="container error">
                    <app-icon class="inline" name="triangle-exclamation" size="large"></app-icon>
                    {{ $t('An error occurred while loading study data.') }}
                </div>
                <wa-tab-group v-else
                    class="container"
                    ref="container"
                    @wa-tab-show="RESOURCE.setActiveTableByReference($event.detail.name)"
                >
                    <wa-tab v-for="(table, idx) in visibleTables" :key="`${RESOURCE.id}-tab-${idx}`"
                        :active="table.isActive || undefined"
                        slot="nav"
                        :panel="table.name"
                    >{{ table.label }}</wa-tab>
                    <wa-tab-panel v-for="(table, idx) in visibleTables" :key="`${RESOURCE.id}-tab-panel-${idx}`"
                        :name="table.name"
                    >
                        <wa-scroller orientation="vertical">
                            <table class="table" :style="{ fontSize: `${RESOURCE.scale}rem` }">
                                <tbody>
                                    <tr v-if="table.configuration.some(c => c.label?.length)">
                                        <template v-for="(field, idy) in table.configuration"
                                            :key="`tab-${idx}-header-field-${idy}`"
                                        >
                                            <th v-if="!field.hidden"><span>{{ field.label }}</span></th>
                                        </template>
                                    </tr>
                                    <template v-for="(section, idy) in table.sections" :key="`tab-${idx}-section-${idy}`">
                                        <tr v-if="table.sections.length > 1 || section.title?.length" class="section-header">
                                            <td class="section-head" colspan="100">
                                                <span class="section-title">{{ section.title }}</span>
                                                <wa-button v-if="section.subcontext"
                                                    appearance="plain"
                                                    @click="inspectStudy(section.subcontext)"
                                                >
                                                    <app-icon appearance="brand" name="search"></app-icon>
                                                </wa-button>
                                                <wa-button
                                                    appearance="plain"
                                                    style="float: right;"
                                                    @click="toggleCollapsedSection(idy)"
                                                >
                                                    <app-icon
                                                        :name="collapsedSections.has(idy) ? 'chevron-down' : 'chevron-up'"
                                                    ></app-icon>
                                                </wa-button>
                                            </td>
                                        </tr>
                                        <template v-if="!collapsedSections.has(idy)">
                                            <tr v-for="(row, idz) in section.rows" :key="`tab-${idx}-section-${idy}-row-${idz}`">
                                                <td v-for="(cell, ida) in getRowFieldValues(table, row)"
                                                    :key="`tab-${idx}-section-${idy}-row-${idz}-field-${ida}`"
                                                    :class="cell?.descriptors?.normativity ? `field-value-${cell.descriptors.normativity}` : ''"
                                                >
                                                    <span v-if="cell.value !== null && cell.value !== undefined"
                                                        :class="{ 'subcontext': cell.subcontext !== undefined }"
                                                        :id="`tab-${idx}-section-${idy}-row-${idz}-cell-${ida}-value`"
                                                        @click="cell.subcontext ? inspectStudy(cell.subcontext) : undefined"
                                                    >
                                                        {{ cell.value }}
                                                    </span>
                                                    <span v-else class="empty">&mdash;</span>
                                                    <wa-tooltip v-if="cell?.tooltip"
                                                        :for="`tab-${idx}-section-${idy}-row-${idz}-cell-${ida}-value`"
                                                    >{{ cell.tooltip }}</wa-tooltip>
                                                </td>
                                            </tr>
                                        </template>
                                    </template>
                                </tbody>
                            </table>
                        </wa-scroller>
                    </wa-tab-panel>
                </wa-tab-group>
            </div>
        </template>
        <template v-slot:end>
            <annotation-sidebar ref="sidebar"
                :availableTabs="['labels']"
                class="sidebar"
                :open="true"
                tab="labels"
                v-on:labels-changed="labelsChanged"
            ></annotation-sidebar>
        </template>
    </split-panel-view>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useTabDataContext } from '..'
import { ResourceLabel } from "@epicurrents/core"
import { lastFractOnlyIfSignificant } from "@epicurrents/core/dist/util"
import { TabularDataTable } from "@epicurrents/tab-module/dist/types"
import { DataTableRowValue } from "@epicurrents/core/dist/types"
import type { default as WaSplitPanel } from '@awesome.me/webawesome/dist/components/split-panel/split-panel.js'

import AnnotationSidebar from '#app/views/biosignal/sidebars/AnnotationSidebar.vue'
import SplitPanelView from '#app/views/SplitPanelView.vue'

export default defineComponent({
    name: 'TabViewer',
    props: {
        viewerSize: {
            type: Array as PropType<number[]>,
            required: true,
        },
    },
    components: {
        AnnotationSidebar,
        SplitPanelView,
    },
    setup () {
        const store = useStore()
        const context = useTabDataContext(store, 'TabViewer')
        const collapsedSections = ref(new Set<number>())
        const isLoaded = ref(context.RESOURCE.tables.length > 0)
        const visibleTables = ref(context.RESOURCE.tables as TabularDataTable[])
        // Template refs
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const container = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const panel = ref<WaSplitPanel>() as Ref<WaSplitPanel>
        // Unsubscribe from store mutations
        const unsubscribe = store.subscribe((mutation) => {
            if (mutation.type === 'tab.set-scale') {
                context.RESOURCE.scale = mutation.payload.value
            }
        })
        return {
            collapsedSections,
            isLoaded,
            visibleTables,
            // Template refs
            component,
            container,
            panel,
            // Unsubscribers
            unsubscribe,
            // Context properties.
            ...context,
        }
    },
    watch: {
        viewerSize () {
            this.resizeElements()
        },
    },
    computed: {
        tableScale (): string {
            return `${this.RESOURCE.scale}rem`
        },
    },
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a component-specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        Log (event: any) {
            console.log(event)
        },
        hideAllOverlayElements () {
        },
        getRowFieldValue (value: unknown, precision?: number) {
            if (typeof value === 'number' && precision !== undefined) {
                return precision !== undefined ? value.toFixed(precision) : lastFractOnlyIfSignificant(value, 2)
            }
            return value
        },
        getRowFieldValues (table: TabularDataTable, row: DataTableRowValue[]) {
            const values = []
            for (let i = 0; i < table.configuration.length; i++) {
                const config = table.configuration[i]
                if (!config.hidden) {
                    const value = { ...row[i] }
                    if (typeof value.value === 'number') {
                        value.value = config.precision !== undefined
                                    ? config.precision > 0
                                        ? value.value.toFixed(config.precision)
                                        : value.value.toFixed()
                                    : lastFractOnlyIfSignificant(value.value, 2) // Use 2 decimal places as default.
                    }
                    values.push(value)
                }
            }
            return values
        },
        inspectStudy (subctxId: string) {
            const subctxExists = this.RESOURCE.subcontexts.has(subctxId)
            if (subctxExists) {
                this.RESOURCE.setActiveSubcontext(subctxId)
                // Trigger update by resetting the active resource in the store.
                // TODO: A better way to handle this.
                this.$store.dispatch('set-active-resource', this.RESOURCE)
            }
        },
        labelsChanged (
            changed: {
                context: string,
                field: string,
                value: boolean | number | number[] | string | string[] | null
            }[]
        ) {
            const originalLabels = [...this.RESOURCE.labels]
            for (const params of changed) {
                const labelName = params.context ? `${params.context}:${params.field}` : params.field
                const lbl = this.RESOURCE.labels.find(label => label.name === labelName)
                if (lbl) {
                    lbl.value = params.value
                    if (params.value === null) {
                        this.RESOURCE.labels.splice(this.RESOURCE.labels.indexOf(lbl), 1)
                        continue
                    }
                } else {
                    if (params.value === null) {
                        continue
                    }
                    const label = new ResourceLabel(
                        labelName,
                        params.value,
                        { annotator: this.$store.state.INTERFACE.app.userName || '' }
                    )
                    this.RESOURCE.labels.push(label)
                }
            }
            this.RESOURCE.dispatchPropertyChangeEvent('labels', this.RESOURCE.labels, originalLabels)
        },
        resizeElements () {
        },
        toggleCollapsedSection (idx: number) {
            if (this.collapsedSections.has(idx)) {
                this.collapsedSections.delete(idx)
            } else {
                this.collapsedSections.add(idx)
            }
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        // Listen to property updates.
        this.RESOURCE.onPropertyChange('isActive', () => {
            if (!this.RESOURCE.isActive) {
                // Remove all event listeners before the resource becomes null.
                this.RESOURCE.removeAllEventListeners(this.ID)
            }
        }, this.ID, 'before')
        this.RESOURCE.onPropertyChange('tables', () => {
            if (this.isLoaded) {
                return
            }
            this.visibleTables = this.RESOURCE.tables.filter(table => table.sections.length > 0)
            this.isLoaded = true
        }, this.ID)
    },
    beforeUnmount () {
        this.RESOURCE?.removeAllEventListeners(this.ID)
        this.$runtime.SETTINGS.removeAllPropertyUpdateHandlersFor(this.ID)
        // Unsubscribe from store
        this.unsubscribe?.()
    },
})
</script>

<style scoped>
[data-component="tab-viewer"] {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
[data-component="tab-viewer"] wa-tab-group::part(nav) {
    padding-right: 0.25rem;
}
.tables {
    font-size: 1.5rem;
    height: 100%;
    width: 100%;
}
    .margin-top {
        height: 0;
        margin-bottom: 1em;
    }
    .margin-bottom {
        height: 0;
        margin-top: 1em;
    }
    [data-component="tab-viewer"] canvas {
        display: block;
        margin: 0;
    }
.container {
    height: 100%;
    max-width: 100%;
    padding: 0 0.75rem 0 1rem;
    width: auto;
}
    .container.loading, .container.error {
        padding-top: 0.75rem;
    }
    .container .table {
        max-width: 100%;
    }
[data-component="tab-viewer"] wa-tab-group {
    height: 100%;
}
[data-component="tab-viewer"] wa-tab-group::part(base) {
    height: 100%;
}
[data-component="tab-viewer"] wa-tab-group::part(body) {
    overflow: hidden;
}
    .container wa-tab-panel {
        height: 100%;
        overflow: hidden;
    }
    .container wa-tab-panel::part(base) {
        height: 100%;
        overflow: visible;
        padding: 1rem 0;
    }
    .container wa-tab-panel:deep(tr) {
        max-height: 2.5em;
    }
        .container tr wa-button,
        .container tr wa-button::part(base),
        .container tr wa-icon {
            font-size: v-bind(tableScale);
            height: 2.5em;
        }
    .container wa-tab-panel:deep(td), .container wa-tab-panel:deep(th) {
        border: 1px solid var(--epicv-border-faint);
        padding: 0 0.5rem;
    }
    .container wa-tab-panel:deep(td.section-head) {
        background-color: var(--epicv-background-highlight);
    }
        .container wa-tab-panel:deep(td.section-head > wa-button) {
            vertical-align: top;
        }
    .container wa-tab-panel:deep(span) {
        display: inline-block;
        height: 100%;
        line-height: 2.5em;
    }
    .container wa-tab-panel:deep(wa-tooltip) {
        font-weight: normal;
    }
    .container td span.subcontext {
        cursor: pointer;
        text-decoration: underline dashed;
        text-underline-offset: 0.2em;
    }
    .container td span.empty {
        color: var(--epicv-text-faint);
    }
/* Cell normativity styles */
.field-value-abnormal {
    color: darkred;
    font-weight: bold;
}
.field-value-normal {
    color: darkgreen;
    font-weight: bold;
}
.field-value-supranormal {
    color: green;
    font-weight: bold;
}
/* Revert some app-wide changes. */
[data-component="tab-viewer"], [data-component="tab-viewer"] * {
    list-style: initial;
    list-style-type: initial;
}
[data-component="tab-viewer"] ul, [data-component="tab-viewer"] ol {
    padding-left: 1em;
}
[data-component="tab-viewer"] li {
    margin: 0.3em 0;
}
</style>
